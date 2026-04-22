const httpStatus = require('http-status');
const ApiError = require('../helper/ApiError');
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

const listar = async () => {
    const contratos = await db.contrato.findAll({
        include: [
            INCLUDE_ORG,
            { model: db.unidade, as: 'unidades', attributes: ['unidade_id', 'nome', 'sigla', 'tipo', 'ativa'] },
        ],
        order: [['criado_em', 'DESC']],
    });
    return contratos.map(toRecord);
};

const buscarPorId = async (contratoId) => {
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

const criar = async (payload) => {
    const dados = fromPayload(payload);

    // Defaults obrigatórios ausentes no form simplificado do frontend
    if (!dados.tipo)                 dados.tipo = 'contrato_gestao';
    if (!dados.modelo_desconto_qual) dados.modelo_desconto_qual = 'flat';

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

const atualizar = async (contratoId, payload) => {
    const contrato = await db.contrato.findOne({ where: { contrato_id: contratoId } });
    if (!contrato) throw new ApiError(httpStatus.NOT_FOUND, 'Contrato não encontrado');

    const dados = fromPayload(payload);
    await contrato.update(dados);

    const updated = await db.contrato.findOne({
        where: { contrato_id: contratoId },
        include: [INCLUDE_ORG],
    });
    return toRecord(updated);
};

const adicionarAditivo = async (contratoId, dadosAditivo) => {
    const contrato = await db.contrato.findOne({ where: { contrato_id: contratoId } });
    if (!contrato) throw new ApiError(httpStatus.NOT_FOUND, 'Contrato não encontrado');

    const aditivo = await db.aditivo.create({ ...dadosAditivo, contrato_id: contratoId });
    await contrato.increment('numero_aditivos');
    return aditivo;
};

const aplicarAditivo = async (aditivoId) => {
    await db.sequelize.query('CALL sp_aplicar_aditivo(:aditivo_id)', {
        replacements: { aditivo_id: aditivoId },
    });
    return db.aditivo.findOne({ where: { aditivo_id: aditivoId } });
};

module.exports = { listar, buscarPorId, criar, atualizar, adicionarAditivo, aplicarAditivo };
