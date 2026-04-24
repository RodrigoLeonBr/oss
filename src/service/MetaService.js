const { randomUUID } = require('crypto');
const httpStatus = require('http-status');
const ApiError = require('../helper/ApiError');
const { assertIndicadorNoEscopoOSS, assertMetaNoEscopoOSS } = require('../helper/ossScopeHelper');
const db = require('../models');

/** metaMinima/Parcial em tb_metas: percentual 0–100 sobre a referência (meta_mensal ou meta_valor_qualit). */

const TIPO_TO_API = { quantitativo: 'producao', qualitativo: 'qualidade' };
const SUM_TOL = 1e-4;

/** Vigência e prazo vêm do indicador; colunas em tb_metas ficam legado / nulas. */
function vigenciaEfetiva(d) {
  const ind = d.indicador;
  if (ind && (ind.vigencia_inicio != null || ind.vigencia_fim != null || ind.prazo_implantacao != null)) {
    return {
      inicio: ind.vigencia_inicio ?? d.vigencia_inicio,
      fim: ind.vigencia_fim != null ? ind.vigencia_fim : d.vigencia_fim,
      prazo: ind.prazo_implantacao != null ? ind.prazo_implantacao : d.prazo_implantacao,
    };
  }
  return {
    inicio: d.vigencia_inicio,
    fim: d.vigencia_fim ?? null,
    prazo: d.prazo_implantacao ?? null,
  };
}

// ── Serialização BD → API ─────────────────────────────────────────────────────
function toRecord(m, depth = 0) {
  const d = m.toJSON ? m.toJSON() : m;
  const v = vigenciaEfetiva(d);
  const fim = v.fim ?? null;
  const inicio = v.inicio != null && v.inicio !== '' ? v.inicio : null;
  const rec = {
    id: d.meta_id,
    indicadorId: d.indicador_id,
    versao: d.versao,
    vigenciaInicio: inicio,
    vigenciaFim: fim,
    metaMensal: d.meta_mensal != null ? parseFloat(d.meta_mensal) : null,
    metaAnual: d.meta_anual != null ? parseFloat(d.meta_anual) : null,
    metaValorQualit: d.meta_valor_qualit != null ? parseFloat(d.meta_valor_qualit) : null,
    metaMinima: d.meta_minima != null ? parseFloat(d.meta_minima) : null,
    metaParcial: d.meta_parcial != null ? parseFloat(d.meta_parcial) : null,
    metaTipo: d.meta_tipo ?? 'maior_igual',
    unidadeMedida: d.unidade_medida ?? null,
    nome: d.nome != null && String(d.nome).trim() ? String(d.nome).trim() : (d.observacoes != null && String(d.observacoes).trim() ? String(d.observacoes).trim().slice(0, 500) : null),
    observacoes: d.observacoes ?? null,
    prazoImplantacao: v.prazo ?? null,
    status: !fim || new Date(fim) >= new Date() ? 'vigente' : 'encerrada',
    createdAt: d.criado_em,
    updatedAt: d.atualizado_em,
    parentMetaId: d.parent_meta_id ?? null,
    papel: d.papel ?? 'avulsa',
    peso: d.peso != null && d.peso !== '' ? parseFloat(d.peso) : null,
    indicador: d.indicador
      ? {
        id: d.indicador.indicador_id,
        nome: d.indicador.nome,
        tipo: TIPO_TO_API[d.indicador.tipo] ?? d.indicador.tipo,
        unidadeId: d.indicador.unidade_id,
        vigenciaInicio: d.indicador.vigencia_inicio ?? null,
        vigenciaFim: d.indicador.vigencia_fim ?? null,
        prazoImplantacao: d.indicador.prazo_implantacao ?? null,
        unidade: d.indicador.unidade
          ? { id: d.indicador.unidade.unidade_id, nome: d.indicador.unidade.nome }
          : undefined,
      }
      : undefined,
  };
  if (depth < 2 && m.children && m.children.length) {
    rec.children = m.children.map((ch) => toRecord(ch, depth + 1));
  }
  if (d.parent && depth === 0) {
    rec.parent = toRecord(d.parent, depth + 1);
  }
  return rec;
}

// ── Conversão payload API → campos BD ────────────────────────────────────────
function fromPayload(p) {
  const m = {};
  if (p.indicadorId !== undefined) m.indicador_id = p.indicadorId;
  if (p.aditivoId !== undefined) m.aditivo_id = p.aditivoId ?? null;
  if (p.metaMensal !== undefined) m.meta_mensal = p.metaMensal ?? null;
  if (p.metaAnual !== undefined) m.meta_anual = p.metaAnual ?? null;
  if (p.metaValorQualit !== undefined) m.meta_valor_qualit = p.metaValorQualit ?? null;
  if (p.metaMinima !== undefined) m.meta_minima = p.metaMinima ?? null;
  if (p.metaParcial !== undefined) m.meta_parcial = p.metaParcial ?? null;
  if (p.metaTipo !== undefined) m.meta_tipo = p.metaTipo;
  if (p.unidadeMedida !== undefined) m.unidade_medida = p.unidadeMedida || null;
  if (p.nome !== undefined) m.nome = p.nome != null && String(p.nome).trim() ? String(p.nome).trim() : null;
  if (p.observacoes !== undefined) m.observacoes = p.observacoes || null;
  if (p.papel !== undefined) m.papel = p.papel;
  if (p.parentMetaId !== undefined) m.parent_meta_id = p.parentMetaId || null;
  if (p.peso !== undefined) m.peso = p.peso ?? null;
  return m;
}

