const Joi = require('joi');

const criarMeta = Joi.object({
    indicador_id: Joi.string().uuid().required(),
    vigencia_inicio: Joi.date().iso().required(),
    vigencia_fim: Joi.date().iso().optional().allow(null),
    meta_mensal: Joi.number().min(0).optional().allow(null),
    meta_anual: Joi.number().min(0).optional().allow(null),
    meta_valor_qualit: Joi.number().min(0).optional().allow(null),
    meta_minima: Joi.number().min(0).optional().allow(null),
    meta_parcial: Joi.number().min(0).optional().allow(null),
    unidade_medida: Joi.string().max(50).optional().allow('', null),
    observacoes: Joi.string().optional().allow('', null),
    prazo_implantacao: Joi.date().iso().optional().allow(null),
    aditivo_id: Joi.string().uuid().optional().allow(null),
}).or('meta_mensal', 'meta_anual', 'meta_valor_qualit');

const atualizarMeta = Joi.object({
    vigencia_fim: Joi.date().iso().optional().allow(null),
    meta_mensal: Joi.number().min(0).optional().allow(null),
    meta_anual: Joi.number().min(0).optional().allow(null),
    meta_valor_qualit: Joi.number().min(0).optional().allow(null),
    meta_minima: Joi.number().min(0).optional().allow(null),
    meta_parcial: Joi.number().min(0).optional().allow(null),
    unidade_medida: Joi.string().max(50).optional().allow('', null),
    observacoes: Joi.string().optional().allow('', null),
}).min(1);

module.exports = { criarMeta, atualizarMeta };
