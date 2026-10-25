const Joi = require('joi');

const ID = () => Joi.string().pattern(/^[0-9A-Za-z]{8}-[0-9A-Za-z]{4}-[0-9A-Za-z]{4}-[0-9A-Za-z]{4}-[0-9A-Za-z]{12}$/);

const gerarRelatorioCms = Joi.object({
  mes: Joi.string()
    .pattern(/^\d{4}-\d{2}-01$/)
    .required()
    .messages({ 'string.pattern.base': 'mes deve estar no formato YYYY-MM-01' }),
  periodo: Joi.string()
    .valid('mes', 'acumulado', 'trimestre', 'quadrimestre', 'ano')
    .default('mes'),
  escopo: Joi.string().valid('todos', 'contrato', 'unidade').default('todos'),
  contrato_id: Joi.when('escopo', {
    is: 'contrato',
    then: ID().required(),
    otherwise: ID().optional(),
  }),
  unidade_id: Joi.when('escopo', {
    is: 'unidade',
    then: ID().required(),
    otherwise: ID().optional(),
  }),
});

const serieRelatorioCms = Joi.object({
  mes: Joi.string()
    .pattern(/^\d{4}-\d{2}-01$/)
    .required()
    .messages({ 'string.pattern.base': 'mes deve estar no formato YYYY-MM-01' }),
  meses: Joi.number().integer().min(1).max(24).default(8),
  // aceito e ignorado (o front reusa o mesmo toQuery dos filtros)
  periodo: Joi.string().valid('mes', 'acumulado', 'trimestre', 'quadrimestre', 'ano').optional(),
  escopo: Joi.string().valid('todos', 'contrato', 'unidade').default('todos'),
  contrato_id: Joi.when('escopo', {
    is: 'contrato',
    then: ID().required(),
    otherwise: ID().optional(),
  }),
  unidade_id: Joi.when('escopo', {
    is: 'unidade',
    then: ID().required(),
    otherwise: ID().optional(),
  }),
});

module.exports = { gerarRelatorioCms, serieRelatorioCms };
