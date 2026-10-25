const httpStatus = require('http-status');
const { randomUUID } = require('crypto');
const { Op } = require('sequelize');
const ApiError = require('../helper/ApiError');
const { assertIndicadorNoEscopoOSS, assertUnidadeNoEscopoOSS } = require('../helper/ossScopeHelper');
const db = require('../models');

// ── Mapeamento tipo BD ↔ API ──────────────────────────────────────────────────
// O modelo BD usa 'quantitativo'/'qualitativo'; a API simplificada expõe 'producao'/'qualidade'
const TIPO_TO_API = { quantitativo: 'producao', qualitativo: 'qualidade' };
const TIPO_TO_DB  = { producao: 'quantitativo', qualidade: 'qualitativo' };

// ── Serialização BD → API ─────────────────────────────────────────────────────
// Valor da meta vigente (folha de maior versão): produção → meta_mensal; qualidade → meta_valor_qualit
function metaValorVigente(metas) {
    const arr = Array.isArray(metas) ? metas : [];
    const folha = arr
        .filter((m) => m.papel !== 'agregada')
        .sort((a, b) => (b.versao || 0) - (a.versao || 0))[0] || arr[0] || null;
    if (!folha) return null;
    if (folha.meta_mensal != null) return parseFloat(folha.meta_mensal);
    if (folha.meta_valor_qualit != null) return parseFloat(folha.meta_valor_qualit);
    return null;
}

function toRecord(i) {
    const d = i.toJSON ? i.toJSON() : i;
    return {
        id:             d.indicador_id,
        unidadeId:      d.unidade_id,
        contratoId:     d.contrato_id ?? null,
        ano:            d.ano ?? null,
        nome:           d.nome,
        descricao:      d.descricao ?? null,
        tipo:           TIPO_TO_API[d.tipo] ?? d.tipo,
        metaPadrao:     metaValorVigente(d.metas),
        pesoPerc:       d.peso_perc != null ? parseFloat(d.peso_perc) : null,
        unidadeMedida:  d.unidade_medida ?? null,
        vigenciaInicio: d.vigencia_inicio ?? null,
        vigenciaFim:    d.vigencia_fim ?? null,
        prazoImplantacao: d.prazo_implantacao ?? null,
        status:         d.ativo ? 'ativo' : 'inativo',
        obrigatorio:    d.obrigatorio === undefined ? true : Boolean(d.obrigatorio),
        createdAt:      d.criado_em,
        updatedAt:      d.atualizado_em,
        unidade: d.unidade ? {
            id:    d.unidade.unidade_id,
            nome:  d.unidade.nome,
            sigla: d.unidade.sigla ?? null,
        } : undefined,
    };
}

// ── Conversão payload API → campos BD ────────────────────────────────────────
function fromPayload(p) {
    const m = {};
    if (p.unidadeId    !== undefined) m.unidade_id    = p.unidadeId;
    if (p.nome         !== undefined) m.nome          = p.nome;
    if (p.descricao    !== undefined) m.descricao     = p.descricao || null;
    if (p.tipo         !== undefined) m.tipo          = TIPO_TO_DB[p.tipo] ?? p.tipo;
    if (p.metaPadrao   !== undefined) m.peso_perc     = p.metaPadrao ?? 0;
    if (p.unidadeMedida !== undefined) m.unidade_medida = p.unidadeMedida || null;
    if (p.status       !== undefined) m.ativo         = p.status === 'ativo' ? 1 : 0;
    if (p.obrigatorio  !== undefined) m.obrigatorio   = p.obrigatorio ? 1 : 0;
    if (p.vigenciaInicio !== undefined) m.vigencia_inicio = p.vigenciaInicio || null;
    if (p.vigenciaFim !== undefined) m.vigencia_fim = p.vigenciaFim || null;
    if (p.prazoImplantacao !== undefined) m.prazo_implantacao = p.prazoImplantacao || null;
    return m;
}

