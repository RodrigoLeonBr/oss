const { Op } = require('sequelize');
const db = require('../models');
const { janelaDoPeriodo, janelaUltimosMeses } = require('../helper/periodoRelatorio');
const { calcularStatusCumprimento, calcularFaixaProducao } = require('./AcompanhamentoService');
const { assertContratoNoEscopoOSS, assertUnidadeNoEscopoOSS } = require('../helper/ossScopeHelper');
const {
  regraEfetiva, fatorProporcional, fatorNivel, percentualPorEscala,
} = require('../helper/percentualRecebimento');
const { faixasEfetivas } = require('../helper/avaliacaoCumprimento');

/** Monta os `where` de unidade/contrato conforme escopo + filtro de OSS. */
function buildEscopoWhere({ escopo, contratoId, unidadeId }, ossIdFiltro) {
  const unidadeWhere = {};
  if (escopo === 'unidade' && unidadeId) unidadeWhere.unidade_id = unidadeId;
  const contratoWhere = {};
  if (escopo === 'contrato' && contratoId) contratoWhere.contrato_id = contratoId;
  if (ossIdFiltro) contratoWhere.oss_id = ossIdFiltro;
  return { unidadeWhere, contratoWhere };
}

const mesIdx = (d) => {
  const [y, m] = String(d).slice(0, 7).split('-').map(Number);
  return (y * 12) + m - 1;
};

/** Meses da janela em que o indicador está vigente (vigência nula = aberta). */
function mesesVigentes(janela, ind) {
  const ini = Math.max(mesIdx(janela.inicio), ind.vigencia_inicio ? mesIdx(ind.vigencia_inicio) : -Infinity);
  const fim = Math.min(mesIdx(janela.fim), ind.vigencia_fim ? mesIdx(ind.vigencia_fim) : Infinity);
  return Math.max(0, fim - ini + 1);
}

/** where Sequelize: vigência do indicador cruza a janela (nulos abertos). */
const vigenteNaJanela = (janela) => {
  const p = mesIdx(janela.fim) + 1; // 1º dia do mês seguinte ao fim
  const aposFim = `${Math.floor(p / 12)}-${String((p % 12) + 1).padStart(2, '0')}-01`;
  return {
    [Op.and]: [
      { [Op.or]: [{ vigencia_inicio: null }, { vigencia_inicio: { [Op.lt]: aposFim } }] },
      { [Op.or]: [{ vigencia_fim: null }, { vigencia_fim: { [Op.gte]: janela.inicio } }] },
    ],
  };
};

/** Indicadores ativos no escopo (vigentes na janela, se dada), com unidade+contrato (e metas se pedido). */
async function fetchIndicadoresNoEscopo(params, ossIdFiltro, { comMetas = false, janela = null } = {}) {
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
  if (comMetas) {
    include.push({ model: db.meta, as: 'metas', required: false });
    include.push({ model: db.bloco_producao, as: 'bloco', required: false });
  }
  // Informativos (obrigatorio=0) ficam fora do Dashboard e Relatório CMS
  return db.indicador.findAll({ where: { ativo: 1, obrigatorio: 1, ...(janela ? vigenteNaJanela(janela) : {}) }, include });
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

/** Lançamento dentro da vigência do indicador (descarta órfãos de conjunto já encerrado). */
const naVigencia = (ind, a) => (!ind.vigencia_inicio || mesIdx(a.mes_referencia) >= mesIdx(ind.vigencia_inicio))
  && (!ind.vigencia_fim || mesIdx(a.mes_referencia) <= mesIdx(ind.vigencia_fim));

function linhaIndicador(indicador, todos, janela) {
  const acomps = todos.filter((a) => naVigencia(indicador, a));
  const meta = metaVigente(indicador.metas);
  const realizadoAcum = parseFloat(acomps.reduce(
    (s, a) => s + (a.valor_realizado != null ? parseFloat(a.valor_realizado) : 0),
    0,
  ).toFixed(4));
  // Meta só dos meses em que o indicador vigora (troca de conjunto no meio da janela, ex.: aditivo)
  const meses = mesesVigentes(janela, indicador);
  const metaPeriodo = metaDoPeriodo(indicador, meta, meses < janela.meses ? { ...janela, meses, anual: false } : janela);
  const comValor = acomps.some((a) => a.valor_realizado != null);
  const percentual = comValor && metaPeriodo && metaPeriodo > 0
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
    blocoId: indicador.bloco_id || null,
    blocoNome: indicador.bloco?.nome || null,
    pesoIndicador: indicador.peso_perc != null ? parseFloat(indicador.peso_perc) : null,
    meta: meta ? {
      meta_tipo: meta.meta_tipo, meta_minima: meta.meta_minima, meta_parcial: meta.meta_parcial,
    } : null,
  };
}

