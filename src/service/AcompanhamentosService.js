// src/service/AcompanhamentosService.js
const httpStatus = require('http-status');
const { Op } = require('sequelize');
const ApiError = require('../helper/ApiError');
const {
  assertUnidadeNoEscopoOSS,
  assertIndicadorNoEscopoOSS,
  assertAcompanhamentoNoEscopoOSS,
} = require('../helper/ossScopeHelper');
const { fatorLinhaMaiorIgual, cumprimentoGlobalPonderado } = require('../helper/metaCumprimentoPonderado');
const { baseMetaReferencia, absFromPercentualBase } = require('../helper/metaValoresAlvo');
const db = require('../models');

/** Snapshots de acompanhamento: absolutos. Em tb_metas, mín/parcial são % sobre a referência. */
function limitesAbsolutosDaMeta(meta) {
  const base = baseMetaReferencia(meta);
  const mm = meta?.meta_minima != null ? parseFloat(meta.meta_minima) : null;
  const mp = meta?.meta_parcial != null ? parseFloat(meta.meta_parcial) : null;
  return {
    metaMinima: absFromPercentualBase(base, mm),
    metaParcial: absFromPercentualBase(base, mp),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcularStatus(metaTipo, valorRealizado, metaParcial, metaMinima) {
  if (valorRealizado === null || valorRealizado === undefined) return 'pendente';
  if (metaParcial == null || metaMinima == null) return 'pendente';
  const v = parseFloat(valorRealizado);
  const p = parseFloat(metaParcial);
  const m = parseFloat(metaMinima);
  if (metaTipo === 'maior_igual') {
    if (v >= p) return 'atingido';
    if (v >= m) return 'parcial';
    return 'nao_atingido';
  }
  if (v <= m) return 'atingido';
  if (v <= p) return 'parcial';
  return 'nao_atingido';
}

function isMetaFolha(papel) {
  const p = papel || 'avulsa';
  return p === 'avulsa' || p === 'componente';
}

/**
 * Verifica se o intervalo [vi, vf] (com extremos nulos = aberto) se sobrepõe ao
 * mês civil de `mesYmd` (ex.: 2026-04-01). Alinha listagem/criação ao mês
 * de referência em vez de "hoje", evitando sumir com indicadores válidos
 * no mês selecionado.
 */
function vigenciaCobreMesReferencia(mesYmd, vi, vf) {
  if (mesYmd == null || mesYmd === '') return true;
  const s = String(mesYmd).trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
  const y = parseInt(s.slice(0, 4), 10);
  const mo = parseInt(s.slice(5, 7), 10) - 1;
  const inicioDoMes = new Date(y, mo, 1, 0, 0, 0, 0);
  const fimDoMes = new Date(y, mo + 1, 0, 23, 59, 59, 999);
  if (vi != null && String(vi).trim() !== '') {
    const dVi = new Date(vi);
    if (dVi > fimDoMes) return false;
  }
  if (vf != null && String(vf).trim() !== '') {
    const dVf = new Date(vf);
    if (dVf < inicioDoMes) return false;
  }
  return true;
}

function mesReferenciaPadrao() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * @param {Array} metas
 * @param {object} indicador
 * @param {string} [mesReferencia] YYYY-MM-01 — mês alvo; default = mês atual
 */
function metasFolhasVigentes(metas, indicador, mesReferencia) {
  const mes = mesReferencia ?? mesReferenciaPadrao();
  if (!vigenciaCobreMesReferencia(mes, indicador?.vigencia_inicio, indicador?.vigencia_fim)) {
    return [];
  }
  return (metas || [])
    .filter((mt) => {
      if (!isMetaFolha(mt.papel)) return false;
      if (!vigenciaCobreMesReferencia(mes, mt.vigencia_inicio, mt.vigencia_fim)) return false;
      return true;
    })
    .sort((a, b) => (b.versao || 0) - (a.versao || 0));
}

/**
 * acompsList: linhas de acomp do mês para o indicador
 * indicadorMetas: todas as metas do indicador
 */
function buildFAndSomaByParentId(indicadorMetas, acompsList) {
  const acompByMeta = {};
  for (const a of acompsList) {
    acompByMeta[a.meta_id] = a;
  }
  const byParent = {};
  for (const m of indicadorMetas) {
    if (m.papel === 'componente' && m.parent_meta_id) {
      const pid = m.parent_meta_id;
      if (!byParent[pid]) byParent[pid] = [];
      byParent[pid].push(m);
    }
  }
  const FbyParent = new Map();
  const somaByParent = new Map();
  for (const [parentId, kids] of Object.entries(byParent)) {
    const linhas = [];
    let soma = 0;
    for (const k of kids) {
      const a = acompByMeta[k.meta_id];
      const vr = a?.valor_realizado != null ? parseFloat(a.valor_realizado) : null;
      if (vr != null) soma += vr;
      const mvm = a?.meta_vigente_mensal != null
        ? parseFloat(a.meta_vigente_mensal)
        : (k.meta_mensal != null ? parseFloat(k.meta_mensal) : null);
      const absL = limitesAbsolutosDaMeta(k);
      const mm = a?.meta_minima != null
        ? parseFloat(a.meta_minima)
        : absL.metaMinima;
      if (mvm == null || vr == null) continue;
      const f = fatorLinhaMaiorIgual({
        valorRealizado: vr,
        metaVigenteMensal: mvm,
        metaMinima: mm,
      });
      if (k.peso != null) {
        linhas.push({ peso: parseFloat(k.peso), f });
      }
    }
    const F = linhas.length ? cumprimentoGlobalPonderado(linhas) : null;
    FbyParent.set(parentId, F);
    somaByParent.set(parentId, soma);
  }
  return { FbyParent, somaByParent };
}

function toRecord(indicador, meta, acomp, extras = {}) {
  const metaTipo = acomp?.meta_tipo_snap ?? meta?.meta_tipo ?? 'maior_igual';
  const valorRealizado = acomp?.valor_realizado != null ? parseFloat(acomp.valor_realizado) : null;
  const absMeta = meta ? limitesAbsolutosDaMeta(meta) : { metaMinima: null, metaParcial: null };
  const metaMinima = acomp?.meta_minima != null ? parseFloat(acomp.meta_minima) : absMeta.metaMinima;
  const metaParcial = acomp?.meta_parcial != null ? parseFloat(acomp.meta_parcial) : absMeta.metaParcial;
  const metaVigenteMensal = acomp?.meta_vigente_mensal != null ? parseFloat(acomp.meta_vigente_mensal) : (meta?.meta_mensal != null ? parseFloat(meta.meta_mensal) : null);
  const metaVigenteQualit = acomp?.meta_vigente_qualit != null ? parseFloat(acomp.meta_vigente_qualit) : (meta?.meta_valor_qualit != null ? parseFloat(meta.meta_valor_qualit) : null);

  return {
    id: acomp?.acomp_id ?? null,
    indicadorId: indicador.indicador_id,
    metaId: acomp?.meta_id ?? meta?.meta_id ?? null,
    nomeMeta: meta?.nome != null && String(meta.nome).trim() ? String(meta.nome).trim() : null,
    parentMetaId: meta?.parent_meta_id ?? null,
    mesReferencia: acomp?.mes_referencia ?? null,
    metaVigenteMensal,
    metaVigenteQualit,
    metaMinima,
    metaParcial,
    metaTipo,
    valorRealizado,
    percentualCumprimento: metaVigenteMensal && metaVigenteMensal > 0 && valorRealizado !== null
      ? parseFloat(((valorRealizado / metaVigenteMensal) * 100).toFixed(2))
      : null,
    statusCumprimento: calcularStatus(metaTipo, valorRealizado, metaParcial, metaMinima),
    statusAprovacao: acomp?.status_aprovacao ?? null,
    descricaoDesvios: acomp?.descricao_desvios ?? null,
    descontoEstimado: acomp?.desconto_estimado != null ? parseFloat(acomp.desconto_estimado) : 0,
    papelMeta: meta?.papel ?? 'avulsa',
    ...extras,
    indicador: {
      id: indicador.indicador_id,
      nome: indicador.nome,
      tipo: indicador.tipo === 'quantitativo' ? 'producao' : 'qualidade',
      unidadeId: indicador.unidade_id,
      unidadeMedida: indicador.unidade_medida ?? null,
    },
  };
}

// ── Listar — uma linha por meta folha + mês ───────────────────────────────────

const listar = async ({ unidadeId, mesReferencia }, ossIdFiltro = null) => {
  if (!unidadeId) throw new ApiError(httpStatus.BAD_REQUEST, 'unidadeId é obrigatório');

  await assertUnidadeNoEscopoOSS(unidadeId, ossIdFiltro);

  const mes = mesReferencia ?? (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  })();

  const indicadores = await db.indicador.findAll({
    where: { unidade_id: unidadeId, ativo: 1 },
    include: [
      { model: db.meta, as: 'metas', required: false, separate: true, order: [['versao', 'DESC']] },
    ],
  });

  const indicadorIds = indicadores.map((i) => i.indicador_id);

  const acomps = indicadorIds.length
    ? await db.acompanhamento_mensal.findAll({
        where: { indicador_id: { [Op.in]: indicadorIds }, mes_referencia: mes },
      })
    : [];

  const acompsPorIndicador = {};
  for (const a of acomps) {
    if (!acompsPorIndicador[a.indicador_id]) acompsPorIndicador[a.indicador_id] = [];
    acompsPorIndicador[a.indicador_id].push(a);
  }

  const out = [];
  for (const ind of indicadores) {
    const mts = ind.metas ?? [];
    const folhas = metasFolhasVigentes(mts, ind, mes);
    const listaA = acompsPorIndicador[ind.indicador_id] || [];
    const { FbyParent, somaByParent } = buildFAndSomaByParentId(mts, listaA);

    const parentIdsComComponente = new Set(
      folhas
        .filter((f) => f.papel === 'componente' && f.parent_meta_id)
        .map((f) => f.parent_meta_id),
    );
    for (const pid of [...parentIdsComComponente].sort()) {
      const agregada = mts.find((m) => m.meta_id === pid && m.papel === 'agregada');
      if (!agregada) continue;
      out.push(
        toRecord(ind, agregada, null, {
          mesReferencia: mes,
          somenteExibicao: true,
          cumprimentoPonderadoNoGrupo: FbyParent.has(pid) ? FbyParent.get(pid) : null,
          realizadoSomaComponentes: somaByParent.has(pid) ? somaByParent.get(pid) : null,
        }),
      );
    }

    for (const folha of folhas) {
      const acomp = listaA.find((a) => a.meta_id === folha.meta_id) || null;
      const extras = { mesReferencia: acomp?.mes_referencia ?? mes };
      if (folha.papel === 'componente' && folha.parent_meta_id) {
        const pid = folha.parent_meta_id;
        if (FbyParent.has(pid)) extras.cumprimentoPonderadoNoGrupo = FbyParent.get(pid);
        if (somaByParent.has(pid)) extras.realizadoSomaComponentes = somaByParent.get(pid);
      }
      out.push(toRecord(ind, folha, acomp, extras));
    }
  }

  return out;
};

// ── Buscar por id ─────────────────────────────────────────────────────────────

const buscarPorId = async (id, ossIdFiltro = null) => {
  await assertAcompanhamentoNoEscopoOSS(id, ossIdFiltro);
  const acomp = await db.acompanhamento_mensal.findOne({
    where: { acomp_id: id },
    include: [
      {
        model: db.indicador,
        as: 'indicador',
        include: [{ model: db.meta, as: 'metas', required: false }],
      },
      { model: db.meta, as: 'meta', required: false },
    ],
  });
  if (!acomp) throw new ApiError(httpStatus.NOT_FOUND, 'Acompanhamento não encontrado');
  const meta = acomp.meta
    || (acomp.indicador?.metas || []).find((m) => m.meta_id === acomp.meta_id);
  if (!meta) {
    throw new ApiError(httpStatus.UNPROCESSABLE_ENTITY, 'Meta do acompanhamento não encontrada.');
  }
  return toRecord(acomp.indicador, meta, acomp);
};

// ── Criar ─────────────────────────────────────────────────────────────────────

const criar = async (payload, ossIdFiltro = null) => {
  const {
    indicadorId, mesReferencia, valorRealizado, descricaoDesvios, metaId,
  } = payload;

  await assertIndicadorNoEscopoOSS(indicadorId, ossIdFiltro);

  const indicador = await db.indicador.findOne({
    where: { indicador_id: indicadorId, ativo: 1 },
    include: [
      { model: db.meta, as: 'metas', required: false, separate: true, order: [['versao', 'DESC']] },
    ],
  });
  if (!indicador) throw new ApiError(httpStatus.NOT_FOUND, 'Indicador não encontrado');

  const folhas = metasFolhasVigentes(indicador.metas ?? [], indicador, mesReferencia);
  if (!folhas.length) {
    throw new ApiError(httpStatus.UNPROCESSABLE_ENTITY, 'Indicador não possui meta vigente para lançamento');
  }

  let meta;
  if (metaId) {
    meta = folhas.find((f) => f.meta_id === metaId);
    if (!meta) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'metaId não corresponde a uma meta folha vigente deste indicador.');
    }
  } else if (folhas.length === 1) {
    [meta] = folhas;
  } else {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'metaId é obrigatório quando há múltiplas metas folhas vigentes para o indicador.',
    );
  }

  if (meta.papel === 'agregada') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Lance o realizado nas metas componentes, não na meta agregada.');
  }

  const existente = await db.acompanhamento_mensal.findOne({
    where: { meta_id: meta.meta_id, mes_referencia: mesReferencia },
  });
  if (existente) {
    throw new ApiError(httpStatus.CONFLICT, 'Acompanhamento já existe para esta meta e mês. Use PUT para atualizar.');
  }

  const metaTipo = meta?.meta_tipo ?? 'maior_igual';
  const { metaMinima, metaParcial } = limitesAbsolutosDaMeta(meta);
  const metaVigenteMensal = meta?.meta_mensal != null ? parseFloat(meta.meta_mensal) : null;
  const metaVigenteQualit = meta?.meta_valor_qualit != null ? parseFloat(meta.meta_valor_qualit) : null;
  const v = parseFloat(valorRealizado);
  const statusCumprimento = calcularStatus(metaTipo, v, metaParcial, metaMinima);

  const novo = await db.acompanhamento_mensal.create({
    indicador_id: indicadorId,
    meta_id: meta.meta_id,
    mes_referencia: mesReferencia,
    meta_vigente_mensal: metaVigenteMensal,
    meta_vigente_qualit: metaVigenteQualit,
    meta_minima: metaMinima,
    meta_parcial: metaParcial,
    meta_tipo_snap: metaTipo,
    valor_realizado: v,
    status_cumprimento: statusCumprimento,
    status_aprovacao: 'submetido',
    descricao_desvios: descricaoDesvios ?? null,
  });

  return toRecord(indicador, meta, novo);
};

