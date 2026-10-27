const { randomUUID } = require('crypto');
const httpStatus = require('http-status');
const { Op } = require('sequelize');
const ApiError = require('../helper/ApiError');
const db = require('../models');
const { assertContratoNoEscopoOSS, assertAcompanhamentoNoEscopoOSS } = require('../helper/ossScopeHelper');
const { calcular, regraEfetiva } = require('../helper/percentualRecebimento');

/** where Sequelize: vigência [inicio, fim] (nulos abertos) cobre a data */
const vigenteEm = (data) => ({
    [Op.and]: [
        { [Op.or]: [{ vigencia_inicio: null }, { vigencia_inicio: { [Op.lte]: data } }] },
        { [Op.or]: [{ vigencia_fim: null }, { vigencia_fim: { [Op.gte]: data } }] },
    ],
});

const notaMaisRecente = (notas = []) => [...notas].sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))[0] || null;

const toNota = (n) => (n ? {
    nota_id: n.nota_id,
    descricao: n.descricao,
    causa_raiz: n.causa_raiz,
    acao_corretiva: n.acao_corretiva,
    status_validacao: n.status_validacao,
    alcance_considerado: n.alcance_considerado == null ? null : parseFloat(n.alcance_considerado),
    motivo_rejeicao_nota: n.motivo_rejeicao_nota,
} : null);

/** Melhor nota de um período: aceita com maior alcance considerado; senão a mais recente. */
function notaDoPeriodo(acomps) {
    const notas = acomps.flatMap((a) => a.notas || []);
    const alcance = (n) => (n.alcance_considerado == null ? 100 : parseFloat(n.alcance_considerado));
    const aceitas = notas.filter((n) => n.status_validacao === 'aceita').sort((a, b) => alcance(b) - alcance(a));
    return aceitas[0] || notaMaisRecente(notas);
}

/**
 * Linha do helper para um conjunto de meses: snapshot do lançamento quando existe; senão a meta
 * cadastrada (mês sem lançamento). Vários meses (trimestre) → soma realizado e base dos meses lançados.
 */
function linhaDe(ind, meses) {
    const acomps = (ind.acompanhamentos || []).filter((a) => meses.includes(String(a.mes_referencia).slice(0, 10)));
    const acomp = acomps[0] || null;
    const meta = ind.metas?.[0] || {};
    const quant = ind.tipo === 'quantitativo';
    const baseDe = (a) => (quant ? a.meta_vigente_mensal : a.meta_vigente_qualit);
    const comReal = acomps.filter((a) => a.valor_realizado != null);
    const soma = (fn) => comReal.reduce((s, a) => s + parseFloat(fn(a) || 0), 0);

    let base = acomp ? baseDe(acomp) : (quant ? meta.meta_mensal : meta.meta_valor_qualit);
    let realizado = acomp?.valor_realizado == null ? null : parseFloat(acomp.valor_realizado);
    if (meses.length > 1) {
        realizado = comReal.length ? soma((a) => a.valor_realizado) : null;
        base = comReal.length ? soma(baseDe) : (base == null ? null : parseFloat(base) * meses.length);
    }
    const metaFaixas = acomp
        ? { meta_tipo_snap: acomp.meta_tipo_snap, meta_minima: acomp.meta_minima, meta_parcial: acomp.meta_parcial }
        : { meta_tipo: meta.meta_tipo, meta_minima: meta.meta_minima, meta_parcial: meta.meta_parcial };
    return {
        indicador_id: ind.indicador_id,
        codigo: ind.codigo,
        nome: ind.nome,
        acomp_id: meses.length === 1 ? acomp?.acomp_id || null : null,
        status_aprovacao: acomp?.status_aprovacao || null,
        meses_lancados: comReal.length,
        realizado,
        base: base == null ? null : parseFloat(base),
        meta: metaFaixas,
        nota: toNota(notaDoPeriodo(acomps)),
    };
}

