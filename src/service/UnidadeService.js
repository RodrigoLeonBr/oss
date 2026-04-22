const httpStatus = require('http-status');
const ApiError = require('../helper/ApiError');
const db = require('../models');

function toRecord(u) {
    const d = u.toJSON ? u.toJSON() : u;
    const c = d.contrato;
    return {
        id: d.unidade_id,
        contratoId: d.contrato_id,
        nome: d.nome,
        sigla: d.sigla,
        tipo: d.tipo,
        cnes: d.cnes ?? null,
        endereco: d.endereco ?? null,
        porte: d.porte ?? null,
        capacidade: d.capacidade_leitos ?? 0,
        capacidadeLeitos: d.capacidade_leitos ?? null,
        especialidades: d.especialidades ?? null,
        responsavelTecnico: d.responsavel_tecnico ?? null,
        valorMensalUnidade: d.valor_mensal_unidade ? parseFloat(d.valor_mensal_unidade) : null,
        percentualPeso: d.percentual_peso ? parseFloat(d.percentual_peso) : null,
        ativa: Boolean(d.ativa),
        status: d.ativa ? 'ativa' : 'inativa',
        contrato: c ? {
            id: c.contrato_id,
            numeroContrato: c.numero,
            oss: c.organizacao ? { id: c.organizacao.oss_id, nome: c.organizacao.nome } : undefined,
        } : undefined,
        createdAt: d.criado_em,
        updatedAt: d.atualizado_em,
    };
}

function fromPayload(p) {
    const m = {};
    if (p.contratoId !== undefined)          m.contrato_id = p.contratoId;
    if (p.nome !== undefined)                m.nome = p.nome;
    if (p.sigla !== undefined)               m.sigla = p.sigla;
    if (p.tipo !== undefined)                m.tipo = p.tipo;
    if (p.cnes !== undefined)                m.cnes = p.cnes || null;
    if (p.endereco !== undefined)            m.endereco = p.endereco || null;
    if (p.porte !== undefined)               m.porte = p.porte || null;
    if (p.capacidade !== undefined)          m.capacidade_leitos = p.capacidade ?? null;
    if (p.capacidadeLeitos !== undefined)    m.capacidade_leitos = p.capacidadeLeitos ?? null;
    if (p.especialidades !== undefined)      m.especialidades = p.especialidades ?? null;
    if (p.responsavelTecnico !== undefined)  m.responsavel_tecnico = p.responsavelTecnico || null;
    if (p.valorMensalUnidade !== undefined)  m.valor_mensal_unidade = p.valorMensalUnidade ?? null;
    if (p.percentualPeso !== undefined)      m.percentual_peso = p.percentualPeso ?? null;
    if (p.ativa !== undefined)               m.ativa = p.ativa ? 1 : 0;
    if (p.status !== undefined)              m.ativa = p.status === 'ativa' ? 1 : 0;
    return m;
}

const listar = async (filtros = {}) => {
    const where = {};
    if (filtros.contratoId) where.contrato_id = filtros.contratoId;
    if (filtros.ativa !== undefined) where.ativa = filtros.ativa ? 1 : 0;

    const lista = await db.unidade.findAll({
        where,
        include: [{
            model: db.contrato,
            as: 'contrato',
            attributes: ['contrato_id', 'numero'],
            include: [{ model: db.oss, as: 'organizacao', attributes: ['oss_id', 'nome'] }],
        }],
        order: [['nome', 'ASC']],
    });
    return lista.map(toRecord);
};

const buscarPorId = async (id) => {
    const unidade = await db.unidade.findOne({
        where: { unidade_id: id },
        include: [
            {
                model: db.contrato,
                as: 'contrato',
                attributes: ['contrato_id', 'numero'],
                include: [{ model: db.oss, as: 'organizacao', attributes: ['oss_id', 'nome'] }],
            },
            { model: db.bloco_producao, as: 'blocos' },
        ],
    });
    if (!unidade) throw new ApiError(httpStatus.NOT_FOUND, 'Unidade não encontrada');
    return toRecord(unidade);
};

const criar = async (payload) => {
    const dados = fromPayload(payload);
    if (!dados.contrato_id) throw new ApiError(httpStatus.BAD_REQUEST, 'contratoId é obrigatório');

    const contrato = await db.contrato.findOne({ where: { contrato_id: dados.contrato_id } });
    if (!contrato) throw new ApiError(httpStatus.NOT_FOUND, 'Contrato não encontrado');

    const unidade = await db.unidade.create(dados);
    return toRecord(await db.unidade.findOne({
        where: { unidade_id: unidade.unidade_id },
        include: [{
            model: db.contrato,
            as: 'contrato',
            attributes: ['contrato_id', 'numero'],
            include: [{ model: db.oss, as: 'organizacao', attributes: ['oss_id', 'nome'] }],
        }],
    }));
};

const atualizar = async (id, payload) => {
    const unidade = await db.unidade.findOne({ where: { unidade_id: id } });
    if (!unidade) throw new ApiError(httpStatus.NOT_FOUND, 'Unidade não encontrada');

    const dados = fromPayload(payload);
    delete dados.contrato_id; // não permite trocar contrato via PUT

    await unidade.update(dados);
    return toRecord(await db.unidade.findOne({
        where: { unidade_id: id },
        include: [{
            model: db.contrato,
            as: 'contrato',
            attributes: ['contrato_id', 'numero'],
            include: [{ model: db.oss, as: 'organizacao', attributes: ['oss_id', 'nome'] }],
        }],
    }));
};

const remover = async (id) => {
    const unidade = await db.unidade.findOne({ where: { unidade_id: id } });
    if (!unidade) throw new ApiError(httpStatus.NOT_FOUND, 'Unidade não encontrada');
    await unidade.destroy();
};

module.exports = { listar, buscarPorId, criar, atualizar, remover };