// ── Atualizar ─────────────────────────────────────────────────────────────────

const atualizar = async (id, payload, ossIdFiltro = null) => {
  await assertAcompanhamentoNoEscopoOSS(id, ossIdFiltro);
  const acomp = await db.acompanhamento_mensal.findOne({
    where: { acomp_id: id },
    include: [
      {
        model: db.indicador,
        as: 'indicador',
        include: [{ model: db.meta, as: 'metas', required: false }],
      },
      { model: db.meta, as: 'meta', required: false },
    ],
  });
  if (!acomp) throw new ApiError(httpStatus.NOT_FOUND, 'Acompanhamento não encontrado');

  const meta = acomp.meta
    || (acomp.indicador?.metas || []).find((m) => m.meta_id === acomp.meta_id);

  const metaTipo = acomp.meta_tipo_snap ?? 'maior_igual';
  const metaMinima = acomp.meta_minima != null ? parseFloat(acomp.meta_minima) : null;
  const metaParcial = acomp.meta_parcial != null ? parseFloat(acomp.meta_parcial) : null;
  const metaVigenteMensal = acomp.meta_vigente_mensal != null ? parseFloat(acomp.meta_vigente_mensal) : null;
  const v = parseFloat(payload.valorRealizado);
  const statusCumprimento = calcularStatus(metaTipo, v, metaParcial, metaMinima);

  await acomp.update({
    valor_realizado: v,
    status_cumprimento: statusCumprimento,
    descricao_desvios: payload.descricaoDesvios ?? acomp.descricao_desvios,
  });

  return toRecord(acomp.indicador, meta, await acomp.reload());
};

module.exports = { listar, buscarPorId, criar, atualizar, calcularStatus };
