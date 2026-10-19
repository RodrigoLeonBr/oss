const { QueryTypes, Op } = require('sequelize');
const httpStatus = require('http-status');
const db = require('../models');
const { producaoDb, pingProducao } = require('../config/producaoDb');
const { clausulaFiltro, clausulaCbo } = require('../helper/filtroProducao');
const { janelaDoPeriodo } = require('../helper/periodoRelatorio');
const ApiError = require('../helper/ApiError');
const {
  assertUnidadeNoEscopoOSS, assertContratoNoEscopoOSS,
} = require('../helper/ossScopeHelper');

const cmpDeYmd = (ymd) => String(ymd).slice(0, 7).replace('-', ''); // 'YYYY-MM-01' → 'YYYYMM'

/** where de unidade/contrato conforme escopo + OSS (igual ao RelatorioCms). */
function escopoWhere({ escopo, contratoId, unidadeId }, ossIdFiltro) {
  const unidadeWhere = {};
  if (escopo === 'unidade' && unidadeId) unidadeWhere.unidade_id = unidadeId;
  const contratoWhere = {};
  if (escopo === 'contrato' && contratoId) contratoWhere.contrato_id = contratoId;
  if (ossIdFiltro) contratoWhere.oss_id = ossIdFiltro;
  return { unidadeWhere, contratoWhere };
}

/** Calcula diferença/divergência de uma linha (informado × registrado). */
function montarLinha({ informado, registrado, semMapeamento }) {
  const ambos = informado != null && registrado != null;
  const diferenca = ambos ? parseFloat((informado - registrado).toFixed(4)) : null;
  const divergenciaPerc = ambos && registrado > 0
    ? parseFloat((((informado - registrado) / registrado) * 100).toFixed(2))
    : null;
  return { informado, registrado, diferenca, divergenciaPerc, semMapeamento };
}

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

/**
 * Soma a produção (apresentada) de um filtro para um CNES e faixa de competências.
 * cmpIni/cmpFim = 'AAAAMM' (inclusive). cbo opcional (prefixo). Mês único → cmpIni=cmpFim.
 */