// ── Include padrão ────────────────────────────────────────────────────────────
function buildInclude(ossIdFiltro) {
  return [
    {
      model: db.indicador,
      as: 'indicador',
      attributes: [
        'indicador_id',
        'nome',
        'tipo',
        'unidade_id',
        'vigencia_inicio',
        'vigencia_fim',
        'prazo_implantacao',
      ],
      required: Boolean(ossIdFiltro),
      include: [
        {
          model: db.unidade,
          as: 'unidade',
          attributes: ['unidade_id', 'nome'],
          required: Boolean(ossIdFiltro),
          include: ossIdFiltro
            ? [
                {
                  model: db.contrato,
                  as: 'contrato',
                  required: true,
                  attributes: [],
                  where: { oss_id: ossIdFiltro },
                },
              ]
            : [],
        },
      ],
    },
  ];
}

function buildIncludeComChildren(ossIdFiltro) {
  return [
    ...buildInclude(ossIdFiltro),
    {
      model: db.meta,
      as: 'children',
      required: false,
      separate: true,
      include: buildInclude(ossIdFiltro),
      order: [['versao', 'DESC'], ['criado_em', 'DESC']],
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────

const listar = async (filtros = {}, ossIdFiltro = null) => {
  const where = { parent_meta_id: null };
  const uid = filtros.indicadorId ?? filtros.indicador_id;
  if (uid) where.indicador_id = uid;

  const lista = await db.meta.findAll({
    where,
    include: buildIncludeComChildren(ossIdFiltro),
    order: [['versao', 'DESC'], ['criado_em', 'DESC']],
  });
  let records = lista.map((m) => toRecord(m));
  if (filtros.status === 'vigente' || filtros.status === 'encerrada') {
    records = records.filter((r) => r.status === filtros.status);
  }
  return records;
};

const buscarPorId = async (id, ossIdFiltro = null) => {
  await assertMetaNoEscopoOSS(id, ossIdFiltro);
  const meta = await db.meta.findOne({
    where: { meta_id: id },
    include: [
      ...buildIncludeComChildren(null),
      { model: db.meta, as: 'parent', required: false, include: buildInclude(null) },
    ],
  });
  if (!meta) throw new ApiError(httpStatus.NOT_FOUND, 'Meta não encontrada');
  return toRecord(meta);
};

const criar = async (payload, ossIdFiltro = null) => {
  const dados = fromPayload(payload);

  if (!dados.indicador_id) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'indicadorId é obrigatório');
  }

  await assertIndicadorNoEscopoOSS(dados.indicador_id, ossIdFiltro);

  const indicador = await db.indicador.findOne({ where: { indicador_id: dados.indicador_id } });
  if (!indicador) throw new ApiError(httpStatus.NOT_FOUND, 'Indicador não encontrado');

  if (!dados.nome || !String(dados.nome).trim()) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'nome é obrigatório');
  }

  dados.papel = 'avulsa';
  dados.parent_meta_id = null;
  dados.peso = null;

  if (dados.meta_mensal != null && dados.meta_anual == null) {
    dados.meta_anual = parseFloat((dados.meta_mensal * 12).toFixed(4));
  }
  if (dados.meta_anual != null && dados.meta_mensal == null) {
    dados.meta_mensal = parseFloat((dados.meta_anual / 12).toFixed(4));
  }

  const ultimaVersao = await db.meta.max('versao', { where: { indicador_id: dados.indicador_id } });
  dados.versao = (ultimaVersao || 0) + 1;

  dados.vigencia_inicio = null;
  dados.vigencia_fim = null;
  dados.prazo_implantacao = null;

  const meta = await db.meta.create(dados);
  return buscarPorId(meta.meta_id);
};

function sumMetaMensal(list) {
  return list.reduce((s, c) => s + parseFloat(c.metaMensal), 0);
}

