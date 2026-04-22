const Joi = require('joi');

// ── Listar — aceita query params camelCase (frontend) e snake_case (legado) ───
const listarMetas = Joi.object({
    indicadorId:  Joi.string().uuid().optional(),
    indicador_id: Joi.string().uuid().optional(),
    status:       Joi.string().valid('vigente', 'encerrada').optional(),
});

// ── Criar — camelCase (frontend) ──────────────────────────────────────────────
const criarMeta = Joi.object({
    indicadorId:      Joi.string().uuid().required()
                         .messages({ 'any.required': 'indicadorId é obrigatório', 'string.guid': 'indicadorId inválido' }),
    vigenciaInicio:   Joi.string().isoDate().required()
                         .messages({ 'any.required': 'vigenciaInicio é obrigatória' }),
    vigenciaFim:      Joi.string().isoDate().optional().allow(null, ''),
    metaMensal:       Joi.number().min(0).optional().allow(null),
    metaAnual:        Joi.number().min(0).optional().allow(null),
    metaValorQualit:  Joi.number().min(0).optional().allow(null),
    metaMinima:       Joi.number().min(0).optional().allow(null),
    metaParcial:      Joi.number().min(0).optional().allow(null),
    unidadeMedida:    Joi.string().max(50).optional().allow('', null),
    observacoes:      Joi.string().optional().allow('', null),
    prazoImplantacao: Joi.string().isoDate().optional().allow(null, ''),
    metaTipo:         Joi.string().valid('maior_igual', 'menor_igual').default('maior_igual'),
    aditivoId:        Joi.string().uuid().optional().allow(null),
}).or('metaMensal', 'metaAnual', 'metaValorQualit');

// ── Atualizar — todos opcionais; indicadorId stripped se enviado ──────────────
const atualizarMeta = Joi.object({
    // Frontend pode enviar indicadorId no payload — ignorado (indicador não muda via PUT)
    indicadorId:      Joi.string().uuid().optional().strip(),

    vigenciaFim:      Joi.string().isoDate().optional().allow(null, ''),
    metaMensal:       Joi.number().min(0).optional().allow(null),
    metaAnual:        Joi.number().min(0).optional().allow(null),
    metaValorQualit:  Joi.number().min(0).optional().allow(null),
    metaMinima:       Joi.number().min(0).optional().allow(null),
    metaParcial:      Joi.number().min(0).optional().allow(null),
    metaTipo:         Joi.string().valid('maior_igual', 'menor_igual').optional(),
    unidadeMedida:    Joi.string().max(50).optional().allow('', null),
    observacoes:      Joi.string().optional().allow('', null),
}).min(1);

module.exports = { listarMetas, criarMeta, atualizarMeta };
