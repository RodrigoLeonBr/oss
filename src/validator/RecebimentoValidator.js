const Joi = require('joi');

const ID = () => Joi.string().pattern(/^[0-9A-Za-z]{8}-[0-9A-Za-z]{4}-[0-9A-Za-z]{4}-[0-9A-Za-z]{4}-[0-9A-Za-z]{12}$/);

const consultarRecebimento = Joi.object({
    contratoId: ID().required(),
    mes: Joi.string()
        .pattern(/^\d{4}-\d{2}$/)
        .required()
        .messages({ 'string.pattern.base': 'mes deve estar no formato YYYY-MM' }),
});

const criarNota = Joi.object({
    descricao: Joi.string().min(3).max(5000).required(),
    causa_raiz: Joi.string().max(5000).optional().allow('', null),
    acao_corretiva: Joi.string().max(5000).optional().allow('', null),
    previsao_normalizacao: Joi.date().iso().optional().allow(null),
});

const validarNota = Joi.object({
    status_validacao: Joi.string().valid('aceita', 'rejeitada').required(),
    alcance_considerado: Joi.number().min(0).max(100).optional().allow(null),
    motivo_rejeicao_nota: Joi.string().max(5000).optional().allow('', null),
});

module.exports = { consultarRecebimento, criarNota, validarNota };
