const Joi = require('joi');

// IDs do seed não são GUID hex; aceita formato 8-4-4-4-12 alfanumérico + UUID real
const ID = () => Joi.string().pattern(/^[0-9A-Za-z]{8}-[0-9A-Za-z]{4}-[0-9A-Za-z]{4}-[0-9A-Za-z]{4}-[0-9A-Za-z]{12}$/);

const criarAcompanhamento = Joi.object({
    indicador_id: ID().required(),
    meta_id: ID().required(),
    mes_referencia: Joi.string()
        .pattern(/^\d{4}-\d{2}-01$/)
        .required()
        .messages({ 'string.pattern.base': 'mes_referencia deve estar no formato YYYY-MM-01' }),
    meta_vigente_mensal: Joi.number().min(0).optional().allow(null),
    meta_vigente_qualit: Joi.number().min(0).optional().allow(null),
    valor_realizado: Joi.number().min(0).required().messages({ 'number.min': 'valor_realizado não pode ser negativo' }),
    descricao_desvios: Joi.string().max(2000).optional().allow('', null),
});

const aprovarAcompanhamento = Joi.object({
    motivo_rejeicao: Joi.string().max(2000).optional().allow('', null),
});

const listarAcompanhamentos = Joi.object({
    mes: Joi.string().pattern(/^\d{4}-\d{2}-01$/).optional(),
    unidade_id: ID().optional(),
    indicador_id: ID().optional(),
    status: Joi.string().valid('cumprido', 'parcial', 'nao_cumprido', 'nao_aplicavel', 'aguardando').optional(),
    status_aprovacao: Joi.string().valid('rascunho', 'submetido', 'aprovado', 'rejeitado').optional(),
});

module.exports = { criarAcompanhamento, aprovarAcompanhamento, listarAcompanhamentos };
