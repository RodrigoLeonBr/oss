const Joi = require('joi');

// IDs do seed não são GUID hex; aceita formato 8-4-4-4-12 alfanumérico + UUID real
const ID = () => Joi.string().pattern(/^[0-9A-Za-z]{8}-[0-9A-Za-z]{4}-[0-9A-Za-z]{4}-[0-9A-Za-z]{4}-[0-9A-Za-z]{12}$/);

const listarAcompanhamentos = Joi.object({
  unidadeId:     ID().required()
                   .messages({ 'any.required': 'unidadeId é obrigatório' }),
  mesReferencia: Joi.string().pattern(/^\d{4}-\d{2}-01$/).optional()
                   .messages({ 'string.pattern.base': 'mesReferencia deve estar no formato YYYY-MM-01' }),
});

const criarAcompanhamento = Joi.object({
  indicadorId:    ID().required()
                    .messages({ 'any.required': 'indicadorId é obrigatório' }),
  metaId:         ID().optional()
                    .messages({ 'string.guid': 'metaId inválido' }),
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
