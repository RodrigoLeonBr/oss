const httpStatus = require('http-status');
const IndicadorDao = require('../dao/IndicadorDao');
const ApiError = require('../helper/ApiError');
const db = require('../models');

const indicadorDao = new IndicadorDao();

const listar = async (filtros = {}) => {
    const where = {};
    if (filtros.unidade_id) where.unidade_id = filtros.unidade_id;
    if (filtros.grupo) where.grupo = filtros.grupo;
    if (filtros.tipo) where.tipo = filtros.tipo;

    if (filtros.incluir_inativos) return indicadorDao.findTodos(where);
    return indicadorDao.findAtivos(where);
};

const buscarPorId = async (indicadorId) => {
    const indicador = await indicadorDao.findPorId(indicadorId);
    if (!indicador) throw new ApiError(httpStatus.NOT_FOUND, 'Indicador não encontrado');
    return indicador;
};

const criar = async (dados) => {
    const existente = await db.indicador.findOne({ where: { codigo: dados.codigo }, paranoid: false });
    if (existente) throw new ApiError(httpStatus.CONFLICT, `Já existe indicador com código '${dados.codigo}'`);
    return db.indicador.create(dados);
};

const atualizar = async (indicadorId, dados) => {
    const indicador = await indicadorDao.findPorId(indicadorId);
    if (!indicador) throw new ApiError(httpStatus.NOT_FOUND, 'Indicador não encontrado');
    await indicador.update(dados);
    return indicador.reload();
};

const desativar = async (indicadorId) => {
    const indicador = await indicadorDao.findPorId(indicadorId);
    if (!indicador) throw new ApiError(httpStatus.NOT_FOUND, 'Indicador não encontrado');
    await indicadorDao.softDelete(indicadorId);
    return { message: 'Indicador desativado. Histórico preservado para auditoria.' };
};

module.exports = { listar, buscarPorId, criar, atualizar, desativar };
