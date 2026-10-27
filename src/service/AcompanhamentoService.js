const httpStatus = require('http-status');
const AcompanhamentoDao = require('../dao/AcompanhamentoDao');
const ApiError = require('../helper/ApiError');
const {
    assertIndicadorNoEscopoOSS,
    assertMetaNoEscopoOSS,
    assertAcompanhamentoNoEscopoOSS,
    resolverContratoIdParaEscopoProprio,
} = require('../helper/ossScopeHelper');
const db = require('../models');
const logger = require('../config/logger');
const { nivelCumprimento, faixasEfetivas } = require('../helper/avaliacaoCumprimento');
const { baseMetaReferencia, absFromPercentualBase } = require('../helper/metaValoresAlvo');

const acompanhamentoDao = new AcompanhamentoDao();

// Avalia o percentual segundo direção + faixas da meta (padrões 100/85 maior, 100/115 menor).
// `meta` pode ser a meta vigente ou o próprio acomp (tem meta_tipo_snap/meta_minima/meta_parcial).
const calcularStatusCumprimento = (percentual, meta = null) =>
    nivelCumprimento(percentual, faixasEfetivas(meta));

const calcularFaixaProducao = (percentual) => {
    if (percentual === null || percentual === undefined) return null;
    if (percentual >= 100) return 'acima_meta';
    if (percentual >= 85) return 'entre_85_100';
    if (percentual >= 70) return 'entre_70_84';
    return 'abaixo_70';
};

const obterMetaVigente = async (indicadorId, mesReferencia) => {
    return db.meta.findOne({
        where: {
            indicador_id: indicadorId,
        },
        order: [['versao', 'DESC'], ['criado_em', 'DESC']],
    });
};

const criarOuAtualizar = async (dados, usuarioId, ossIdFiltro = null) => {
    const { indicador_id, meta_id, mes_referencia, valor_realizado, descricao_desvios, meta_vigente_mensal, meta_vigente_qualit } = dados;

    await assertIndicadorNoEscopoOSS(indicador_id, ossIdFiltro);

    const indicador = await db.indicador.findOne({ where: { indicador_id }, paranoid: false });
    if (!indicador) throw new ApiError(httpStatus.NOT_FOUND, 'Indicador não encontrado');

    const meta = await db.meta.findOne({ where: { meta_id } });
    if (!meta) throw new ApiError(httpStatus.NOT_FOUND, 'Meta não encontrada');
    if (meta.papel === 'agregada') {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            'Use metas componentes; meta agregada não recebe acompanhamento.',
        );
    }
    await assertMetaNoEscopoOSS(meta_id, ossIdFiltro);

    const metaMensal = meta_vigente_mensal || parseFloat(meta.meta_mensal) || 0;
    const metaQualit = meta_vigente_qualit || parseFloat(meta.meta_valor_qualit) || 0;
    // Quantitativo mede contra a meta mensal; qualitativo contra a meta qualitativa
    const metaBase = metaMensal > 0 ? metaMensal : metaQualit;
    const percentual = metaBase > 0 ? parseFloat(((valor_realizado / metaBase) * 100).toFixed(4)) : null;

    const payload = {
        indicador_id,
        meta_id,
        mes_referencia,
        meta_vigente_mensal: metaMensal || null,
        meta_vigente_qualit: meta_vigente_qualit || parseFloat(meta.meta_valor_qualit) || null,
        valor_realizado: parseFloat(valor_realizado),
        status_cumprimento: calcularStatusCumprimento(percentual, meta),
        faixa_producao: calcularFaixaProducao(percentual),
        descricao_desvios: descricao_desvios || null,
        preenchido_por: usuarioId,
        data_preenchimento: new Date(),
        status_aprovacao: 'submetido',
    };

    const existente = await acompanhamentoDao.findByMesEIndicador(
        mes_referencia,
        indicador_id,
        meta_id,
    );
    if (existente) {
        await existente.update(payload);
        return existente.reload();
    }

    return acompanhamentoDao.create(payload);
};

const aprovar = async (acompId, auditoraId, ossIdFiltro = null) => {
    await assertAcompanhamentoNoEscopoOSS(acompId, ossIdFiltro);
    const registro = await db.acompanhamento_mensal.findOne({ where: { acomp_id: acompId } });
    if (!registro) throw new ApiError(httpStatus.NOT_FOUND, 'Acompanhamento não encontrado');

    await registro.update({
        status_aprovacao: 'aprovado',
        aprovado_por: auditoraId,
        data_aprovacao: new Date(),
    });

    return registro.reload();
};

