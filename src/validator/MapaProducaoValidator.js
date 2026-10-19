const Joi = require('joi');

const ID = () => Joi.string().pattern(/^[0-9A-Za-z]{8}-[0-9A-Za-z]{4}-[0-9A-Za-z]{4}-[0-9A-Za-z]{4}-[0-9A-Za-z]{12}$/);

const COMPRIMENTO = { grupo: 2, subgrupo: 4, forma: 6, procedimento: 10 };

const criarMapa = Joi.object({
  indicadorId: ID().required().messages({ 'any.required': 'indicadorId é obrigatório' }),
  fonte: Joi.string().valid('sia', 'sih').required(),
  tipoFiltro: Joi.string().valid('grupo', 'subgrupo', 'forma', 'procedimento').required(),
  valorFiltro: Joi.string().pattern(/^\d+$/).required()
    .messages({ 'string.pattern.base': 'valorFiltro deve conter apenas dígitos' }),
}).custom((obj, helpers) => {
  const len = COMPRIMENTO[obj.tipoFiltro];
  if (len && obj.valorFiltro.length !== len) {
    return helpers.error('any.invalid');
  }
  return obj;
}).messages({ 'any.invalid': 'valorFiltro com comprimento incompatível com tipoFiltro' });

const atualizarMapa = Joi.object({
  fonte: Joi.string().valid('sia', 'sih').optional(),
  tipoFiltro: Joi.string().valid('grupo', 'subgrupo', 'forma', 'procedimento').optional(),
  valorFiltro: Joi.string().pattern(/^\d+$/).optional(),
  ativo: Joi.boolean().optional(),
}).min(1);

const listarMapa = Joi.object({
  indicadorId: ID().optional(),
  unidadeId: ID().optional(),
});

module.exports = { criarMapa, atualizarMapa, listarMapa };
