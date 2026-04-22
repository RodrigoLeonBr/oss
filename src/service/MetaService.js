const httpStatus = require('http-status');
const ApiError = require('../helper/ApiError');
const db = require('../models');

const TIPO_TO_API = { quantitativo: 'producao', qualitativo: 'qualidade' };

// ── Serialização BD → API ─────────────────────────────────────────────────────
function toRecord(m) {
    const d = m.toJSON ? m.toJSON() : m;
    const fim = d.vigencia_fim ?? null;
    return {
        id:               d.meta_id,
        indicadorId:      d.indicador_id,
        versao:           d.versao,
        vigenciaInicio:   d.vigencia_inicio,
        vigenciaFim:      fim,
        metaMensal:       d.meta_mensal       != null ? parseFloat(d.meta_mensal)       : null,
        metaAnual:        d.meta_anual        != null ? parseFloat(d.meta_anual)        : null,
        metaValorQualit:  d.meta_valor_qualit != null ? parseFloat(d.meta_valor_qualit) : null,
        metaMinima:       d.meta_minima       != null ? parseFloat(d.meta_minima)       : null,
        metaParcial:      d.meta_parcial      != null ? parseFloat(d.meta_parcial)      : null,
        metaTipo:         d.meta_tipo         ?? 'maior_igual',
        unidadeMedida:    d.unidade_medida    ?? null,
        observacoes:      d.observacoes       ?? null,
        prazoImplantacao: d.prazo_implantacao ?? null,
        status:           !fim || new Date(fim) >= new Date() ? 'vigente' : 'encerrada',
        createdAt:        d.criado_em,
        updatedAt:        d.atualizado_em,
        indicador: d.indicador ? {
            id:        d.indicador.indicador_id,
            nome:      d.indicador.nome,
            tipo:      TIPO_TO_API[d.indicador.tipo] ?? d.indicador.tipo,
            unidadeId: d.indicador.unidade_id,
            unidade:   d.indicador.unidade
                ? { id: d.indicador.unidade.unidade_id, nome: d.indicador.unidade.nome }
                : undefined,
        } : undefined,
    };
}

// ── Conversão payload API → campos BD ────────────────────────────────────────
function fromPayload(p) {
    const m = {};
    if (p.indicadorId       !== undefined) m.indicador_id       = p.indicadorId;
    if (p.aditivoId         !== undefined) m.aditivo_id         = p.aditivoId        ?? null;
    if (p.vigenciaInicio    !== undefined) m.vigencia_inicio    = p.vigenciaInicio;
    if (p.vigenciaFim       !== undefined) m.vigencia_fim       = p.vigenciaFim       || null;
    if (p.metaMensal        !== undefined) m.meta_mensal        = p.metaMensal        ?? null;
    if (p.metaAnual         !== undefined) m.meta_anual         = p.metaAnual         ?? null;
    if (p.metaValorQualit   !== undefined) m.meta_valor_qualit  = p.metaValorQualit   ?? null;
    if (p.metaMinima        !== undefined) m.meta_minima        = p.metaMinima        ?? null;
    if (p.metaParcial       !== undefined) m.meta_parcial       = p.metaParcial       ?? null;
    if (p.metaTipo          !== undefined) m.meta_tipo          = p.metaTipo;
    if (p.unidadeMedida     !== undefined) m.unidade_medida     = p.unidadeMedida     || null;
    if (p.observacoes       !== undefined) m.observacoes        = p.observacoes       || null;
    if (p.prazoImplantacao  !== undefined) m.prazo_implantacao  = p.prazoImplantacao  || null;
    return m;
}

// ── Include padrão ────────────────────────────────────────────────────────────
const INCLUDE = [
    {
        model: db.indicador,
        as: 'indicador',
        attributes: ['indicador_id', 'nome', 'tipo', 'unidade_id'],
        include: [
            { model: db.unidade, as: 'unidade', attributes: ['unidade_id', 'nome'] },
        ],
    },
];

// ─────────────────────────────────────────────────────────────────────────────

const listar = async (filtros = {}) => {
    const where = {};
    const uid = filtros.indicadorId ?? filtros.indicador_id;
    if (uid) where.indicador_id = uid;

    const lista = await db.meta.findAll({
        where,
        include: INCLUDE,
        order: [['vigencia_inicio', 'DESC']],
    });
    return lista.map(toRecord);
};

const buscarPorId = async (id) => {
    const meta = await db.meta.findOne({ where: { meta_id: id }, include: INCLUDE });
    if (!meta) throw new ApiError(httpStatus.NOT_FOUND, 'Meta não encontrada');
    return toRecord(meta);
};

const criar = async (payload) => {
    const dados = fromPayload(payload);

    if (!dados.indicador_id)
        throw new ApiError(httpStatus.BAD_REQUEST, 'indicadorId é obrigatório');

    const indicador = await db.indicador.findOne({ where: { indicador_id: dados.indicador_id } });
    if (!indicador) throw new ApiError(httpStatus.NOT_FOUND, 'Indicador não encontrado');

    // Auto-calc the complementary meta value
    if (dados.meta_mensal != null && dados.meta_anual == null)
        dados.meta_anual = parseFloat((dados.meta_mensal * 12).toFixed(4));
    if (dados.meta_anual != null && dados.meta_mensal == null)
        dados.meta_mensal = parseFloat((dados.meta_anual / 12).toFixed(4));

    // Next version number for this indicador
    const ultimaVersao = await db.meta.max('versao', { where: { indicador_id: dados.indicador_id } });
    dados.versao = (ultimaVersao || 0) + 1;

    const meta = await db.meta.create(dados);
    return buscarPorId(meta.meta_id);
};

const atualizar = async (id, payload) => {
    const meta = await db.meta.findOne({ where: { meta_id: id } });
    if (!meta) throw new ApiError(httpStatus.NOT_FOUND, 'Meta não encontrada');

    const dados = fromPayload(payload);
    delete dados.indicador_id; // não permite trocar indicador via PUT

    await meta.update(dados);
    return buscarPorId(id);
};

const remover = async (id) => {
    const meta = await db.meta.findOne({ where: { meta_id: id } });
    if (!meta) throw new ApiError(httpStatus.NOT_FOUND, 'Meta não encontrada');
    await meta.destroy();
};

module.exports = { listar, buscarPorId, criar, atualizar, remover };