const rejeitar = async (acompId, auditoraId, motivo, ossIdFiltro = null) => {
    await assertAcompanhamentoNoEscopoOSS(acompId, ossIdFiltro);
    const registro = await db.acompanhamento_mensal.findOne({ where: { acomp_id: acompId } });
    if (!registro) throw new ApiError(httpStatus.NOT_FOUND, 'Acompanhamento não encontrado');

    await registro.update({
        status_aprovacao: 'rejeitado',
        aprovado_por: auditoraId,
        data_aprovacao: new Date(),
        motivo_rejeicao: motivo,
    });

    return registro.reload();
};

const revogar = async (acompId, ossIdFiltro = null) => {
    await assertAcompanhamentoNoEscopoOSS(acompId, ossIdFiltro);
    const registro = await db.acompanhamento_mensal.findOne({ where: { acomp_id: acompId } });
    if (!registro) throw new ApiError(httpStatus.NOT_FOUND, 'Acompanhamento não encontrado');

    await registro.update({
        status_aprovacao: 'submetido',
        aprovado_por: null,
        data_aprovacao: null,
        motivo_rejeicao: null,
    });

    return registro.reload();
};

const calcularDescontosDoMes = async (mesReferencia, contratoId, ossIdFiltro = null) => {
    logger.info(`[DESCONTO] Iniciando cálculo para ${mesReferencia}`);

    const cid = await resolverContratoIdParaEscopoProprio(contratoId, ossIdFiltro);

    const contrato = await db.contrato.findOne({
        where: { contrato_id: cid || undefined, status: 'Ativo' },
        include: [{ model: db.unidade, as: 'unidades', include: [{ model: db.bloco_producao, as: 'blocos' }] }],
    });
    if (!contrato) {
        logger.warn('[DESCONTO] Nenhum contrato ativo encontrado');
        return { descontosBloco: [], descontosIndicador: [], totalDesconto: 0 };
    }

    const historico = await db.historico_contrato.findOne({
        where: { contrato_id: contrato.contrato_id, vigencia_fim: null },
        order: [['versao', 'DESC']],
    });
    if (!historico) throw new ApiError(httpStatus.NOT_FOUND, 'Histórico de contrato vigente não encontrado');

    const valorBase = parseFloat(contrato.valor_mensal_base);
    const percVariavel = parseFloat(contrato.perc_variavel) / 100;
    const valorVariavel = valorBase * percVariavel;

    let repasse = await db.repasse_mensal.findOne({
        where: { contrato_id: contrato.contrato_id, mes_referencia: mesReferencia },
    });

    if (!repasse) {
        repasse = await db.repasse_mensal.create({
            contrato_id: contrato.contrato_id,
            historico_contrato_id: historico.historico_id,
            mes_referencia: mesReferencia,
            valor_mensal_base: valorBase,
            parcela_fixa: valorBase * (parseFloat(contrato.perc_fixo) / 100),
            parcela_variavel: valorVariavel,
            calculado_em: new Date(),
        });
    }

    await db.desconto_bloco.destroy({ where: { repasse_id: repasse.repasse_id } });
    await db.desconto_indicador.destroy({ where: { repasse_id: repasse.repasse_id } });

    const descontosBloco = [];
    const descontosIndicador = [];
    let totalProducao = 0;
    let totalQualidade = 0;

    for (const unidade of contrato.unidades) {
        for (const bloco of unidade.blocos) {
            const acomps = await db.acompanhamento_mensal.findAll({
                where: { mes_referencia: mesReferencia, status_aprovacao: 'aprovado' },
                include: [{ model: db.indicador, as: 'indicador', where: { bloco_id: bloco.bloco_id, tipo: 'quantitativo' } }],
            });

            if (acomps.length === 0) continue;

            const totalMeta = acomps.reduce((s, a) => s + parseFloat(a.meta_vigente_mensal || 0), 0);
            const totalRealizado = acomps.reduce((s, a) => s + parseFloat(a.valor_realizado || 0), 0);
            const percAtingimento = totalMeta > 0 ? (totalRealizado / totalMeta) * 100 : 100;

            let percDesconto = 0;
            let faixa = 'acima_meta';
            if (percAtingimento < 70) { percDesconto = 30; faixa = 'abaixo_70'; }
            else if (percAtingimento < 85) { percDesconto = 10; faixa = 'entre_70_84'; }
            else if (percAtingimento < 100) { faixa = 'entre_85_100'; }

            const valorDesconto = parseFloat(bloco.valor_mensal_alocado) * (percDesconto / 100);

            if (percDesconto > 0) {
                const desc = await db.desconto_bloco.create({
                    repasse_id: repasse.repasse_id,
                    bloco_id: bloco.bloco_id,
                    mes_referencia: mesReferencia,
                    meta_mensal: totalMeta,
                    valor_realizado: totalRealizado,
                    percentual_atingimento: percAtingimento,
                    faixa,
                    orcamento_bloco: bloco.valor_mensal_alocado,
                    percentual_desconto: percDesconto,
                    valor_desconto: valorDesconto,
                });
                descontosBloco.push(desc);
                totalProducao += valorDesconto;
            }
        }
    }

    const qualidadeNaoCumpridos = await db.acompanhamento_mensal.findAll({
        where: { mes_referencia: mesReferencia, status_cumprimento: 'nao_cumprido', status_aprovacao: 'aprovado' },
        include: [{
            model: db.indicador,
            as: 'indicador',
            where: { tipo: 'qualitativo', unidade_id: contrato.unidades.map((u) => u.unidade_id) },
        }],
    });

    const modeloDesconto = contrato.modelo_desconto_qual;

    for (const acomp of qualidadeNaoCumpridos) {
        let percDesconto;
        let valorDesconto;

        if (modeloDesconto === 'flat') {
            percDesconto = 1.00;
            valorDesconto = valorVariavel * 0.01;
        } else {
            const peso = parseFloat(acomp.indicador.peso_perc) || 0;
            percDesconto = peso;
            valorDesconto = valorVariavel * (peso / 100);
        }

        const desc = await db.desconto_indicador.create({
            repasse_id: repasse.repasse_id,
            acomp_id: acomp.acomp_id,
            indicador_id: acomp.indicador_id,
            mes_referencia: mesReferencia,
            modelo_desconto: modeloDesconto,
            peso_indicador: acomp.indicador.peso_perc,
            percentual_desconto: percDesconto,
            valor_desconto: valorDesconto,
        });
        descontosIndicador.push(desc);
        totalQualidade += valorDesconto;
    }

    await repasse.update({
        desconto_producao_total: totalProducao,
        desconto_qualidade_total: totalQualidade,
    });

    const totalDesconto = totalProducao + totalQualidade;
    logger.info(`[DESCONTO] ${mesReferencia}: blocos=${descontosBloco.length}, indicadores=${descontosIndicador.length}. Total R$ ${totalDesconto.toFixed(2)}`);

    return { repasse: await repasse.reload(), descontosBloco, descontosIndicador, totalDesconto };
};