const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

/** producao_qualidade: % considerado = 100 − desconto da faixa de alcance. */
function producaoConsiderado(pct, regra) {
  const faixas = regra.producao?.faixas || [];
  const desc = percentualPorEscala(pct, faixas.map((f) => ({ min: f.min, perc: f.desc })), regra.producao?.abaixo ?? 0);
  return desc == null ? null : 100 - desc;
}

/**
 * Pontuação de uma unidade pela regra de recebimento da vigência (mesmos fatores do Recebimento).
 * Linha: consideradoPerc (0–100), limiar (% da meta que já vale 100%), peso e pontos (= peso × considerado).
 * Quantitativo pontua por bloco (Σreal/Σmeta das linhas do bloco, ex.: SADT = RX + Lab); qualitativo por linha.
 * Sem lançamento conta 0 no peso (como no Recebimento) e fica em `pendentes`. Muta as linhas (acrescenta campos).
 */
function pontuarUnidade(quantitativos, qualitativos, regraBruta, pesoBloco) {
  const regra = regraEfetiva(regraBruta);
  const producao = regra.modelo === 'producao_qualidade';
  const limiarProd = producao
    ? Math.max(0, ...(regra.producao?.faixas || []).filter((f) => !f.desc).map((f) => f.min))
    : null;
  const fatorQual = {
    niveis: fatorNivel,
    binaria: (pct, meta) => fatorNivel(pct, meta, true),
  }[regra.pontuacao] || fatorProporcional;
  const consideradoQuant = (pct, meta) => {
    if (pct == null) return null;
    return producao ? producaoConsiderado(pct, regra) : fatorProporcional(pct, meta) * 100;
  };

  for (const l of quantitativos) {
    const f = faixasEfetivas(l.meta);
    l.limiar = producao ? { tipo: 'maior_igual', valor: limiarProd } : { tipo: f.tipo, valor: f.cumprido };
    l.consideradoPerc = r2(consideradoQuant(l.percentual, l.meta));
  }

  const blocosMap = new Map();
  for (const l of quantitativos) {
    const k = l.blocoId || l.indicadorId;
    if (!blocosMap.has(k)) {
      blocosMap.set(k, {
        blocoId: l.blocoId, nome: l.blocoNome || l.nome, peso: l.blocoId ? pesoBloco(l.blocoId) : null, linhas: [],
      });
    }
    blocosMap.get(k).linhas.push(l);
  }
  const blocos = [...blocosMap.values()].map((b) => {
    const comDado = b.linhas.filter((l) => l.percentual != null && l.metaPeriodo > 0);
    const real = comDado.reduce((s, l) => s + l.realizadoAcum, 0);
    const base = comDado.reduce((s, l) => s + l.metaPeriodo, 0);
    const alcance = comDado.length ? (real / base) * 100 : null;
    const c = consideradoQuant(alcance, comDado[0]?.meta);
    let pontos = null;
    if (b.peso != null) pontos = c != null ? r2((b.peso * c) / 100) : 0;
    return {
      blocoId: b.blocoId,
      nome: b.nome,
      indicadores: b.linhas.map((l) => l.codigo),
      alcance: r2(alcance),
      consideradoPerc: r2(c),
      peso: b.peso,
      pontos,
      pendente: c == null,
    };
  });
  const comPeso = blocos.filter((b) => b.peso > 0);
  const pesoQuant = comPeso.reduce((s, b) => s + b.peso, 0);
  const pontosQuant = comPeso.reduce((s, b) => s + (b.pontos || 0), 0);
  const quant = pesoQuant > 0 ? {
    peso: r2(pesoQuant),
    pontos: r2(pontosQuant),
    percentual: r2((pontosQuant / pesoQuant) * 100),
    pendentes: comPeso.filter((b) => b.pendente).length,
  } : null;

  for (const l of qualitativos) {
    const f = faixasEfetivas(l.meta);
    l.limiar = { tipo: f.tipo, valor: f.cumprido };
    const c = l.percentual != null ? fatorQual(l.percentual, l.meta) * 100 : null;
    l.consideradoPerc = r2(c);
    l.peso = l.pesoIndicador > 0 ? l.pesoIndicador : null;
    l.pontos = l.peso != null ? r2((l.peso * (c ?? 0)) / 100) : null;
  }
  const qPeso = qualitativos.filter((l) => l.peso > 0);
  const pesoQual = qPeso.reduce((s, l) => s + l.peso, 0);
  const pontosQual = qPeso.reduce((s, l) => s + (l.pontos || 0), 0);
  const nota = pesoQual > 0 ? (pontosQual / pesoQual) * 100 : null;
  const linear = regra.qualidade?.modo === 'linear';
  const qual = pesoQual > 0 ? {
    peso: r2(pesoQual),
    pontos: r2(pontosQual),
    nota: r2(nota),
    percEscala: linear ? null : percentualPorEscala(nota, regra.escala, regra.abaixo),
    pendentes: qPeso.filter((l) => l.consideradoPerc == null).length,
  } : null;

  return {
    modelo: regra.modelo, pontuacao: regra.pontuacao, escala: linear ? null : regra.escala, blocos, quant, qual,
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
    { escopo, contratoId, unidadeId }, ossIdFiltro, { comMetas: true, janela },
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

  // Regra de recebimento e pesos de bloco vigentes no fim da janela
  const noFim = vigenteNaJanela({ inicio: janela.fim, fim: janela.fim });
  const contratoIds = [...new Set(indicadores.map((i) => i.unidade.contrato.contrato_id))];
  const hists = contratoIds.length
    ? await db.historico_contrato.findAll({ where: { contrato_id: contratoIds, ...noFim }, order: [['versao', 'DESC']] })
    : [];
  const blocoIds = [...new Set(indicadores.map((i) => i.bloco_id).filter(Boolean))];
  const histBlocos = blocoIds.length
    ? await db.historico_bloco.findAll({ where: { bloco_id: blocoIds, ...noFim }, order: [['versao', 'DESC']] })
    : [];
  const blocoPorId = new Map(indicadores.filter((i) => i.bloco).map((i) => [i.bloco_id, i.bloco]));

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
    .map((c) => {
      const hist = hists.find((h) => h.contrato_id === c.contratoId);
      const bruta = hist?.regra_recebimento ? JSON.parse(hist.regra_recebimento) : null;
      const unidades = [...c.unidades.values()].map((u) => {
        const regraU = bruta?.unidades?.[u.unidadeId] || bruta;
        const pesoBloco = (blocoId) => {
          const bloco = blocoPorId.get(blocoId);
          const daRegra = bloco && regraU?.pesos_blocos?.[bloco.codigo];
          if (daRegra != null) return parseFloat(daRegra);
          const h = histBlocos.find((x) => x.bloco_id === blocoId);
          const v = h ? h.percentual_peso_bloco : bloco?.percentual_peso_bloco;
          return v != null ? parseFloat(v) : null;
        };
        return { ...u, pontuacao: pontuarUnidade(u.quantitativos, u.qualitativos, regraU, pesoBloco) };
      });
      return { ...c, unidades: unidades.sort((a, b) => a.nome.localeCompare(b.nome)) };
    })
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

  const indicadores = await fetchIndicadoresNoEscopo({ escopo, contratoId, unidadeId }, ossIdFiltro, { janela });
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
    { escopo, contratoId, unidadeId }, ossIdFiltro, { comMetas: true, janela },
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
  gerar, serieMensal, detalheMensal, ultimoMesComDados, metaDoPeriodo, buildEscopoWhere, mesesVigentes, pontuarUnidade,
};
