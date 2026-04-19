const httpStatus = require('http-status');
const ApiError = require('../helper/ApiError');
const db = require('../models');

const listar = async () => {
    return db.contrato.findAll({
        include: [
            { model: db.oss, as: 'organizacao', attributes: ['oss_id', 'nome', 'cnpj'] },
            { model: db.unidade, as: 'unidades', attributes: ['unidade_id', 'nome', 'sigla', 'tipo', 'ativa'] },
        ],
        order: [['criado_em', 'DESC']],
    });
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
    return contrato;
};

const criar = async (dados) => {
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

    return contrato;
};

const atualizar = async (contratoId, dados) => {
    const contrato = await db.contrato.findOne({ where: { contrato_id: contratoId } });
    if (!contrato) throw new ApiError(httpStatus.NOT_FOUND, 'Contrato não encontrado');

    await contrato.update(dados);
    return contrato.reload();
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