// ── Gera código único para o campo obrigatório `codigo` ──────────────────────
function gerarCodigo() {
    const ts = Date.now().toString(36).toUpperCase();
    return `IND-${ts.slice(-8)}`;
}

// ── Include padrão ────────────────────────────────────────────────────────────
function buildIncludeUnidade(ossIdFiltro) {
    return [{
        model: db.unidade,
        as: 'unidade',
        attributes: ['unidade_id', 'nome', 'sigla'],
        required: Boolean(ossIdFiltro),
        include: ossIdFiltro ? [{
            model: db.contrato,
            as: 'contrato',
            required: true,
            attributes: [],
            where: { oss_id: ossIdFiltro },
        }] : [],
    }, {
        model: db.meta,
        as: 'metas',
        required: false,
    }];
}

// ─────────────────────────────────────────────────────────────────────────────

const listar = async (filtros = {}, ossIdFiltro = null) => {
    const where = {};

    // aceita unidadeId (camelCase, frontend) ou unidade_id (snake, legado)
    const uid = filtros.unidadeId ?? filtros.unidade_id;
    if (uid) where.unidade_id = uid;

    if (filtros.tipo) {
        const tipoDb = TIPO_TO_DB[filtros.tipo];
        where.tipo = tipoDb ?? filtros.tipo;
    }

    if (filtros.status !== undefined && filtros.status !== '') {
        where.ativo = filtros.status === 'ativo' ? 1 : 0;
    }

    if (filtros.grupo) where.grupo = filtros.grupo;

    // legado: incluir_inativos booleano
    if (!filtros.incluirInativos && !filtros.incluir_inativos && !filtros.status) {
        // padrão: retorna todos (ativos e inativos) quando sem filtro de status
    }

    const lista = await db.indicador.findAll({
        where,
        include: buildIncludeUnidade(ossIdFiltro),
        order: [['nome', 'ASC']],
    });
    return lista.map(toRecord);
};

const buscarPorId = async (id, ossIdFiltro = null) => {
    await assertIndicadorNoEscopoOSS(id, ossIdFiltro);
    const indicador = await db.indicador.findOne({
        where:   { indicador_id: id },
        include: buildIncludeUnidade(null),
    });
    if (!indicador) throw new ApiError(httpStatus.NOT_FOUND, 'Indicador não encontrado');
    return toRecord(indicador);
};

const criar = async (payload, ossIdFiltro = null) => {
    const dados = fromPayload(payload);

    if (!dados.unidade_id) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'unidadeId é obrigatório');
    }

    await assertUnidadeNoEscopoOSS(dados.unidade_id, ossIdFiltro);

    const unidade = await db.unidade.findOne({ where: { unidade_id: dados.unidade_id } });
    if (!unidade) throw new ApiError(httpStatus.NOT_FOUND, 'Unidade não encontrada');

    // Grava contrato + ano no indicador (derivados da unidade/vigência)
    dados.contrato_id = unidade.contrato_id;
    const contratoDoInd = await db.contrato.findOne({
        where: { contrato_id: unidade.contrato_id },
        attributes: ['data_inicio'],
    });
    const anoBase = dados.vigencia_inicio || contratoDoInd?.data_inicio;
    dados.ano = anoBase ? new Date(anoBase).getFullYear() : null;

    // Unicidade de nome por unidade
    const existente = await db.indicador.findOne({
        where: { nome: dados.nome, unidade_id: dados.unidade_id },
        paranoid: false,
    });
    if (existente) {
        throw new ApiError(httpStatus.CONFLICT, `Já existe um indicador com o nome "${dados.nome}" nesta unidade`);
    }

    // PK gerada no app (MySQL UUID() default não é retornado pelo Sequelize)
    dados.indicador_id  = randomUUID();
    // Defaults para campos obrigatórios do modelo complexo
    dados.codigo        = gerarCodigo();
    dados.grupo         = dados.grupo        || 'qualidade_atencao';
    dados.meta_tipo     = dados.meta_tipo    || 'maior_igual';
    dados.fonte_dados   = dados.fonte_dados  || 'Manual';
    dados.periodicidade = dados.periodicidade || 'mensal';
    if (dados.ativo      === undefined) dados.ativo      = 1;
    if (dados.peso_perc  === undefined) dados.peso_perc  = 0;

    const indicador = await db.indicador.create(dados);
    return toRecord(await db.indicador.findOne({
        where:   { indicador_id: indicador.indicador_id },
        include: buildIncludeUnidade(null),
    }));
};

