const { Op } = require('sequelize');
const db = require('../models');
const { janelaDoPeriodo, janelaUltimosMeses } = require('../helper/periodoRelatorio');
const { calcularStatusCumprimento, calcularFaixaProducao } = require('./AcompanhamentoService');
const { assertContratoNoEscopoOSS, assertUnidadeNoEscopoOSS } = require('../helper/ossScopeHelper');

/** Monta os `where` de unidade/contrato conforme escopo + filtro de OSS. */
function buildEscopoWhere({ escopo, contratoId, unidadeId }, ossIdFiltro) {
  const unidadeWhere = {};
  if (escopo === 'unidade' && unidadeId) unidadeWhere.unidade_id = unidadeId;
  const contratoWhere = {};
  if (escopo === 'contrato' && contratoId) contratoWhere.contrato_id = contratoId;
  if (ossIdFiltro) contratoWhere.oss_id = ossIdFiltro;
  return { unidadeWhere, contratoWhere };
}

/** Indicadores ativos no escopo, com unidade+contrato (e metas se pedido). */
async function fetchIndicadoresNoEscopo(params, ossIdFiltro, { comMetas = false } = {}) {
  const { unidadeWhere, contratoWhere } = buildEscopoWhere(params, ossIdFiltro);
  const include = [{
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
  }];
  if (comMetas) include.push({ model: db.meta, as: 'metas', required: false });
  // Informativos (obrigatorio=0) ficam fora do Dashboard e Relatório CMS
  return db.indicador.findAll({ where: { ativo: 1, obrigatorio: 1 }, include });
}

/** Meta folha vigente (maior versão, não agregada) do indicador. */
function metaVigente(metas) {
  const arr = Array.isArray(metas) ? metas : [];
  return arr
    .filter((m) => m.papel !== 'agregada')
    .sort((a, b) => (b.versao || 0) - (a.versao || 0))[0] || arr[0] || null;
}

/** Meta do período: proporcional (base × meses) ou anual cheia. */
function metaDoPeriodo(indicador, meta, janela) {
  if (!meta) return null;
  const num = (v) => (v != null ? parseFloat(v) : null);
  if (indicador.tipo === 'qualitativo') {
    const q = num(meta.meta_valor_qualit);
    return q != null ? q * janela.meses : null; // ano → meses=12
  }
  const mensal = num(meta.meta_mensal);
  if (janela.anual) {
    const anual = num(meta.meta_anual);
    if (anual != null) return anual;
    return mensal != null ? mensal * 12 : null;
  }
  return mensal != null ? mensal * janela.meses : null;
}

function linhaIndicador(indicador, acomps, janela) {
  const meta = metaVigente(indicador.metas);
  const realizadoAcum = parseFloat(acomps.reduce(
    (s, a) => s + (a.valor_realizado != null ? parseFloat(a.valor_realizado) : 0),
    0,
  ).toFixed(4));
  const metaPeriodo = metaDoPeriodo(indicador, meta, janela);
  const percentual = metaPeriodo && metaPeriodo > 0
    ? parseFloat(((realizadoAcum / metaPeriodo) * 100).toFixed(2))
    : null;

  return {
    indicadorId: indicador.indicador_id,
    codigo: indicador.codigo,
    nome: indicador.nome,
    tipo: indicador.tipo,
    grupo: indicador.grupo,
    unidadeMedida: indicador.unidade_medida ?? null,
    metaBase: meta
      ? parseFloat(indicador.tipo === 'qualitativo' ? (meta.meta_valor_qualit ?? 0) : (meta.meta_mensal ?? 0))
      : null,
    metaPeriodo,
    realizadoAcum,
    mesesComLancamento: acomps.length,
    percentual,
    status: calcularStatusCumprimento(percentual, meta),
    faixa: calcularFaixaProducao(percentual),
  };
}

/**
 * @param {{mes:string, periodo:string, escopo:string, contratoId?:string, unidadeId?:string}} params
 * @param {string|null} ossIdFiltro
 */
