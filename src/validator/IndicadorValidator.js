const Joi = require('joi');

const criarIndicador = Joi.object({
    codigo: Joi.string().max(50).required(),
    nome: Joi.string().max(300).required(),
    descricao: Joi.string().optional().allow('', null),
    tipo: Joi.string().valid('quantitativo', 'qualitativo').required(),
    grupo: Joi.string().valid('auditoria_operacional', 'qualidade_atencao', 'transversal', 'rh').required(),
    bloco_id: Joi.string().uuid().optional().allow(null),
    unidade_id: Joi.string().uuid().optional().allow(null),
    formula_calculo: Joi.string().optional().allow('', null),
    unidade_medida: Joi.string().max(50).optional().allow('', null),
    peso_perc: Joi.number().min(0).max(100).optional().default(0),
    periodicidade: Joi.string().valid('mensal', 'bimestral', 'trimestral', 'quadrimestral', 'unico').optional().default('mensal'),
    fonte_dados: Joi.string().valid('SIASUS', 'SIH', 'CNES', 'Prontuario', 'Manual', 'Misto').optional().default('Manual'),
    meta_tipo: Joi.string().valid('igualdade', 'maior_igual', 'menor_igual', 'entre', 'percentual_max').optional().default('maior_igual'),
    tipo_implantacao: Joi.boolean().optional().default(false),
    prazo_dias_impl: Joi.number().integer().min(0).optional().allow(null),
});

const atualizarIndicador = Joi.object({
    nome: Joi.string().max(300).optional(),
    descricao: Joi.string().optional().allow('', null),
    tipo: Joi.string().valid('quantitativo', 'qualitativo').optional(),
    grupo: Joi.string().valid('auditoria_operacional', 'qualidade_atencao', 'transversal', 'rh').optional(),
    bloco_id: Joi.string().uuid().optional().allow(null),
    formula_calculo: Joi.string().optional().allow('', null),
    peso_perc: Joi.number().min(0).max(100).optional(),
    periodicidade: Joi.string().valid('mensal', 'bimestral', 'trimestral', 'quadrimestral', 'unico').optional(),
    fonte_dados: Joi.string().valid('SIASUS', 'SIH', 'CNES', 'Prontuario', 'Manual', 'Misto').optional(),
    meta_tipo: Joi.string().valid('igualdade', 'maior_igual', 'menor_igual', 'entre', 'percentual_max').optional(),
}).min(1);

const listarIndicadores = Joi.object({
    unidade_id: Joi.string().uuid().optional(),
    grupo: Joi.string().valid('auditoria_operacional', 'qualidade_atencao', 'transversal', 'rh').optional(),
    tipo: Joi.string().valid('quantitativo', 'qualitativo').optional(),
    incluir_inativos: Joi.boolean().optional().default(false),
});

module.exports = { criarIndicador, atualizarIndicador, listarIndicadores };