const atualizar = async (id, payload, ossIdFiltro = null) => {
    await assertIndicadorNoEscopoOSS(id, ossIdFiltro);
    const indicador = await db.indicador.findOne({ where: { indicador_id: id } });
    if (!indicador) throw new ApiError(httpStatus.NOT_FOUND, 'Indicador não encontrado');

    const dados = fromPayload(payload);
    delete dados.unidade_id; // não permite trocar unidade via PUT

    if (dados.nome) {
        const existente = await db.indicador.findOne({
            where: {
                nome:         dados.nome,
                unidade_id:   indicador.unidade_id,
                indicador_id: { [Op.ne]: id },
            },
            paranoid: false,
        });
        if (existente) {
            throw new ApiError(httpStatus.CONFLICT, `Já existe um indicador com o nome "${dados.nome}" nesta unidade`);
        }
    }

    await indicador.update(dados);
    return toRecord(await db.indicador.findOne({
        where:   { indicador_id: id },
        include: buildIncludeUnidade(null),
    }));
};

const remover = async (id, ossIdFiltro = null) => {
    await assertIndicadorNoEscopoOSS(id, ossIdFiltro);
    const indicador = await db.indicador.findOne({ where: { indicador_id: id } });
    if (!indicador) throw new ApiError(httpStatus.NOT_FOUND, 'Indicador não encontrado');
    await indicador.destroy(); // soft delete (paranoid: true) — histórico preservado
};

// Código único (gerarCodigo é timestamp; em loop pode colidir) ─────────────────
async function gerarCodigoUnico() {
    for (let i = 0; i < 12; i += 1) {
        const code = `IND-${Date.now().toString(36).toUpperCase().slice(-6)}${Math.random().toString(36).toUpperCase().slice(2, 4)}`;
        // eslint-disable-next-line no-await-in-loop
        const ex = await db.indicador.findOne({ where: { codigo: code }, paranoid: false });
        if (!ex) return code;
    }
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Falha ao gerar código único de indicador');
}

// Clona metas de um indicador para outro, preservando hierarquia (agregada → componentes)
async function clonarMetas(metas, novoIndicadorId) {
    const idMap = {};
    // pais (sem parent) primeiro, para remapear parent_meta_id dos componentes
    const ordenadas = [...metas].sort((a, b) => ((a.parent_meta_id ? 1 : 0) - (b.parent_meta_id ? 1 : 0)));
    for (const m of ordenadas) {
        const mj = m.toJSON ? m.toJSON() : m;
        // eslint-disable-next-line no-await-in-loop
        const nova = await db.meta.create({
            meta_id: randomUUID(),
            indicador_id: novoIndicadorId,
            aditivo_id: null,
            versao: mj.versao || 1,
            meta_mensal: mj.meta_mensal,
            meta_anual: mj.meta_anual,
            meta_valor_qualit: mj.meta_valor_qualit,
            meta_tipo: mj.meta_tipo,
            meta_minima: mj.meta_minima,
            meta_parcial: mj.meta_parcial,
            unidade_medida: mj.unidade_medida,
            nome: mj.nome,
            observacoes: mj.observacoes,
            papel: mj.papel,
            peso: mj.peso,
            parent_meta_id: mj.parent_meta_id ? (idMap[mj.parent_meta_id] || null) : null,
        });
        idMap[mj.meta_id] = nova.meta_id;
    }
}

