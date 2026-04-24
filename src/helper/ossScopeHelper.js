const httpStatus = require('http-status');
const ApiError = require('./ApiError');
const db = require('../models');

/**
 * Quando a permissão do módulo (req.permissaoAtual) tem escopo `proprio`, retorna o oss_id do usuário.
 * Caso contrário retorna null (visão global).
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function getOssIdSeEscopoProprio(req) {
    const perm = req.permissaoAtual;
    if (!perm) return null;
    const escopo = typeof perm.escopo === 'string'
        ? perm.escopo
        : perm.get?.('escopo') ?? perm.dataValues?.escopo;
    if (escopo !== 'proprio') return null;
    const ossId = req.user?.oss_id ?? req.user?.dataValues?.oss_id;
    if (!ossId) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Perfil contratada sem OSS vinculada.');
    }
    return ossId;
}

async function assertContratoNoEscopoOSS(contratoId, ossIdFiltro) {
    if (!ossIdFiltro || !contratoId) return;
    const c = await db.contrato.findOne({ where: { contrato_id: contratoId }, attributes: ['oss_id'] });
    if (!c || c.oss_id !== ossIdFiltro) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Contrato não encontrado');
    }
}

async function assertUnidadeNoEscopoOSS(unidadeId, ossIdFiltro) {
    if (!ossIdFiltro || !unidadeId) return;
    const u = await db.unidade.findOne({
        where: { unidade_id: unidadeId },
        include: [{ model: db.contrato, as: 'contrato', attributes: ['oss_id'] }],
    });
    if (!u || !u.contrato || u.contrato.oss_id !== ossIdFiltro) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Unidade não encontrada');
    }
}

async function assertIndicadorNoEscopoOSS(indicadorId, ossIdFiltro) {
    if (!ossIdFiltro || !indicadorId) return;
    const ind = await db.indicador.findOne({
        where: { indicador_id: indicadorId },
        include: [{
            model: db.unidade,
            as: 'unidade',
            required: true,
            include: [{ model: db.contrato, as: 'contrato', required: true, attributes: ['oss_id'] }],
        }],
    });
    if (!ind || !ind.unidade?.contrato || ind.unidade.contrato.oss_id !== ossIdFiltro) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Indicador não encontrado');
    }
}

async function assertMetaNoEscopoOSS(metaId, ossIdFiltro) {
    if (!ossIdFiltro || !metaId) return;
    const meta = await db.meta.findOne({
        where: { meta_id: metaId },
        include: [{
            model: db.indicador,
            as: 'indicador',
            required: true,
            include: [{
                model: db.unidade,
                as: 'unidade',
                required: true,
                include: [{ model: db.contrato, as: 'contrato', required: true, attributes: ['oss_id'] }],
            }],
        }],
    });
    if (!meta || !meta.indicador?.unidade?.contrato || meta.indicador.unidade.contrato.oss_id !== ossIdFiltro) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Meta não encontrada');
    }
}

async function assertAcompanhamentoNoEscopoOSS(acompId, ossIdFiltro) {
    if (!ossIdFiltro || !acompId) return;
    const a = await db.acompanhamento_mensal.findOne({
        where: { acomp_id: acompId },
        include: [{
            model: db.indicador,
            as: 'indicador',
            required: true,
            include: [{
                model: db.unidade,
                as: 'unidade',
                required: true,
                include: [{ model: db.contrato, as: 'contrato', required: true, attributes: ['oss_id'] }],
            }],
        }],
    });
    if (!a || !a.indicador?.unidade?.contrato || a.indicador.unidade.contrato.oss_id !== ossIdFiltro) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Acompanhamento não encontrado');
    }
}

async function assertDescontoBlocoNoEscopoOSS(descBlocoId, ossIdFiltro) {
    if (!ossIdFiltro || !descBlocoId) return;
    const row = await db.desconto_bloco.findOne({
        where: { desc_bloco_id: descBlocoId },
        include: [{
            model: db.repasse_mensal,
            as: 'repasse',
            required: true,
            include: [{ model: db.contrato, as: 'contrato', required: true, attributes: ['oss_id'] }],
        }],
    });
    if (!row || !row.repasse?.contrato || row.repasse.contrato.oss_id !== ossIdFiltro) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Desconto de bloco não encontrado');
    }
}

/**
 * Com escopo `proprio`, valida contratoId ou escolhe o único contrato ativo da OSS.
 * Sem escopo, devolve contratoId inalterado (pode ser undefined).
 */
async function resolverContratoIdParaEscopoProprio(contratoId, ossIdFiltro) {
    if (!ossIdFiltro) return contratoId;
    if (contratoId) {
        await assertContratoNoEscopoOSS(contratoId, ossIdFiltro);
        return contratoId;
    }
    const rows = await db.contrato.findAll({
        where: { oss_id: ossIdFiltro, status: 'Ativo' },
        attributes: ['contrato_id'],
        order: [['criado_em', 'DESC']],
        limit: 2,
    });
    if (rows.length === 0) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Nenhum contrato ativo para esta OSS');
    }
    if (rows.length > 1) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            'Informe contrato_id: há mais de um contrato ativo para esta OSS.',
        );
    }
    return rows[0].contrato_id;
}

module.exports = {
    getOssIdSeEscopoProprio,
    assertContratoNoEscopoOSS,
    assertUnidadeNoEscopoOSS,
    assertIndicadorNoEscopoOSS,
    assertMetaNoEscopoOSS,
    assertAcompanhamentoNoEscopoOSS,
    assertDescontoBlocoNoEscopoOSS,
    resolverContratoIdParaEscopoProprio,
};
