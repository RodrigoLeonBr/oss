const Joi = require('joi');

const listarAcompanhamentos = Joi.object({
  unidadeId:     Joi.string().uuid().required()
                   .messages({ 'any.required': 'unidadeId é obrigatório' }),
  mesReferencia: Joi.string().pattern(/^\d{4}-\d{2}-01$/).optional()
                   .messages({ 'string.pattern.base': 'mesReferencia deve estar no formato YYYY-MM-01' }),
});

const criarAcompanhamento = Joi.object({
  indicadorId:    Joi.string().uuid().required()
                    .messages({ 'any.required': 'indicadorId é obrigatório' }),
  mesReferencia:  Joi.string().pattern(/^\d{4}-\d{2}-01$/).required()
                    .messages({
                      'any.required': 'mesReferencia é obrigatório',
                      'string.pattern.base': 'mesReferencia deve estar no formato YYYY-MM-01',
                    }),
  valorRealizado: Joi.number().min(0).required()
                    .messages({ 'any.required': 'valorRealizado é obrigatório' }),
  descricaoDesvios: Joi.string().max(2000).optional().allow('', null),
});

const atualizarAcompanhamento = Joi.object({
  valorRealizado:   Joi.number().min(0).required(),
  descricaoDesvios: Joi.string().max(2000).optional().allow('', null),
});

module.exports = { listarAcompanhamentos, criarAcompanhamento, atualizarAcompanhamento };