const gerar = async (params, ossIdFiltro = null) => {
  const {
    mes, periodo, escopo, contratoId, unidadeId,
  } = params;
  const janela = janelaDoPeriodo(mes, periodo);

  if (escopo === 'contrato') await assertContratoNoEscopoOSS(contratoId, ossIdFiltro);
  if (escopo === 'unidade') await assertUnidadeNoEscopoOSS(unidadeId, ossIdFiltro);

  const indicadores = await fetchIndicadoresNoEscopo(
    { escopo, contratoId, unidadeId }, ossIdFiltro, { comMetas: true },
  );

  const indicadorIds = indicadores.map((i) => i.indicador_id);
  const acomps = indicadorIds.length
    ? await db.acompanhamento_mensal.findAll({
      where: {
        indicador_id: { [Op.in]: indicadorIds },
        mes_referencia: { [Op.between]: [janela.inicio, janela.fim] },
      },
    })
    : [];

  const acompsPorIndicador = {};
  for (const a of acomps) {
    (acompsPorIndicador[a.indicador_id] ||= []).push(a);
  }

  // Agrupa contrato → unidade → {quantitativos, qualitativos}
  const contratosMap = new Map();
  const resumo = {
    cumprido: 0, parcial: 0, nao_cumprido: 0, aguardando: 0, total: 0,
  };

  for (const ind of indicadores) {
    const u = ind.unidade;
    const c = u.contrato;
    if (!contratosMap.has(c.contrato_id)) {
      contratosMap.set(c.contrato_id, {
        contratoId: c.contrato_id,
        numero: c.numero,
        valorMensalBase: parseFloat(c.valor_mensal_base),
        unidades: new Map(),
      });
    }
    const cEntry = contratosMap.get(c.contrato_id);
    if (!cEntry.unidades.has(u.unidade_id)) {
      cEntry.unidades.set(u.unidade_id, {
        unidadeId: u.unidade_id,
        nome: u.nome,
        sigla: u.sigla,
        tipo: u.tipo,
        quantitativos: [],
        qualitativos: [],
      });
    }
    const uEntry = cEntry.unidades.get(u.unidade_id);

    const linha = linhaIndicador(ind, acompsPorIndicador[ind.indicador_id] || [], janela);
    (ind.tipo === 'qualitativo' ? uEntry.qualitativos : uEntry.quantitativos).push(linha);

    resumo.total += 1;
    if (linha.status in resumo) resumo[linha.status] += 1;
    else resumo.aguardando += 1;
  }

  const contratos = [...contratosMap.values()]
    .map((c) => ({
      ...c,
      unidades: [...c.unidades.values()].sort((a, b) => a.nome.localeCompare(b.nome)),
    }))
    .sort((a, b) => String(a.numero).localeCompare(String(b.numero)));

  return {
    periodo,
    janela,
    resumo: {
      cumpridos: resumo.cumprido,
      parciais: resumo.parcial,
      naoCumpridos: resumo.nao_cumprido,
      aguardando: resumo.aguardando,
      total: resumo.total,
    },
    contratos,
  };
};

/**
 * Série mensal para o Dashboard: últimos `meses` meses terminando em `mes`.
 * @param {{mes:string, meses?:number, escopo:string, contratoId?:string, unidadeId?:string}} params
 * @param {string|null} ossIdFiltro
 * @returns {Promise<Array<{mes:string, realizadoProducao:number, metaProducao:number, taxaCumprimento:number, cumpridos:number, total:number}>>}
 */
const serieMensal = async (params, ossIdFiltro = null) => {
  const {
    mes, meses = 8, escopo, contratoId, unidadeId,
  } = params;
  const janela = janelaUltimosMeses(mes, meses);

  if (escopo === 'contrato') await assertContratoNoEscopoOSS(contratoId, ossIdFiltro);
  if (escopo === 'unidade') await assertUnidadeNoEscopoOSS(unidadeId, ossIdFiltro);

  const indicadores = await fetchIndicadoresNoEscopo({ escopo, contratoId, unidadeId }, ossIdFiltro);
  const tipoPorId = new Map(indicadores.map((i) => [i.indicador_id, i.tipo]));
  const indicadorIds = [...tipoPorId.keys()];

  const acomps = indicadorIds.length
    ? await db.acompanhamento_mensal.findAll({
      where: {
        indicador_id: { [Op.in]: indicadorIds },
        mes_referencia: { [Op.between]: [janela.inicio, janela.fim] },
      },
    })
    : [];

  // Bucket por mês (chave 'YYYY-MM-01')
  const porMes = new Map();
  const bucket = (k) => {
    if (!porMes.has(k)) porMes.set(k, { realizadoProducao: 0, metaProducao: 0, cumpridos: 0, total: 0 });
    return porMes.get(k);
  };
  for (const a of acomps) {
    const k = String(a.mes_referencia).slice(0, 7).concat('-01');
    const b = bucket(k);
    b.total += 1;
    if (a.status_cumprimento === 'cumprido') b.cumpridos += 1;
    if (tipoPorId.get(a.indicador_id) === 'quantitativo') {
      if (a.valor_realizado != null) b.realizadoProducao += parseFloat(a.valor_realizado);
      if (a.meta_vigente_mensal != null) b.metaProducao += parseFloat(a.meta_vigente_mensal);
    }
  }

  // Preenche todos os meses da janela (inclusive sem lançamento) para a linha não ter buracos
  const out = [];
  const [yi, mi] = janela.inicio.split('-').map(Number);
  for (let idx = 0; idx < janela.meses; idx += 1) {
    const total = (yi * 12) + (mi - 1) + idx;
    const k = `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`;
    const b = porMes.get(k) || { realizadoProducao: 0, metaProducao: 0, cumpridos: 0, total: 0 };
    out.push({
      mes: k,
      realizadoProducao: parseFloat(b.realizadoProducao.toFixed(4)),
      metaProducao: parseFloat(b.metaProducao.toFixed(4)),
      taxaCumprimento: b.total > 0 ? parseFloat(((b.cumpridos / b.total) * 100).toFixed(2)) : 0,
      cumpridos: b.cumpridos,
      total: b.total,
    });
  }
  return out;
};