function assertSumClose(a, b) {
  if (Math.abs(a - b) > SUM_TOL) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Soma dos componentes (${a.toFixed(4)}) não bate com a meta agregada (${b.toFixed(4)}).`,
    );
  }
}

const criarPacote = async (body, ossIdFiltro = null) => {
  const { indicadorId, agregada, componentes } = body;
  await assertIndicadorNoEscopoOSS(indicadorId, ossIdFiltro);

  const indicador = await db.indicador.findOne({ where: { indicador_id: indicadorId } });
  if (!indicador) throw new ApiError(httpStatus.NOT_FOUND, 'Indicador não encontrado');
  if (indicador.tipo === 'qualitativo') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Indicador qualitativo não permite meta decomposta.');
  }

  const sumC = sumMetaMensal(componentes);
  const sumA = parseFloat(agregada.metaMensal);
  assertSumClose(sumC, sumA);

  const anuaisC = componentes.map((c) => {
    if (c.metaAnual != null) return parseFloat(c.metaAnual);
    return parseFloat((parseFloat(c.metaMensal) * 12).toFixed(4));
  });
  if (agregada.metaAnual != null) {
    const sumAAn = anuaisC.reduce((s, v) => s + v, 0);
    assertSumClose(sumAAn, parseFloat(agregada.metaAnual));
  }

  const ultimaVersao = await db.meta.max('versao', { where: { indicador_id: indicadorId } });
  const versao = (ultimaVersao || 0) + 1;

  if (!agregada.nome || !String(agregada.nome).trim()) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'agregada.nome é obrigatório');
  }
  for (let i = 0; i < componentes.length; i++) {
    if (!componentes[i].nome || !String(componentes[i].nome).trim()) {
      throw new ApiError(httpStatus.BAD_REQUEST, `componentes[${i}].nome é obrigatório`);
    }
  }

  const t = await db.sequelize.transaction();
  try {
    // meta_id com default (UUID() no MySQL) nem sempre volta preenchida no model — sem isso,
    // parent_meta_id nos filhos quebra a FK. Geramos o id no Node e reutilizamos.
    const parentId = randomUUID();
    const pai = await db.meta.create(
      {
        meta_id: parentId,
        indicador_id: indicadorId,
        versao,
        vigencia_inicio: null,
        vigencia_fim: null,
        prazo_implantacao: null,
        meta_mensal: agregada.metaMensal,
        meta_anual:
          agregada.metaAnual != null
            ? agregada.metaAnual
            : parseFloat((parseFloat(agregada.metaMensal) * 12).toFixed(4)),
        meta_tipo: agregada.metaTipo || 'maior_igual',
        meta_minima: agregada.metaMinima ?? null,
        meta_parcial: agregada.metaParcial ?? null,
        unidade_medida: agregada.unidadeMedida || null,
        nome: String(agregada.nome).trim(),
        observacoes: agregada.observacoes ?? null,
        papel: 'agregada',
        parent_meta_id: null,
        peso: null,
      },
      { transaction: t },
    );

    for (const c of componentes) {
      const mAn = c.metaAnual != null ? c.metaAnual : parseFloat((parseFloat(c.metaMensal) * 12).toFixed(4));
      await db.meta.create(
        {
          indicador_id: indicadorId,
          versao,
          vigencia_inicio: null,
          vigencia_fim: null,
          prazo_implantacao: null,
          meta_mensal: c.metaMensal,
          meta_anual: mAn,
          meta_tipo: c.metaTipo || agregada.metaTipo || 'maior_igual',
          meta_minima: c.metaMinima ?? null,
          meta_parcial: c.metaParcial ?? null,
          unidade_medida: agregada.unidadeMedida || null,
          nome: String(c.nome).trim(),
          observacoes: c.observacoes ?? null,
          papel: 'componente',
          parent_meta_id: parentId,
          peso: c.peso,
        },
        { transaction: t },
      );
    }

    await t.commit();
    return buscarPorId(parentId);
  } catch (e) {
    await t.rollback();
    throw e;
  }
};

const atualizar = async (id, payload, ossIdFiltro = null) => {
  await assertMetaNoEscopoOSS(id, ossIdFiltro);
  const meta = await db.meta.findOne({ where: { meta_id: id } });
  if (!meta) throw new ApiError(httpStatus.NOT_FOUND, 'Meta não encontrada');
  if (meta.papel === 'agregada') {
    const n = await db.meta.count({ where: { parent_meta_id: id } });
    if (n > 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Meta agregada com componentes: edite os componentes ou use fluxo dedicado (v1 limitado).',
      );
    }
  }

  const dados = fromPayload(payload);
  delete dados.indicador_id;
  delete dados.vigencia_inicio;
  delete dados.vigencia_fim;
  delete dados.prazo_implantacao;

  if (dados.nome !== undefined && (!dados.nome || !String(dados.nome).trim())) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'nome não pode ser vazio');
  }

  await meta.update(dados);
  return buscarPorId(id);
};

const remover = async (id, ossIdFiltro = null) => {
  await assertMetaNoEscopoOSS(id, ossIdFiltro);
  const meta = await db.meta.findOne({ where: { meta_id: id } });
  if (!meta) throw new ApiError(httpStatus.NOT_FOUND, 'Meta não encontrada');
  const kids = await db.meta.findAll({ where: { parent_meta_id: id } });
  for (const k of kids) {
    await k.destroy();
  }
  await meta.destroy();
};

module.exports = { listar, buscarPorId, criar, criarPacote, atualizar, remover };
