const httpStatus = require('http-status');
const db = require('../models');
const ApiError = require('../helper/ApiError');
const { assertIndicadorNoEscopoOSS } = require('../helper/ossScopeHelper');

const includeEscopo = (ossIdFiltro) => [{
  model: db.indicador,
  as: 'indicador',
  required: true,
  include: [{
    model: db.unidade,
    as: 'unidade',
    required: true,
    include: [{
      model: db.contrato,
      as: 'contrato',
      required: true,
      where: ossIdFiltro ? { oss_id: ossIdFiltro } : undefined,
    }],
  }],
}];

const listar = async ({ indicadorId, unidadeId }, ossIdFiltro = null) => {
  const where = {};
  if (indicadorId) where.indicador_id = indicadorId;
  const include = includeEscopo(ossIdFiltro);
  if (unidadeId) include[0].include[0].where = { unidade_id: unidadeId };
  return db.mapa_producao.findAll({ where, include, order: [['criado_em', 'DESC']] });
};

const criar = async (value, ossIdFiltro = null) => {
  await assertIndicadorNoEscopoOSS(value.indicadorId, ossIdFiltro);
  return db.mapa_producao.create({
    indicador_id: value.indicadorId,
    fonte: value.fonte,
    tipo_filtro: value.tipoFiltro,
    valor_filtro: value.valorFiltro,
  });
};

const atualizar = async (mapaId, value, ossIdFiltro = null) => {
  const registro = await db.mapa_producao.findByPk(mapaId, { include: includeEscopo(ossIdFiltro) });
  if (!registro || !registro.indicador) throw new ApiError(httpStatus.NOT_FOUND, 'Mapeamento não encontrado');
  if (value.fonte !== undefined) registro.fonte = value.fonte;
  if (value.tipoFiltro !== undefined) registro.tipo_filtro = value.tipoFiltro;
  if (value.valorFiltro !== undefined) registro.valor_filtro = value.valorFiltro;
  if (value.ativo !== undefined) registro.ativo = value.ativo ? 1 : 0;
  await registro.save();
  return registro;
};

const remover = async (mapaId, ossIdFiltro = null) => {
  const registro = await db.mapa_producao.findByPk(mapaId, { include: includeEscopo(ossIdFiltro) });
  if (!registro || !registro.indicador) throw new ApiError(httpStatus.NOT_FOUND, 'Mapeamento não encontrado');
  await registro.destroy();
};

module.exports = { listar, criar, atualizar, remover };
