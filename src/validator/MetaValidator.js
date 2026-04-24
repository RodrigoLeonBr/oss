const Joi = require('joi');

// ── Listar — aceita query params camelCase (frontend) e snake_case (legado) ───
const listarMetas = Joi.object({
    indicadorId:  Joi.string().uuid().optional(),
    indicador_id: Joi.string().uuid().optional(),
    status:       Joi.string().valid('vigente', 'encerrada').optional(),
});

// ── Criar — vigência fica no indicador; não enviar (ignorado se enviado) ─────
const criarMeta = Joi.object({
    indicadorId:      Joi.string().uuid().required()
                         .messages({ 'any.required': 'indicadorId é obrigatório', 'string.guid': 'indicadorId inválido' }),
    nome:             Joi.string().min(1).max(500).required()
                         .messages({ 'any.required': 'nome é obrigatório' }),
    vigenciaInicio:   Joi.string().isoDate().optional().strip(),
    vigenciaFim:      Joi.string().isoDate().optional().strip(),
    prazoImplantacao: Joi.string().isoDate().optional().strip(),
    metaMensal:       Joi.number().min(0).optional().allow(null),
    metaAnual:        Joi.number().min(0).optional().allow(null),
    metaValorQualit:  Joi.number().min(0).optional().allow(null),
    metaMinima:       Joi.number().min(0).max(100).optional().allow(null),
    metaParcial:      Joi.number().min(0).max(100).optional().allow(null),
    unidadeMedida:    Joi.string().max(50).optional().allow('', null),
    observacoes:      Joi.string().optional().allow('', null),
    metaTipo:         Joi.string().valid('maior_igual', 'menor_igual').default('maior_igual'),
    aditivoId:        Joi.string().uuid().optional().allow(null),
}).or('metaMensal', 'metaAnual', 'metaValorQualit');

// ── Atualizar — sem vigência (fonte: indicador) ──────────────────────────────
const atualizarMeta = Joi.object({
    indicadorId:      Joi.string().uuid().optional().strip(),
    nome:             Joi.string().min(1).max(500).optional(),
    vigenciaInicio:   Joi.string().isoDate().optional().strip(),
    vigenciaFim:      Joi.string().isoDate().optional().strip(),
    prazoImplantacao: Joi.string().isoDate().optional().strip(),

    metaMensal:       Joi.number().min(0).optional().allow(null),
    metaAnual:        Joi.number().min(0).optional().allow(null),
    metaValorQualit:  Joi.number().min(0).optional().allow(null),
    metaMinima:       Joi.number().min(0).max(100).optional().allow(null),
    metaParcial:      Joi.number().min(0).max(100).optional().allow(null),
    metaTipo:         Joi.string().valid('maior_igual', 'menor_igual').optional(),
    unidadeMedida:    Joi.string().max(50).optional().allow('', null),
    observacoes:      Joi.string().optional().allow('', null),
}).min(1);

const agregadaPacote = Joi.object({
  nome: Joi.string().min(1).max(500).required(),
  metaMensal: Joi.number().min(0).required(),
  metaAnual: Joi.number().min(0).optional().allow(null),
  metaTipo: Joi.string().valid('maior_igual', 'menor_igual').default('maior_igual'),
  observacoes: Joi.string().optional().allow('', null),
  metaMinima: Joi.number().min(0).max(100).optional().allow(null),
  metaParcial: Joi.number().min(0).max(100).optional().allow(null),
  unidadeMedida: Joi.string().max(50).optional().allow('', null),
});

const componenteLinha = Joi.object({
  nome: Joi.string().min(1).max(500).required(),
  metaMensal: Joi.number().min(0).required(),
  metaAnual: Joi.number().min(0).optional().allow(null),
  peso: Joi.number().positive().required(),
  observacoes: Joi.string().optional().allow('', null),
  metaMinima: Joi.number().min(0).max(100).optional().allow(null),
  metaParcial: Joi.number().min(0).max(100).optional().allow(null),
  metaTipo: Joi.string().valid('maior_igual', 'menor_igual').optional(),
});

const criarMetaPacote = Joi.object({
  indicadorId: Joi.string().uuid().required(),
  agregada: agregadaPacote.required(),
  componentes: Joi.array().items(componenteLinha).min(1).required(),
});

module.exports = { listarMetas, criarMeta, criarMetaPacote, atualizarMeta };
