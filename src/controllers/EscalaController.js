const httpStatus = require('http-status');
const Joi = require('joi');
const EscalaService = require('../service/EscalaService');
const ApiError = require('../helper/ApiError');
const { getOssIdSeEscopoProprio } = require('../helper/ossScopeHelper');
const logger = require('../config/logger');

const ID = Joi.string().pattern(
    /^[0-9A-Za-z]{8}-[0-9A-Za-z]{4}-[0-9A-Za-z]{4}-[0-9A-Za-z]{4}-[0-9A-Za-z]{12}$/,
);
const MES = Joi.string()
    .pattern(/^\d{4}-\d{2}-01$/)
    .required()
    .messages({ 'string.pattern.base': 'mes deve estar no formato YYYY-MM-01' });
const HORA = Joi.string()
    .pattern(/^([01]\d|2[0-3]):[0-5]\d$/)
    .required();

const unidadeMesSchema = Joi.object({ unidade_id: ID.required(), mes: MES });
const gradeSchema = Joi.object({
    mes: MES,
    profissional_id: ID,
    unidade_id: Joi.when('profissional_id', {
        is: Joi.exist(),
        then: ID.optional(),
        otherwise: ID.required(),
    }),
    setor_id: Joi.when('profissional_id', {
        is: Joi.exist(),
        then: ID.optional(),
        otherwise: ID.required(),
    }),
});
const buscaSchema = Joi.object({ busca: Joi.string().trim().min(3).max(100).required() });
const unidadeSchema = Joi.object({ unidade_id: ID.required() });
const dimSchema = Joi.object({
    unidadeId: ID.required(),
    setorId: ID.required(),
    categoria: Joi.string().max(40).allow('', null),
    turnoInicio: HORA,
    turnoFim: HORA,
    qtdPostos: Joi.number().integer().min(1).max(200).required(),
    diasSemana: Joi.string()
        .pattern(/^[1-7]{1,7}$/)
        .default('1234567'),
    vigenciaInicio: Joi.date().iso().raw().required(),
    vigenciaFim: Joi.date().iso().raw().allow(null, ''),
    fonte: Joi.string().max(300).allow('', null),
    obs: Joi.string().max(5000).allow('', null),
});

const validar = (schema, obj) => {
    const { error, value } = schema.validate(obj);
    if (error) {
        throw new ApiError(httpStatus.BAD_REQUEST, error.details[0].message);
    }
    return value;
};

class EscalaController {
    setores = async (req, res, next) => {
        try {
            const v = validar(unidadeMesSchema, req.query);
            const data = await EscalaService.listarSetores(
                { unidadeId: v.unidade_id, mes: v.mes },
                getOssIdSeEscopoProprio(req),
            );
            return res.status(httpStatus.OK).json({ status: true, data });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    grade = async (req, res, next) => {
        try {
            const v = validar(gradeSchema, req.query);
            const data = await EscalaService.grade(
                {
                    mes: v.mes,
                    unidadeId: v.unidade_id,
                    setorId: v.setor_id,
                    profissionalId: v.profissional_id,
                },
                getOssIdSeEscopoProprio(req),
            );
            return res.status(httpStatus.OK).json({ status: true, data });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    profissionais = async (req, res, next) => {
        try {
            const v = validar(buscaSchema, req.query);
            const data = await EscalaService.buscarProfissionais(v, getOssIdSeEscopoProprio(req));
            return res.status(httpStatus.OK).json({ status: true, data });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    contratoApresentado = async (req, res, next) => {
        try {
            const v = validar(unidadeMesSchema, req.query);
            const data = await EscalaService.contratoApresentado(
                { unidadeId: v.unidade_id, mes: v.mes },
                getOssIdSeEscopoProprio(req),
            );
            return res.status(httpStatus.OK).json({ status: true, data });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    listarDimensionamento = async (req, res, next) => {
        try {
            const v = validar(unidadeSchema, req.query);
            const data = await EscalaService.listarDimensionamento(
                { unidadeId: v.unidade_id },
                getOssIdSeEscopoProprio(req),
            );
            return res.status(httpStatus.OK).json({ status: true, data });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    criarDimensionamento = async (req, res, next) => {
        try {
            const v = validar(dimSchema, req.body);
            const data = await EscalaService.criarDimensionamento(v, getOssIdSeEscopoProprio(req));
            return res
                .status(httpStatus.CREATED)
                .json({ status: true, data, message: 'Dimensionamento cadastrado' });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    atualizarDimensionamento = async (req, res, next) => {
        try {
            validar(ID.required(), req.params.id);
            const v = validar(dimSchema, req.body);
            const data = await EscalaService.atualizarDimensionamento(
                req.params.id,
                v,
                getOssIdSeEscopoProprio(req),
            );
            return res
                .status(httpStatus.OK)
                .json({ status: true, data, message: 'Dimensionamento atualizado' });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    removerDimensionamento = async (req, res, next) => {
        try {
            validar(ID.required(), req.params.id);
            const data = await EscalaService.removerDimensionamento(
                req.params.id,
                getOssIdSeEscopoProprio(req),
            );
            return res
                .status(httpStatus.OK)
                .json({ status: true, data, message: 'Dimensionamento removido' });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };
}

module.exports = EscalaController;
