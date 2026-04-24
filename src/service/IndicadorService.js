const httpStatus = require('http-status');
const { Op } = require('sequelize');
const ApiError = require('../helper/ApiError');
const { assertIndicadorNoEscopoOSS, assertUnidadeNoEscopoOSS } = require('../helper/ossScopeHelper');
const db = require('../models');

// ── Mapeamento tipo BD ↔ API ──────────────────────────────────────────────────
// O modelo BD usa 'quantitativo'/'qualitativo'; a API simplificada expõe 'producao'/'qualidade'
const TIPO_TO_API = { quantitativo: 'producao', qualitativo: 'qualidade' };
const TIPO_TO_DB  = { producao: 'quantitativo', qualidade: 'qualitativo' };

// ── Serialização BD → API ─────────────────────────────────────────────────────
function toRecord(i) {
    const d = i.toJSON ? i.toJSON() : i;
    return {
        id:             d.indicador_id,
        unidadeId:      d.unidade_id,
        nome:           d.nome,
        descricao:      d.descricao ?? null,
        tipo:           TIPO_TO_API[d.tipo] ?? d.tipo,
        metaPadrao:     d.peso_perc != null ? parseFloat(d.peso_perc) : null,
        unidadeMedida:  d.unidade_medida ?? null,
        vigenciaInicio: d.vigencia_inicio ?? null,
        vigenciaFim:    d.vigencia_fim ?? null,
        prazoImplantacao: d.prazo_implantacao ?? null,
        status:         d.ativo ? 'ativo' : 'inativo',
        createdAt:      d.criado_em,
        updatedAt:      d.atualizado_em,
        unidade: d.unidade ? {
            id:    d.unidade.unidade_id,
            nome:  d.unidade.nome,
            sigla: d.unidade.sigla ?? null,
        } : undefined,
    };
}

// ── Conversão payload API → campos BD ────────────────────────────────────────
function fromPayload(p) {
    const m = {};
    if (p.unidadeId    !== undefined) m.unidade_id    = p.unidadeId;
    if (p.nome         !== undefined) m.nome          = p.nome;
    if (p.descricao    !== undefined) m.descricao     = p.descricao || null;
    if (p.tipo         !== undefined) m.tipo          = TIPO_TO_DB[p.tipo] ?? p.tipo;
    if (p.metaPadrao   !== undefined) m.peso_perc     = p.metaPadrao ?? 0;
    if (p.unidadeMedida !== undefined) m.unidade_medida = p.unidadeMedida || null;
    if (p.status       !== undefined) m.ativo         = p.status === 'ativo' ? 1 : 0;
    if (p.vigenciaInicio !== undefined) m.vigencia_inicio = p.vigenciaInicio || null;
    if (p.vigenciaFim !== undefined) m.vigencia_fim = p.vigenciaFim || null;
    if (p.prazoImplantacao !== undefined) m.prazo_implantacao = p.prazoImplantacao || null;
    return m;
}

// ── Gera código único para o campo obrigatório `codigo` ──────────────────────
function gerarCodigo() {
    const ts = Date.now().toString(36).toUpperCase();
    return `IND-${ts.slice(-8)}`;
}

// ── Include padrão ────────────────────────────────────────────────────────────
function buildIncludeUnidade(ossIdFiltro) {
    return [{
        model: db.unidade,
        as: 'unidade',
        attributes: ['unidade_id', 'nome', 'sigla'],
        required: Boolean(ossIdFiltro),
        include: ossIdFiltro ? [{
            model: db.contrato,
            as: 'contrato',
            required: true,
            attributes: [],
            where: { oss_id: ossIdFiltro },
        }] : [],
    }];
}

// ─────────────────────────────────────────────────────────────────────────────

const listar = async (filtros = {}, ossIdFiltro = null) => {
    const where = {};

    // aceita unidadeId (camelCase, frontend) ou unidade_id (snake, legado)
    const uid = filtros.unidadeId ?? filtros.unidade_id;
    if (uid) where.unidade_id = uid;

    if (filtros.tipo) {
        const tipoDb = TIPO_TO_DB[filtros.tipo];
        where.tipo = tipoDb ?? filtros.tipo;
    }

    if (filtros.status !== undefined && filtros.status !== '') {
        where.ativo = filtros.status === 'ativo' ? 1 : 0;
    }

    if (filtros.grupo) where.grupo = filtros.grupo;

    // legado: incluir_inativos booleano
    if (!filtros.incluirInativos && !filtros.incluir_inativos && !filtros.status) {
        // padrão: retorna todos (ativos e inativos) quando sem filtro de status
    }

    const lista = await db.indicador.findAll({
        where,
        include: buildIncludeUnidade(ossIdFiltro),
        order: [['nome', 'ASC']],
    });
    return lista.map(toRecord);
};

