const Joi = require('joi');

const criarAcompanhamento = Joi.object({
    indicador_id: Joi.string().uuid().required(),
    meta_id: Joi.string().uuid().required(),
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
    unidade_id: Joi.string().uuid().optional(),
    indicador_id: Joi.string().uuid().optional(),
    status: Joi.string().valid('cumprido', 'parcial', 'nao_cumprido', 'nao_aplicavel', 'aguardando').optional(),
    status_aprovacao: Joi.string().valid('rascunho', 'submetido', 'aprovado', 'rejeitado').optional(),
});

module.exports = { criarAcompanhamento, aprovarAcompanhamento, listarAcompanhamentos };
