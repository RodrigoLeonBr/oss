const Joi = require('joi');

const ID = () => {
    return Joi.string().pattern(/^[0-9A-Za-z]{8}-[0-9A-Za-z]{4}-[0-9A-Za-z]{4}-[0-9A-Za-z]{4}-[0-9A-Za-z]{12}$/);
};
const MES = () => {
    return Joi.string().pattern(/^\d{4}-\d{2}-01$/).messages({ 'string.pattern.base': 'mês no formato YYYY-MM-01' });
};
const ANO_MES = () => {
    return Joi.string().pattern(/^\d{4}-\d{2}$/).messages({ 'string.pattern.base': 'use YYYY-MM' });
};
const CONTA = () => {
    return Joi.string().valid('custeio', 'investimento', 'provisao');
};
const TIPO_PERIODO = () => {
    return Joi.string().valid('trimestral', 'quadrimestral', 'anual', 'livre');
};

const escopo = {
    oss_id: ID(),
    contrato_id: ID(),
    unidade_id: ID(),
    conta: CONTA(),
};

// período: tipo + ano + n (fixos) ou tipo=livre + ini/fim (YYYY-MM)
const periodo = {
    tipo: TIPO_PERIODO().required(),
    ano: Joi.when('tipo', { is: 'livre', then: Joi.forbidden(), otherwise: Joi.number().integer().min(2015).max(2100).required() }),
    n: Joi.number().integer().min(1).max(4).default(1),
    ini: Joi.when('tipo', { is: 'livre', then: ANO_MES().required(), otherwise: Joi.forbidden() }),
    fim: Joi.when('tipo', { is: 'livre', then: ANO_MES().required(), otherwise: Joi.forbidden() }),
};

const painelPeriodo = Joi.object({ ...escopo, ...periodo });

const painelSerie = Joi.object({
    ...escopo,
    ini: ANO_MES().required(),
    fim: ANO_MES().required(),
    granularidade: Joi.string().valid('mes', 'trim', 'quad', 'ano').default('mes'),
});

const painelComparativo = Joi.object({
    ...escopo,
    tipo: Joi.string().valid('trimestral', 'quadrimestral', 'anual').required(),
    n: Joi.number().integer().min(1).max(4).default(1),
    anos: Joi.alternatives()
        .try(Joi.array().items(Joi.number().integer()), Joi.string().pattern(/^\d{4}(,\d{4})*$/))
        .required(),
});

const grade = Joi.object({
    unidade_id: ID().required(),
    conta: CONTA().required(),
    mes: MES().required(),
});

const salvarGrade = Joi.object({
    unidade_id: ID().required(),
    conta: CONTA().required(),
    mes: MES().required(),
    valores: Joi.array()
        .items(Joi.object({ rubrica_id: ID().required(), valor: Joi.number().precision(2).allow(null) }))
        .default([]),
    movimentos: Joi.array().items(
        Joi.object({
            tipo: Joi.string().valid('transferencia', 'recursos_proprios', 'arredondamento').required(),
            contraparte_unidade_id: ID().allow(null),
            contraparte_conta: CONTA().allow(null),
            descricao: Joi.string().max(200).required(),
            valor: Joi.number().precision(2).required(),
        }),
    ),
    saldo: Joi.number().precision(2).allow(null),
});

const arquivo = Joi.object({
    contrato_id: ID().required(),
    token: Joi.string().guid(),
    nome: Joi.string().max(200).required(),
});

const token = Joi.object({ token: Joi.string().guid().required() });

const listarObservacoes = Joi.object({
    contrato_id: ID(),
    unidade_id: ID(),
    tipo: Joi.string().valid('nota', 'secao', 'pendencia'),
    status: Joi.string().valid('aberta', 'resolvida'),
    secao: Joi.string().max(60),
    ini: MES(),
    fim: MES(),
});

const obsCampos = {
    unidade_id: ID().allow(null),
    conta: CONTA().allow(null),
    mes_referencia: MES().allow(null),
    periodo_ini: MES().allow(null),
    periodo_fim: MES().allow(null),
    secao: Joi.string().max(60).allow(null),
    texto: Joi.string().max(20000),
    status: Joi.string().valid('aberta', 'resolvida').allow(null),
};

const criarObservacao = Joi.object({
    contrato_id: ID().required(),
    tipo: Joi.string().valid('nota', 'secao', 'pendencia').required(),
    ...obsCampos,
    texto: obsCampos.texto.required(),
    secao: Joi.when('tipo', { is: 'secao', then: Joi.string().max(60).required(), otherwise: obsCampos.secao }),
    periodo_ini: Joi.when('tipo', { is: 'secao', then: MES().required(), otherwise: obsCampos.periodo_ini }),
    periodo_fim: Joi.when('tipo', { is: 'secao', then: MES().required(), otherwise: obsCampos.periodo_fim }),
});

const atualizarObservacao = Joi.object(obsCampos).min(1);

const fechar = Joi.object({ contrato_id: ID().required(), meses: Joi.array().items(MES()).min(1).required() });
const reabrir = Joi.object({
    contrato_id: ID().required(),
    mes: MES().required(),
    justificativa: Joi.string().min(10).max(2000).required(),
});
const contrato = Joi.object({ contrato_id: ID().required() });

const relatorioComissao = Joi.object({ contrato_id: ID().required(), ...periodo });

module.exports = {
    painelPeriodo,
    painelSerie,
    painelComparativo,
    grade,
    salvarGrade,
    arquivo,
    token,
    listarObservacoes,
    criarObservacao,
    atualizarObservacao,
    fechar,
    reabrir,
    contrato,
    relatorioComissao,
};
