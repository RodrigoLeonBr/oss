const Joi = require('joi');

// ── Schema simplificado para o CRUD de Indicadores por Unidade ───────────────
// tipo: 'producao' (mapeado para 'quantitativo' no BD) | 'qualidade' (→ 'qualitativo')
// status: 'ativo' | 'inativo' (mapeado para ativo=1/0 no BD)

const criarIndicador = Joi.object({
    // Campos do CRUD simplificado
    unidadeId:      Joi.string().uuid().required()
                       .messages({ 'any.required': 'unidadeId é obrigatório', 'string.guid': 'unidadeId inválido' }),
    nome:           Joi.string().max(300).required()
                       .messages({ 'any.required': 'Nome é obrigatório', 'string.max': 'Nome muito longo (máx. 300 caracteres)' }),
    descricao:      Joi.string().max(2000).optional().allow('', null),
    tipo:           Joi.string().valid('producao', 'qualidade').required()
                       .messages({ 'any.only': 'tipo deve ser producao ou qualidade' }),
    metaPadrao:     Joi.number().min(0).max(9999.99).precision(2).required()
                       .messages({ 'any.required': 'metaPadrao é obrigatório', 'number.min': 'metaPadrao deve ser ≥ 0' }),
    unidadeMedida:  Joi.string().max(50).required()
                       .messages({ 'any.required': 'unidadeMedida é obrigatória' }),
    status:         Joi.string().valid('ativo', 'inativo').optional().default('ativo'),

    // Campos legado aceitos mas ignorados pelo novo service (compatibilidade)
    codigo:         Joi.string().max(50).optional().strip(),
    grupo:          Joi.string().valid('auditoria_operacional', 'qualidade_atencao', 'transversal', 'rh').optional(),
    bloco_id:       Joi.string().uuid().optional().allow(null),
    formula_calculo: Joi.string().optional().allow('', null),
    periodicidade:  Joi.string().valid('mensal', 'bimestral', 'trimestral', 'quadrimestral', 'unico').optional(),
    fonte_dados:    Joi.string().valid('SIASUS', 'SIH', 'CNES', 'Prontuario', 'Manual', 'Misto').optional(),
    meta_tipo:      Joi.string().valid('igualdade', 'maior_igual', 'menor_igual', 'entre', 'percentual_max').optional(),
});

const atualizarIndicador = Joi.object({
    // Frontend envia unidadeId no payload de edição — ignorado (unidade não muda via PUT)
    unidadeId:      Joi.string().uuid().optional().strip(),

    nome:           Joi.string().max(300).optional(),
    descricao:      Joi.string().max(2000).optional().allow('', null),
    tipo:           Joi.string().valid('producao', 'qualidade').optional(),
    metaPadrao:     Joi.number().min(0).max(9999.99).precision(2).optional(),
    unidadeMedida:  Joi.string().max(50).optional().allow('', null),
    status:         Joi.string().valid('ativo', 'inativo').optional(),

    // Legado
    grupo:          Joi.string().valid('auditoria_operacional', 'qualidade_atencao', 'transversal', 'rh').optional(),
    formula_calculo: Joi.string().optional().allow('', null),
    periodicidade:  Joi.string().valid('mensal', 'bimestral', 'trimestral', 'quadrimestral', 'unico').optional(),
    fonte_dados:    Joi.string().valid('SIASUS', 'SIH', 'CNES', 'Prontuario', 'Manual', 'Misto').optional(),
    meta_tipo:      Joi.string().valid('igualdade', 'maior_igual', 'menor_igual', 'entre', 'percentual_max').optional(),
}).min(1);

const listarIndicadores = Joi.object({
    // camelCase (frontend)
    unidadeId:      Joi.string().uuid().optional(),
    status:         Joi.string().valid('ativo', 'inativo').optional(),
    tipo:           Joi.string().valid('producao', 'qualidade').optional(),
    incluirInativos: Joi.boolean().optional().default(false),

    // snake_case (legado / outros clientes)
    unidade_id:     Joi.string().uuid().optional(),
    grupo:          Joi.string().valid('auditoria_operacional', 'qualidade_atencao', 'transversal', 'rh').optional(),
    incluir_inativos: Joi.boolean().optional().default(false),
});

module.exports = { criarIndicador, atualizarIndicador, listarIndicadores };