/**
 * Detalhe mês a mês por indicador (para o modal de detalhe do Dashboard).
 * Mesmos params/escopo do relatório CMS. Agregado já vem do `gerar`; aqui
 * devolvemos só a matriz mensal para montar tabela + gráfico de evolução.
 * @returns {Promise<Object<string, Array<{mes:string, realizado:number|null, meta:number|null}>>>}
 *   mapa indicadorId → pontos mensais em ordem decrescente de mês.
 */
const detalheMensal = async (params, ossIdFiltro = null) => {
  const {
    mes, periodo, escopo, contratoId, unidadeId,
  } = params;
  const janela = janelaDoPeriodo(mes, periodo);

  if (escopo === 'contrato') await assertContratoNoEscopoOSS(contratoId, ossIdFiltro);
  if (escopo === 'unidade') await assertUnidadeNoEscopoOSS(unidadeId, ossIdFiltro);

  const indicadores = await fetchIndicadoresNoEscopo(
    { escopo, contratoId, unidadeId }, ossIdFiltro, { comMetas: true },
  );
  const indicadorIds = indicadores.map((i) => i.indicador_id);

  // Meta de fallback por indicador (quando o acomp não tem meta_vigente_mensal).
  const metaFallback = new Map();
  for (const ind of indicadores) {
    const m = metaVigente(ind.metas);
    const isQual = ind.tipo === 'qualitativo';
    const v = m
      ? parseFloat((isQual ? m.meta_valor_qualit : m.meta_mensal) ?? 0)
      : null;
    metaFallback.set(ind.indicador_id, { isQual, v });
  }

  const acomps = indicadorIds.length
    ? await db.acompanhamento_mensal.findAll({
      where: {
        indicador_id: { [Op.in]: indicadorIds },
        mes_referencia: { [Op.between]: [janela.inicio, janela.fim] },
      },
    })
    : [];

  const porIndicador = {};
  for (const a of acomps) {
    const fb = metaFallback.get(a.indicador_id) || { isQual: false, v: null };
    const meta = fb.isQual
      ? fb.v
      : (a.meta_vigente_mensal != null ? parseFloat(a.meta_vigente_mensal) : fb.v);
    (porIndicador[a.indicador_id] ||= []).push({
      mes: String(a.mes_referencia).slice(0, 7),
      realizado: a.valor_realizado != null ? parseFloat(a.valor_realizado) : null,
      meta,
    });
  }
  // Ordem decrescente de mês.
  for (const id of Object.keys(porIndicador)) {
    porIndicador[id].sort((x, y) => y.mes.localeCompare(x.mes));
  }
  return porIndicador;
};

/** Último mês com acompanhamento lançado (YYYY-MM-01) ou null. */
const ultimoMesComDados = async () => {
  const row = await db.acompanhamento_mensal.findOne({
    attributes: [[db.sequelize.fn('MAX', db.sequelize.col('mes_referencia')), 'mes']],
    raw: true,
  });
  return row && row.mes ? String(row.mes).slice(0, 10) : null;
};

module.exports = {
  gerar, serieMensal, detalheMensal, ultimoMesComDados, metaDoPeriodo, buildEscopoWhere,
};
