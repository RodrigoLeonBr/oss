const httpStatus = require('http-status');
const ApiError = require('../helper/ApiError');
const { assertContratoNoEscopoOSS } = require('../helper/ossScopeHelper');
const db = require('../models');

// Serializa Sequelize → formato camelCase esperado pelo frontend
function toRecord(c) {
    const d = c.toJSON ? c.toJSON() : c;
    const org = d.organizacao;
    return {
        id: d.contrato_id,
        ossId: d.oss_id,
        numeroContrato: d.numero,
        periodoInicio: d.data_inicio,
        periodoFim: d.data_fim,
        valorMensal: d.valor_mensal_base ? parseFloat(d.valor_mensal_base) : 0,
        percentualDesconto: null,
        status: (d.status || '').toLowerCase(),
        createdAt: d.criado_em,
        updatedAt: d.atualizado_em,
        oss: org ? { id: org.oss_id, nome: org.nome, cnpj: org.cnpj } : undefined,
    };
}

// Converte payload camelCase do frontend → campos snake_case do modelo
function fromPayload(p) {
    const m = {};
    if (p.ossId !== undefined)          m.oss_id = p.ossId;
    if (p.numeroContrato !== undefined) m.numero = p.numeroContrato;
    if (p.periodoInicio !== undefined)  m.data_inicio = p.periodoInicio;
    if (p.periodoFim !== undefined)     m.data_fim = p.periodoFim;
    if (p.valorMensal !== undefined)    m.valor_mensal_base = p.valorMensal;
    if (p.status !== undefined) {
        m.status = p.status.charAt(0).toUpperCase() + p.status.slice(1).toLowerCase();
    }
    if (p.tipo !== undefined)                 m.tipo = p.tipo;
    if (p.modelo_desconto_qual !== undefined) m.modelo_desconto_qual = p.modelo_desconto_qual;
    return m;
}

const INCLUDE_ORG = { model: db.oss, as: 'organizacao', attributes: ['oss_id', 'nome', 'cnpj'] };

const listar = async (ossIdFiltro = null) => {
    const where = ossIdFiltro ? { oss_id: ossIdFiltro } : {};
    const contratos = await db.contrato.findAll({
        where,
        include: [
            INCLUDE_ORG,
            { model: db.unidade, as: 'unidades', attributes: ['unidade_id', 'nome', 'sigla', 'tipo', 'ativa'] },
        ],
        order: [['criado_em', 'DESC']],
    });
    return contratos.map(toRecord);
};

const buscarPorId = async (contratoId, ossIdFiltro = null) => {
    await assertContratoNoEscopoOSS(contratoId, ossIdFiltro);
    const contrato = await db.contrato.findOne({
        where: { contrato_id: contratoId },
        include: [
            { model: db.oss, as: 'organizacao' },
            { model: db.unidade, as: 'unidades', include: [{ model: db.bloco_producao, as: 'blocos' }] },
            { model: db.aditivo, as: 'aditivos', order: [['numero_aditivo', 'DESC']] },
            { model: db.historico_contrato, as: 'historico', order: [['versao', 'DESC']] },
            { model: db.repasse_mensal, as: 'repasses', order: [['mes_referencia', 'DESC']], limit: 6 },
        ],
    });
    if (!contrato) throw new ApiError(httpStatus.NOT_FOUND, 'Contrato não encontrado');
    return toRecord(contrato);
};

const criar = async (payload, ossIdFiltro = null) => {
    const dados = fromPayload(payload);

    // Defaults obrigatórios ausentes no form simplificado do frontend
    if (!dados.tipo)                 dados.tipo = 'contrato_gestao';
    if (!dados.modelo_desconto_qual) dados.modelo_desconto_qual = 'flat';

    if (ossIdFiltro) {
        dados.oss_id = ossIdFiltro;
    }

    if (!dados.numero) throw new ApiError(httpStatus.BAD_REQUEST, 'Número do contrato é obrigatório');

    const existente = await db.contrato.findOne({ where: { numero: dados.numero } });
    if (existente) throw new ApiError(httpStatus.CONFLICT, `Já existe contrato com número '${dados.numero}'`);

    const contrato = await db.contrato.create(dados);

    await db.historico_contrato.create({
        contrato_id: contrato.contrato_id,
        versao: 1,
        vigencia_inicio: contrato.data_inicio,
        valor_mensal_base: contrato.valor_mensal_base,
        perc_fixo: contrato.perc_fixo,
        perc_variavel: contrato.perc_variavel,
        modelo_desconto_qual: contrato.modelo_desconto_qual,
        motivo_versao: 'Versão inicial do contrato',
    });

    const created = await db.contrato.findOne({
        where: { contrato_id: contrato.contrato_id },
        include: [INCLUDE_ORG],
    });
    return toRecord(created);
};

const atualizar = async (contratoId, payload, ossIdFiltro = null) => {
    await assertContratoNoEscopoOSS(contratoId, ossIdFiltro);
    const contrato = await db.contrato.findOne({ where: { contrato_id: contratoId } });
    if (!contrato) throw new ApiError(httpStatus.NOT_FOUND, 'Contrato não encontrado');

    const dados = fromPayload(payload);
    if (ossIdFiltro && dados.oss_id !== undefined && dados.oss_id !== ossIdFiltro) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Não é permitido alterar a OSS do contrato.');
    }
    await contrato.update(dados);

    const updated = await db.contrato.findOne({
        where: { contrato_id: contratoId },
        include: [INCLUDE_ORG],
    });
    return toRecord(updated);
};

const adicionarAditivo = async (contratoId, dadosAditivo, ossIdFiltro = null) => {
    await assertContratoNoEscopoOSS(contratoId, ossIdFiltro);
    const contrato = await db.contrato.findOne({ where: { contrato_id: contratoId } });
    if (!contrato) throw new ApiError(httpStatus.NOT_FOUND, 'Contrato não encontrado');

    const aditivo = await db.aditivo.create({ ...dadosAditivo, contrato_id: contratoId });
    await contrato.increment('numero_aditivos');
    return aditivo;
};

const aplicarAditivo = async (aditivoId, ossIdFiltro = null) => {
    if (ossIdFiltro) {
        const ad = await db.aditivo.findOne({ where: { aditivo_id: aditivoId }, attributes: ['contrato_id'] });
        if (!ad) throw new ApiError(httpStatus.NOT_FOUND, 'Aditivo não encontrado');
        await assertContratoNoEscopoOSS(ad.contrato_id, ossIdFiltro);
    }
    await db.sequelize.query('CALL sp_aplicar_aditivo(:aditivo_id)', {
        replacements: { aditivo_id: aditivoId },
    });
    return db.aditivo.findOne({ where: { aditivo_id: aditivoId } });
};

const excluir = async (contratoId, ossIdFiltro = null) => {
    await assertContratoNoEscopoOSS(contratoId, ossIdFiltro);
    const contrato = await db.contrato.findOne({ where: { contrato_id: contratoId } });
    if (!contrato) throw new ApiError(httpStatus.NOT_FOUND, 'Contrato não encontrado');

    const totalUnidades = await db.unidade.count({ where: { contrato_id: contratoId } });
    if (totalUnidades > 0) {
        throw new ApiError(
            httpStatus.CONFLICT,
            `Não é possível excluir: o contrato possui ${totalUnidades} unidade(s) vinculada(s). Remova ou transfira as unidades antes.`,
        );
    }

    await contrato.destroy();
};

module.exports = { listar, buscarPorId, criar, atualizar, adicionarAditivo, aplicarAditivo, excluir };