const buscarPorId = async (id, ossIdFiltro = null) => {
    await assertIndicadorNoEscopoOSS(id, ossIdFiltro);
    const indicador = await db.indicador.findOne({
        where:   { indicador_id: id },
        include: buildIncludeUnidade(null),
    });
    if (!indicador) throw new ApiError(httpStatus.NOT_FOUND, 'Indicador não encontrado');
    return toRecord(indicador);
};

const criar = async (payload, ossIdFiltro = null) => {
    const dados = fromPayload(payload);

    if (!dados.unidade_id) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'unidadeId é obrigatório');
    }

    await assertUnidadeNoEscopoOSS(dados.unidade_id, ossIdFiltro);

    const unidade = await db.unidade.findOne({ where: { unidade_id: dados.unidade_id } });
    if (!unidade) throw new ApiError(httpStatus.NOT_FOUND, 'Unidade não encontrada');

    // Unicidade de nome por unidade
    const existente = await db.indicador.findOne({
        where: { nome: dados.nome, unidade_id: dados.unidade_id },
        paranoid: false,
    });
    if (existente) {
        throw new ApiError(httpStatus.CONFLICT, `Já existe um indicador com o nome "${dados.nome}" nesta unidade`);
    }

    // Defaults para campos obrigatórios do modelo complexo
    dados.codigo        = gerarCodigo();
    dados.grupo         = dados.grupo        || 'qualidade_atencao';
    dados.meta_tipo     = dados.meta_tipo    || 'maior_igual';
    dados.fonte_dados   = dados.fonte_dados  || 'Manual';
    dados.periodicidade = dados.periodicidade || 'mensal';
    if (dados.ativo      === undefined) dados.ativo      = 1;
    if (dados.peso_perc  === undefined) dados.peso_perc  = 0;

    const indicador = await db.indicador.create(dados);
    return toRecord(await db.indicador.findOne({
        where:   { indicador_id: indicador.indicador_id },
        include: buildIncludeUnidade(null),
    }));
};

const atualizar = async (id, payload, ossIdFiltro = null) => {
    await assertIndicadorNoEscopoOSS(id, ossIdFiltro);
    const indicador = await db.indicador.findOne({ where: { indicador_id: id } });
    if (!indicador) throw new ApiError(httpStatus.NOT_FOUND, 'Indicador não encontrado');

    const dados = fromPayload(payload);
    delete dados.unidade_id; // não permite trocar unidade via PUT

    if (dados.nome) {
        const existente = await db.indicador.findOne({
            where: {
                nome:         dados.nome,
                unidade_id:   indicador.unidade_id,
                indicador_id: { [Op.ne]: id },
            },
            paranoid: false,
        });
        if (existente) {
            throw new ApiError(httpStatus.CONFLICT, `Já existe um indicador com o nome "${dados.nome}" nesta unidade`);
        }
    }

    await indicador.update(dados);
    return toRecord(await db.indicador.findOne({
        where:   { indicador_id: id },
        include: buildIncludeUnidade(null),
    }));
};

const remover = async (id, ossIdFiltro = null) => {
    await assertIndicadorNoEscopoOSS(id, ossIdFiltro);
    const indicador = await db.indicador.findOne({ where: { indicador_id: id } });
    if (!indicador) throw new ApiError(httpStatus.NOT_FOUND, 'Indicador não encontrado');
    await indicador.destroy(); // soft delete (paranoid: true) — histórico preservado
};

// Backward compat — usado pelo ciclo de acompanhamento mensal
const desativar = async (id, ossIdFiltro = null) => {
    await assertIndicadorNoEscopoOSS(id, ossIdFiltro);
    const indicador = await db.indicador.findOne({ where: { indicador_id: id } });
    if (!indicador) throw new ApiError(httpStatus.NOT_FOUND, 'Indicador não encontrado');
    await indicador.update({ ativo: 0 });
    return { message: 'Indicador desativado. Histórico preservado para auditoria.' };
};

module.exports = { listar, buscarPorId, criar, atualizar, remover, desativar };
