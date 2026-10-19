const { QueryTypes, Op } = require('sequelize');
const httpStatus = require('http-status');
const db = require('../models');
const { producaoDb, pingProducao } = require('../config/producaoDb');
const { clausulaFiltro } = require('../helper/filtroProducao');
const ApiError = require('../helper/ApiError');
const { assertUnidadeNoEscopoOSS } = require('../helper/ossScopeHelper');

/**
 * Monta as linhas da comparação a partir de dados já carregados (sem DB).
 * @param {{
 *   indicadores: Array<{indicador_id:string, nome:string, unidade_medida:?string}>,
 *   informadoPorIndicador: Record<string, number>,   // valor_realizado
 *   produzidoPorIndicador: Record<string, number>,   // soma SIA/SIH dos filtros
 *   temMapa: Record<string, boolean>,                 // indicador tem ≥1 filtro ativo
 * }}
 */
function montarComparacao({ indicadores, informadoPorIndicador, produzidoPorIndicador, temMapa }) {
  return indicadores.map((ind) => {
    const id = ind.indicador_id;
    const semMapeamento = !temMapa[id];
    const informado = informadoPorIndicador[id] != null ? informadoPorIndicador[id] : null;
    const registrado = semMapeamento ? null
      : (produzidoPorIndicador[id] != null ? produzidoPorIndicador[id] : 0);
    const ambos = informado != null && registrado != null;
    const diferenca = ambos ? parseFloat((informado - registrado).toFixed(4)) : null;
    const divergenciaPerc = ambos && registrado > 0
      ? parseFloat((((informado - registrado) / registrado) * 100).toFixed(2))
      : null;
    return {
      indicadorId: id,
      nome: ind.nome,
      unidadeMedida: ind.unidade_medida || null,
      informado,
      registrado,
      diferenca,
      divergenciaPerc,
      semMapeamento,
    };
  });
}

/** Soma a produção (apresentada) de um filtro para um CNES/competência. */
async function somaProducaoFiltro(cnes, competencia, fonte, tipoFiltro, valorFiltro) {
  const { coluna, operador, valor } = clausulaFiltro(fonte, tipoFiltro, valorFiltro);
  if (fonte === 'sia') {
    const sql = `SELECT COALESCE(SUM(prd_qt_p),0) AS total FROM s_prd
                 WHERE prd_uid = :cnes AND prd_cmp = :cmp AND ${coluna} ${operador} :valor`;
    const [row] = await producaoDb.query(sql, {
      replacements: { cnes, cmp: competencia, valor }, type: QueryTypes.SELECT,
    });
    return Number(row.total) || 0;
  }
  const sql = `SELECT COALESCE(SUM(QUANTIDADE),0) AS total FROM s_aih_pa
               WHERE CNES = :cnes AND COMPETENCIA = :cmp AND ${coluna} ${operador} :valor`;
  const [row] = await producaoDb.query(sql, {
    replacements: { cnes, cmp: competencia, valor }, type: QueryTypes.SELECT,
  });
  return Number(row.total) || 0;
}

/**
 * @param {{ unidadeId:string, competencia:string }} params  competencia = 'AAAAMM'
 * @param {string|null} ossIdFiltro
 */
async function comparar({ unidadeId, competencia }, ossIdFiltro = null) {
  if (!/^\d{6}$/.test(competencia)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'competencia deve ser AAAAMM');
  }
  await assertUnidadeNoEscopoOSS(unidadeId, ossIdFiltro);

  const unidade = await db.unidade.findByPk(unidadeId);
  if (!unidade) throw new ApiError(httpStatus.NOT_FOUND, 'Unidade não encontrada');
  if (!unidade.cnes) throw new ApiError(httpStatus.BAD_REQUEST, 'Unidade sem CNES cadastrado');

  if (!(await pingProducao())) {
    throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, 'Banco de produção indisponível');
  }

  const indicadores = await db.indicador.findAll({
    where: { unidade_id: unidadeId, tipo: 'quantitativo', ativo: 1 },
    order: [['nome', 'ASC']],
  });
  const ids = indicadores.map((i) => i.indicador_id);

  const mesRef = `${competencia.slice(0, 4)}-${competencia.slice(4, 6)}-01`;
  const acomps = ids.length ? await db.acompanhamento_mensal.findAll({
    where: { indicador_id: { [Op.in]: ids }, mes_referencia: mesRef },
  }) : [];
  const informadoPorIndicador = {};
  for (const a of acomps) {
    if (a.valor_realizado != null) informadoPorIndicador[a.indicador_id] = Number(a.valor_realizado);
  }

  const mapas = ids.length ? await db.mapa_producao.findAll({
    where: { indicador_id: { [Op.in]: ids }, ativo: 1 },
  }) : [];
  const filtrosPorIndicador = {};
  for (const m of mapas) (filtrosPorIndicador[m.indicador_id] ||= []).push(m);

  const produzidoPorIndicador = {};
  const temMapa = {};
  for (const id of ids) {
    const filtros = filtrosPorIndicador[id] || [];
    temMapa[id] = filtros.length > 0;
    if (!filtros.length) continue;
    let total = 0;
    for (const f of filtros) {
      total += await somaProducaoFiltro(unidade.cnes, competencia, f.fonte, f.tipo_filtro, f.valor_filtro);
    }
    produzidoPorIndicador[id] = total;
  }

  const linhas = montarComparacao({ indicadores, informadoPorIndicador, produzidoPorIndicador, temMapa });
  return {
    competencia,
    unidade: { id: unidade.unidade_id, nome: unidade.nome, cnes: unidade.cnes },
    linhas,
  };
}

module.exports = { montarComparacao, comparar, somaProducaoFiltro };