const calcularRepasse = async (mesReferencia, contratoId, ossIdFiltro = null) => {
    const cid = await resolverContratoIdParaEscopoProprio(contratoId, ossIdFiltro);
    const repasse = await db.repasse_mensal.findOne({
        where: { mes_referencia: mesReferencia, ...(cid && { contrato_id: cid }) },
        include: [
            { model: db.desconto_bloco, as: 'descontos_bloco', include: [{ model: db.bloco_producao, as: 'bloco' }] },
            { model: db.desconto_indicador, as: 'descontos_indicador', include: [{ model: db.indicador, as: 'indicador' }] },
            { model: db.contrato, as: 'contrato' },
        ],
    });

    if (!repasse) throw new ApiError(httpStatus.NOT_FOUND, 'Repasse não encontrado para este mês');
    return repasse;
};

/**
 * Reavalia (vivo) o status_cumprimento de todos os acompanhamentos de uma meta
 * com a config ATUAL (direção + faixas) e re-snapshota os limites absolutos.
 * Chamar após criar/editar meta.
 * @returns {Promise<number>} nº de acompanhamentos atualizados
 */
const recomputarStatusDaMeta = async (metaId) => {
    const meta = await db.meta.findOne({ where: { meta_id: metaId } });
    if (!meta) return 0;
    const acomps = await db.acompanhamento_mensal.findAll({ where: { meta_id: metaId } });
    const base = baseMetaReferencia(meta);
    const minAbs = absFromPercentualBase(base, meta.meta_minima);
    const parAbs = absFromPercentualBase(base, meta.meta_parcial);
    for (const a of acomps) {
        const b = a.meta_vigente_mensal != null ? parseFloat(a.meta_vigente_mensal)
            : (a.meta_vigente_qualit != null ? parseFloat(a.meta_vigente_qualit) : null);
        const real = a.valor_realizado != null ? parseFloat(a.valor_realizado) : null;
        const pct = (b && b > 0 && real != null) ? parseFloat(((real / b) * 100).toFixed(4)) : null;
        // eslint-disable-next-line no-await-in-loop
        await a.update({
            status_cumprimento: calcularStatusCumprimento(pct, meta),
            meta_tipo_snap: meta.meta_tipo || 'maior_igual',
            meta_minima: minAbs,
            meta_parcial: parAbs,
        });
    }
    return acomps.length;
};

module.exports = {
    criarOuAtualizar,
    aprovar,
    rejeitar,
    revogar,
    calcularDescontosDoMes,
    calcularRepasse,
    obterMetaVigente,
    calcularStatusCumprimento,
    calcularFaixaProducao,
    recomputarStatusDaMeta,
};
