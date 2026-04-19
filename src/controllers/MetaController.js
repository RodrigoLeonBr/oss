const httpStatus = require('http-status');
const ApiError = require('../helper/ApiError');
const { criarMeta, atualizarMeta } = require('../validator/MetaValidator');
const db = require('../models');
const logger = require('../config/logger');

class MetaController {
    listar = async (req, res, next) => {
        try {
            const where = {};
            if (req.query.indicador_id) where.indicador_id = req.query.indicador_id;

            const metas = await db.meta.findAll({
                where,
                include: [
                    { model: db.indicador, as: 'indicador', attributes: ['indicador_id', 'codigo', 'nome', 'grupo'] },
                ],
                order: [['vigencia_inicio', 'DESC']],
            });
            return res.status(httpStatus.OK).json({ status: true, data: metas });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    criar = async (req, res, next) => {
        try {
            const { error, value } = criarMeta.validate(req.body);
            if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));

            if (value.meta_anual && !value.meta_mensal) {
                value.meta_mensal = parseFloat((value.meta_anual / 12).toFixed(4));
            }

            const meta = await db.meta.create(value);
            return res.status(httpStatus.CREATED).json({ status: true, message: 'Meta criada', data: meta });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    atualizar = async (req, res, next) => {
        try {
            const { error, value } = atualizarMeta.validate(req.body);
            if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));

            const meta = await db.meta.findOne({ where: { meta_id: req.params.id } });
            if (!meta) return next(new ApiError(httpStatus.NOT_FOUND, 'Meta não encontrada'));

            await meta.update(value);
            return res.status(httpStatus.OK).json({ status: true, message: 'Meta atualizada', data: await meta.reload() });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };
}

module.exports = MetaController;