/**
 * Duplica indicadores ativos (+ metas) de uma unidade de ORIGEM para uma de DESTINO,
 * gravando o contrato/ano da unidade destino. Usado ao renovar contrato.
 */
const duplicarParaUnidade = async (origemUnidadeId, destinoUnidadeId, ossIdFiltro = null) => {
    if (!origemUnidadeId || !destinoUnidadeId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'origemUnidadeId e destinoUnidadeId são obrigatórios');
    }
    if (origemUnidadeId === destinoUnidadeId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Unidade de origem e destino devem ser diferentes');
    }
    await assertUnidadeNoEscopoOSS(origemUnidadeId, ossIdFiltro);
    await assertUnidadeNoEscopoOSS(destinoUnidadeId, ossIdFiltro);

    const destino = await db.unidade.findOne({ where: { unidade_id: destinoUnidadeId } });
    if (!destino) throw new ApiError(httpStatus.NOT_FOUND, 'Unidade de destino não encontrada');
    const contratoDest = await db.contrato.findOne({
        where: { contrato_id: destino.contrato_id },
        attributes: ['data_inicio'],
    });
    const anoDest = contratoDest?.data_inicio ? new Date(contratoDest.data_inicio).getFullYear() : null;

    const indicadores = await db.indicador.findAll({
        where: { unidade_id: origemUnidadeId, ativo: 1 },
        include: [{ model: db.meta, as: 'metas', required: false }],
    });

    const criados = [];
    const ignorados = [];
    for (const src of indicadores) {
        const s = src.toJSON();
        // eslint-disable-next-line no-await-in-loop
        const jaExiste = await db.indicador.findOne({
            where: { nome: s.nome, unidade_id: destinoUnidadeId },
            paranoid: false,
        });
        if (jaExiste) { ignorados.push(s.nome); continue; }

        // eslint-disable-next-line no-await-in-loop
        const codigo = await gerarCodigoUnico();
        // eslint-disable-next-line no-await-in-loop
        const novo = await db.indicador.create({
            indicador_id: randomUUID(),
            unidade_id: destinoUnidadeId,
            contrato_id: destino.contrato_id,
            ano: anoDest,
            bloco_id: null, // bloco pertence à unidade de origem; não copiar
            codigo,
            nome: s.nome,
            descricao: s.descricao,
            tipo: s.tipo,
            grupo: s.grupo,
            formula_calculo: s.formula_calculo,
            unidade_medida: s.unidade_medida,
            periodicidade: s.periodicidade,
            tipo_implantacao: s.tipo_implantacao,
            prazo_dias_impl: s.prazo_dias_impl,
            fonte_dados: s.fonte_dados,
            peso_perc: s.peso_perc,
            meta_tipo: s.meta_tipo,
            vigencia_inicio: s.vigencia_inicio,
            vigencia_fim: s.vigencia_fim,
            prazo_implantacao: s.prazo_implantacao,
            ativo: 1,
            obrigatorio: s.obrigatorio,
        });
        // eslint-disable-next-line no-await-in-loop
        await clonarMetas(src.metas || [], novo.indicador_id);
        criados.push(novo.indicador_id);
    }

    return { duplicados: criados.length, ignorados, indicadorIds: criados };
};

// Backward compat — usado pelo ciclo de acompanhamento mensal
const desativar = async (id, ossIdFiltro = null) => {
    await assertIndicadorNoEscopoOSS(id, ossIdFiltro);
    const indicador = await db.indicador.findOne({ where: { indicador_id: id } });
    if (!indicador) throw new ApiError(httpStatus.NOT_FOUND, 'Indicador não encontrado');
    await indicador.update({ ativo: 0 });
    return { message: 'Indicador desativado. Histórico preservado para auditoria.' };
};

module.exports = {
    listar, buscarPorId, criar, atualizar, remover, desativar, duplicarParaUnidade,
};
