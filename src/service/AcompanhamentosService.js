// src/service/AcompanhamentosService.js
const httpStatus = require('http-status');
const ApiError = require('../helper/ApiError');
const db = require('../models');

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
  // menor_igual
  if (v <= m) return 'atingido';
  if (v <= p) return 'parcial';
  return 'nao_atingido';
}

function primeiraMetaVigente(metas) {
  const hoje = new Date();
  return metas
    .filter(mt =>
      new Date(mt.vigencia_inicio) <= hoje &&
      (mt.vigencia_fim == null || new Date(mt.vigencia_fim) >= hoje)
    )
    .sort((a, b) => new Date(b.vigencia_inicio) - new Date(a.vigencia_inicio))[0] ?? null;
}

function toRecord(indicador, meta, acomp) {
  const metaTipo = acomp?.meta_tipo_snap ?? meta?.meta_tipo ?? 'maior_igual';
  const valorRealizado = acomp?.valor_realizado != null ? parseFloat(acomp.valor_realizado) : null;
  const metaMinima = acomp?.meta_minima != null ? parseFloat(acomp.meta_minima) : (meta?.meta_minima != null ? parseFloat(meta.meta_minima) : null);
  const metaParcial = acomp?.meta_parcial != null ? parseFloat(acomp.meta_parcial) : (meta?.meta_parcial != null ? parseFloat(meta.meta_parcial) : null);
  const metaVigenteMensal = acomp?.meta_vigente_mensal != null ? parseFloat(acomp.meta_vigente_mensal) : (meta?.meta_mensal != null ? parseFloat(meta.meta_mensal) : null);
  const metaVigenteQualit = acomp?.meta_vigente_qualit != null ? parseFloat(acomp.meta_vigente_qualit) : (meta?.meta_valor_qualit != null ? parseFloat(meta.meta_valor_qualit) : null);

  return {
    id:                   acomp?.acomp_id ?? null,
    indicadorId:          indicador.indicador_id,
    metaId:               acomp?.meta_id ?? meta?.meta_id ?? null,
    mesReferencia:        acomp?.mes_referencia ?? null,
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
    statusAprovacao:   acomp?.status_aprovacao ?? null,
    descricaoDesvios:  acomp?.descricao_desvios ?? null,
    descontoEstimado:  acomp?.desconto_estimado != null ? parseFloat(acomp.desconto_estimado) : 0,
    indicador: {
      id:           indicador.indicador_id,
      nome:         indicador.nome,
      tipo:         indicador.tipo === 'quantitativo' ? 'producao' : 'qualidade',
      unidadeId:    indicador.unidade_id,
      unidadeMedida: indicador.unidade_medida ?? null,
    },
  };
}

// ── Listar — merge indicadores + metas + acompanhamentos ─────────────────────

const listar = async ({ unidadeId, mesReferencia }) => {
  if (!unidadeId) throw new ApiError(httpStatus.BAD_REQUEST, 'unidadeId é obrigatório');

  const mes = mesReferencia ?? (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  })();

  const indicadores = await db.indicador.findAll({
    where: { unidade_id: unidadeId, ativo: 1 },
    include: [{ model: db.meta, as: 'metas', required: false }],
  });

  const indicadorIds = indicadores.map(i => i.indicador_id);

  const acomps = indicadorIds.length > 0
    ? await db.acompanhamento_mensal.findAll({
        where: { indicador_id: indicadorIds, mes_referencia: mes },
      })
    : [];

  const acompByIndicador = {};
  for (const a of acomps) acompByIndicador[a.indicador_id] = a;

  return indicadores.map(ind => {
    const meta = primeiraMetaVigente(ind.metas ?? []);
    const acomp = acompByIndicador[ind.indicador_id] ?? null;
    return toRecord(ind, meta, acomp);
  });
};

// ── Buscar por id ─────────────────────────────────────────────────────────────

const buscarPorId = async (id) => {
  const acomp = await db.acompanhamento_mensal.findOne({
    where: { acomp_id: id },
    include: [{
      model: db.indicador,
      as: 'indicador',
      include: [{ model: db.meta, as: 'metas', required: false }],
    }],
  });
  if (!acomp) throw new ApiError(httpStatus.NOT_FOUND, 'Acompanhamento não encontrado');
  const meta = primeiraMetaVigente(acomp.indicador?.metas ?? []);
  return toRecord(acomp.indicador, meta, acomp);
};