/** Mês de aplicação (jan/abr/jul/out) → meses 'YYYY-MM-01' do trimestre anterior; senão null. */
function trimestreAnterior(mesYm) {
    const [y, m] = mesYm.split('-').map(Number);
    if ((m - 1) % 3 !== 0) return null;
    const meses = [3, 2, 1].map((k) => {
        const d = new Date(y, m - 1 - k, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [ty, tm] = meses[0].split('-').map(Number);
    return { meses, rotulo: `T${Math.floor((tm - 1) / 3) + 1}/${ty}` };
}

/**
 * Percentual de recebimento do mês (cálculo vivo, não grava repasse).
 * Regra da vigência em tb_historico_contrato.regra_recebimento (null = fixa_variavel padrão).
 * producao.periodo 'trimestral': desconto de produção só nos meses de aplicação, sobre o trimestre
 * anterior; nos demais meses as linhas quantitativas são prévia do mês.
 * @param {string} contratoId
 * @param {string} mesYm 'YYYY-MM'
 */
const calcularRecebimento = async (contratoId, mesYm, ossIdFiltro = null) => {
    await assertContratoNoEscopoOSS(contratoId, ossIdFiltro);
    const mes = `${mesYm}-01`;

    const contrato = await db.contrato.findByPk(contratoId);
    if (!contrato) throw new ApiError(httpStatus.NOT_FOUND, 'Contrato não encontrado');

    const hist = await db.historico_contrato.findOne({
        where: { contrato_id: contratoId, ...vigenteEm(mes) },
        order: [['versao', 'DESC']],
    });
    const fonte = hist || contrato;
    const regra = regraEfetiva(hist?.regra_recebimento || null);
    const base = parseFloat(fonte.valor_mensal_base);
    const parcelaFixa = (base * parseFloat(fonte.perc_fixo)) / 100;
    const parcelaVariavel = (base * parseFloat(fonte.perc_variavel)) / 100;

    const trimestral = regra.modelo === 'producao_qualidade' && regra.producao?.periodo === 'trimestral';
    const tri = trimestral ? trimestreAnterior(mesYm) : null;

    const indicadores = await db.indicador.findAll({
        where: { contrato_id: contratoId, ativo: 1, obrigatorio: 1, ...vigenteEm(mes) },
        include: [
            { model: db.meta, as: 'metas', required: false },
            {
                model: db.acompanhamento_mensal,
                as: 'acompanhamentos',
                required: false,
                where: { mes_referencia: [mes, ...(tri ? tri.meses : [])], status_aprovacao: { [Op.ne]: 'rejeitado' } },
                include: [{ model: db.nota_explicativa, as: 'notas', required: false }],
            },
            { model: db.bloco_producao, as: 'bloco', required: false },
        ],
        order: [['codigo', 'ASC']],
    });

    const blocoIds = [...new Set(indicadores.filter((i) => i.bloco_id).map((i) => i.bloco_id))];
    const histBlocos = blocoIds.length
        ? await db.historico_bloco.findAll({ where: { bloco_id: blocoIds, ...vigenteEm(mes) }, order: [['versao', 'DESC']] })
        : [];
    const pesoBloco = (bloco) => {
        const h = histBlocos.find((x) => x.bloco_id === bloco.bloco_id);
        return parseFloat(h ? h.percentual_peso_bloco : bloco.percentual_peso_bloco);
    };

    // Quantitativos agrupados por bloco (linha de serviço); sem bloco = grupo próprio de peso 1
    const gruposDe = (meses) => {
        const grupos = new Map();
        for (const ind of indicadores.filter((i) => i.tipo === 'quantitativo')) {
            const chave = ind.bloco_id || ind.indicador_id;
            if (!grupos.has(chave)) {
                grupos.set(chave, {
                    bloco_id: ind.bloco_id,
                    codigo: ind.bloco?.codigo || ind.codigo,
                    nome: ind.bloco?.nome || ind.nome,
                    peso: ind.bloco ? pesoBloco(ind.bloco) : 1,
                    linhas: [],
                });
            }
            grupos.get(chave).linhas.push(linhaDe(ind, meses));
        }
        return [...grupos.values()];
    };
    const qual = indicadores
        .filter((i) => i.tipo === 'qualitativo')
        .map((ind) => ({ ...linhaDe(ind, [mes]), peso: parseFloat(ind.peso_perc), grupo: ind.grupo }));

    const comum = {
        regra, qual, parcelaFixa, parcelaVariavel, valorMensal: base,
    };
    const previa = gruposDe([mes]);
    const resultado = calcular({
        ...comum,
        quant: tri ? gruposDe(tri.meses) : previa,
        aplicarProducao: !trimestral || Boolean(tri),
    });
    const extraTrimestral = trimestral ? {
        oficial: tri ? { trimestre: tri.rotulo, meses: tri.meses.map((m) => m.slice(0, 7)) } : null,
        previa: calcular({ ...comum, quant: previa, aplicarProducao: false }).grupos,
    } : {};

    return {
        contrato_id: contratoId,
        numero: contrato.numero,
        mes: mesYm,
        vigencia: hist ? {
            versao: hist.versao, inicio: hist.vigencia_inicio, fim: hist.vigencia_fim, aditivo_id: hist.aditivo_id,
        } : null,
        valor_mensal_base: base,
        parcela_fixa: parcelaFixa,
        parcela_variavel: parcelaVariavel,
        regra,
        ...resultado,
        ...extraTrimestral,
    };
};

const criarNota = async (acompId, dados, usuarioId, ossIdFiltro = null) => {
    await assertAcompanhamentoNoEscopoOSS(acompId, ossIdFiltro);
    const acomp = await db.acompanhamento_mensal.findByPk(acompId, { attributes: ['acomp_id'] });
    if (!acomp) throw new ApiError(httpStatus.NOT_FOUND, 'Acompanhamento não encontrado');
    return db.nota_explicativa.create({
        ...dados, nota_id: randomUUID(), acomp_id: acompId, criado_por: usuarioId,
    });
};

const validarNota = async (notaId, dados, usuarioId, ossIdFiltro = null) => {
    const nota = await db.nota_explicativa.findByPk(notaId);
    if (!nota) throw new ApiError(httpStatus.NOT_FOUND, 'Nota explicativa não encontrada');
    await assertAcompanhamentoNoEscopoOSS(nota.acomp_id, ossIdFiltro);
    const aceita = dados.status_validacao === 'aceita';
    await nota.update({
        status_validacao: dados.status_validacao,
        alcance_considerado: aceita ? (dados.alcance_considerado ?? null) : null,
        motivo_rejeicao_nota: aceita ? null : (dados.motivo_rejeicao_nota || null),
        validado_por: usuarioId,
    });
    return nota;
};

module.exports = { calcularRecebimento, criarNota, validarNota };