async function somaProducaoFiltro(cnes, cmpIni, cmpFim, fonte, tipoFiltro, valorFiltro, cbo = null) {
  const { coluna, operador, valor } = clausulaFiltro(fonte, tipoFiltro, valorFiltro);
  const replacements = { cnes, ini: cmpIni, fim: cmpFim, valor };
  let cboSql = '';
  if (cbo) {
    const c = clausulaCbo(fonte, cbo);
    cboSql = ` AND ${c.coluna} LIKE :cbo`;
    replacements.cbo = c.valor;
  }
  if (fonte === 'sia') {
    const sql = `SELECT COALESCE(SUM(prd_qt_p),0) AS total FROM s_prd
                 WHERE prd_uid = :cnes AND prd_cmp BETWEEN :ini AND :fim AND ${coluna} ${operador} :valor${cboSql}`;
    const [row] = await producaoDb.query(sql, { replacements, type: QueryTypes.SELECT });
    return Number(row.total) || 0;
  }
  const sql = `SELECT COALESCE(SUM(QUANTIDADE),0) AS total FROM s_aih_pa
               WHERE CNES = :cnes AND COMPETENCIA BETWEEN :ini AND :fim AND ${coluna} ${operador} :valor${cboSql}`;
  const [row] = await producaoDb.query(sql, { replacements, type: QueryTypes.SELECT });
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
      total += await somaProducaoFiltro(unidade.cnes, competencia, competencia, f.fonte, f.tipo_filtro, f.valor_filtro, f.cbo);
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

/**
 * Confronto informado × apurado por período e escopo.
 * @param {{mes:string, periodo:string, escopo:string, contratoId?:string, unidadeId?:string}} params
 *   mes = 'YYYY-MM-01'; periodo = mes|acumulado|trimestre|quadrimestre|ano
 * @param {string|null} ossIdFiltro
 */
async function compararPeriodo(params, ossIdFiltro = null) {
  const {
    mes, periodo, escopo, contratoId, unidadeId,
  } = params;
  const janela = janelaDoPeriodo(mes, periodo);
  const cmpIni = cmpDeYmd(janela.inicio);
  const cmpFim = cmpDeYmd(janela.fim);

  if (escopo === 'contrato') await assertContratoNoEscopoOSS(contratoId, ossIdFiltro);
  if (escopo === 'unidade') await assertUnidadeNoEscopoOSS(unidadeId, ossIdFiltro);

  if (!(await pingProducao())) {
    throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, 'Banco de produção indisponível');
  }

  const { unidadeWhere, contratoWhere } = escopoWhere({ escopo, contratoId, unidadeId }, ossIdFiltro);
  const indicadores = await db.indicador.findAll({
    where: { ativo: 1, tipo: 'quantitativo' },
    include: [{
      model: db.unidade,
      as: 'unidade',
      required: true,
      where: Object.keys(unidadeWhere).length ? unidadeWhere : undefined,
      include: [{
        model: db.contrato,
        as: 'contrato',
        required: true,
        where: Object.keys(contratoWhere).length ? contratoWhere : undefined,
      }],
    }],
    order: [['codigo', 'ASC']],
  });

  const ids = indicadores.map((i) => i.indicador_id);

  // Informado (prestação) somado na janela
  const acomps = ids.length ? await db.acompanhamento_mensal.findAll({
    where: {
      indicador_id: { [Op.in]: ids },
      mes_referencia: { [Op.between]: [janela.inicio, janela.fim] },
    },
  }) : [];
  const informadoPorIndicador = {};
  for (const a of acomps) {
    if (a.valor_realizado != null) {
      informadoPorIndicador[a.indicador_id] = (informadoPorIndicador[a.indicador_id] || 0) + Number(a.valor_realizado);
    }
  }

  const mapas = ids.length ? await db.mapa_producao.findAll({
    where: { indicador_id: { [Op.in]: ids }, ativo: 1 },
  }) : [];
  const filtrosPorIndicador = {};
  for (const m of mapas) (filtrosPorIndicador[m.indicador_id] ||= []).push(m);

  // Apurado (faturamento) por indicador — soma dos filtros na faixa de competências.
  // ponytail: 1 query SQL por filtro; escopo "todos" × período longo = muitas queries, aceitável p/ relatório.
  const produzidoPorIndicador = {};
  for (const ind of indicadores) {
    const id = ind.indicador_id;
    const filtros = filtrosPorIndicador[id] || [];
    const cnes = ind.unidade && ind.unidade.cnes;
    if (!filtros.length || !cnes) continue;
    let total = 0;
    for (const f of filtros) {
      total += await somaProducaoFiltro(cnes, cmpIni, cmpFim, f.fonte, f.tipo_filtro, f.valor_filtro, f.cbo);
    }
    produzidoPorIndicador[id] = total;
  }

  // Agrupa contrato → unidade → linhas
  const contratosMap = new Map();
  const totais = { informado: 0, registrado: 0 };
  for (const ind of indicadores) {
    const u = ind.unidade;
    const c = u.contrato;
    if (!contratosMap.has(c.contrato_id)) {
      contratosMap.set(c.contrato_id, { contratoId: c.contrato_id, numero: c.numero, unidades: new Map() });
    }
    const cEntry = contratosMap.get(c.contrato_id);
    if (!cEntry.unidades.has(u.unidade_id)) {
      cEntry.unidades.set(u.unidade_id, {
        unidadeId: u.unidade_id,
        nome: u.nome,
        sigla: u.sigla,
        cnes: u.cnes || null,
        semCnes: !u.cnes,
        linhas: [],
        subtotais: { informado: 0, registrado: 0 },
      });
    }
    const uEntry = cEntry.unidades.get(u.unidade_id);

    const semMapeamento = !filtrosPorIndicador[ind.indicador_id];
    const informado = informadoPorIndicador[ind.indicador_id] != null
      ? parseFloat(informadoPorIndicador[ind.indicador_id].toFixed(4)) : null;
    const registrado = (semMapeamento || !u.cnes) ? null
      : (produzidoPorIndicador[ind.indicador_id] != null ? produzidoPorIndicador[ind.indicador_id] : 0);

    uEntry.linhas.push({
      indicadorId: ind.indicador_id,
      codigo: ind.codigo,
      nome: ind.nome,
      unidadeMedida: ind.unidade_medida || null,
      ...montarLinha({ informado, registrado, semMapeamento }),
    });
    if (informado != null) { uEntry.subtotais.informado += informado; totais.informado += informado; }
    if (registrado != null) { uEntry.subtotais.registrado += registrado; totais.registrado += registrado; }
  }

  const arred = (n) => parseFloat(n.toFixed(4));
  const contratos = [...contratosMap.values()].map((c) => ({
    contratoId: c.contratoId,
    numero: c.numero,
    unidades: [...c.unidades.values()].map((u) => ({
      ...u,
      subtotais: {
        informado: arred(u.subtotais.informado),
        registrado: arred(u.subtotais.registrado),
        diferenca: arred(u.subtotais.informado - u.subtotais.registrado),
      },
    })).sort((a, b) => a.nome.localeCompare(b.nome)),
  })).sort((a, b) => String(a.numero).localeCompare(String(b.numero)));

  return {
    periodo,
    janela,
    escopo,
    totais: {
      informado: arred(totais.informado),
      registrado: arred(totais.registrado),
      diferenca: arred(totais.informado - totais.registrado),
    },
    contratos,
  };
}

module.exports = {
  montarComparacao, comparar, compararPeriodo, somaProducaoFiltro,
};