// ── Criar ─────────────────────────────────────────────────────────────────────

const criar = async (payload) => {
  const { indicadorId, mesReferencia, valorRealizado, descricaoDesvios } = payload;

  const existente = await db.acompanhamento_mensal.findOne({
    where: { indicador_id: indicadorId, mes_referencia: mesReferencia },
  });
  if (existente) throw new ApiError(httpStatus.CONFLICT, 'Acompanhamento já existe para este indicador e mês. Use PUT para atualizar.');

  const indicador = await db.indicador.findOne({
    where: { indicador_id: indicadorId, ativo: 1 },
    include: [{ model: db.meta, as: 'metas', required: false }],
  });
  if (!indicador) throw new ApiError(httpStatus.NOT_FOUND, 'Indicador não encontrado');

  const meta = primeiraMetaVigente(indicador.metas ?? []);
  if (!meta) throw new ApiError(httpStatus.UNPROCESSABLE_ENTITY, 'Indicador não possui meta vigente para lançamento');
  const metaTipo = meta?.meta_tipo ?? 'maior_igual';
  const metaMinima = meta?.meta_minima != null ? parseFloat(meta.meta_minima) : null;
  const metaParcial = meta?.meta_parcial != null ? parseFloat(meta.meta_parcial) : null;
  const metaVigenteMensal = meta?.meta_mensal != null ? parseFloat(meta.meta_mensal) : null;
  const metaVigenteQualit = meta?.meta_valor_qualit != null ? parseFloat(meta.meta_valor_qualit) : null;
  const v = parseFloat(valorRealizado);
  const statusCumprimento = calcularStatus(metaTipo, v, metaParcial, metaMinima);
  const percentual = metaVigenteMensal && metaVigenteMensal > 0
    ? parseFloat(((v / metaVigenteMensal) * 100).toFixed(4))
    : null;

  const novo = await db.acompanhamento_mensal.create({
    indicador_id:        indicadorId,
    meta_id:             meta?.meta_id ?? null,
    mes_referencia:      mesReferencia,
    meta_vigente_mensal: metaVigenteMensal,
    meta_vigente_qualit: metaVigenteQualit,
    meta_minima:         metaMinima,
    meta_parcial:        metaParcial,
    meta_tipo_snap:      metaTipo,
    valor_realizado:     v,
    status_cumprimento:  statusCumprimento,
    status_aprovacao:    'submetido',
    descricao_desvios:   descricaoDesvios ?? null,
  });

  return toRecord(indicador, meta, novo);
};

// ── Atualizar ─────────────────────────────────────────────────────────────────

const atualizar = async (id, payload) => {
  const acomp = await db.acompanhamento_mensal.findOne({
    where: { acomp_id: id },
    include: [{
      model: db.indicador,
      as: 'indicador',
      include: [{ model: db.meta, as: 'metas', required: false }],
    }],
  });
  if (!acomp) throw new ApiError(httpStatus.NOT_FOUND, 'Acompanhamento não encontrado');

  const metaTipo = acomp.meta_tipo_snap ?? 'maior_igual';
  const metaMinima = acomp.meta_minima != null ? parseFloat(acomp.meta_minima) : null;
  const metaParcial = acomp.meta_parcial != null ? parseFloat(acomp.meta_parcial) : null;
  const metaVigenteMensal = acomp.meta_vigente_mensal != null ? parseFloat(acomp.meta_vigente_mensal) : null;
  const v = parseFloat(payload.valorRealizado);
  const statusCumprimento = calcularStatus(metaTipo, v, metaParcial, metaMinima);
  const percentual = metaVigenteMensal && metaVigenteMensal > 0
    ? parseFloat(((v / metaVigenteMensal) * 100).toFixed(4))
    : null;

  await acomp.update({
    valor_realizado:    v,
    status_cumprimento: statusCumprimento,
    descricao_desvios:      payload.descricaoDesvios ?? acomp.descricao_desvios,
  });

  const meta = primeiraMetaVigente(acomp.indicador?.metas ?? []);
  return toRecord(acomp.indicador, meta, await acomp.reload());
};

module.exports = { listar, buscarPorId, criar, atualizar, calcularStatus };
