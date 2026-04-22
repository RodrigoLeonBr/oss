const httpStatus = require('http-status');
const ApiError = require('../helper/ApiError');
const db = require('../models');

function toRecord(oss) {
    const d = oss.toJSON ? oss.toJSON() : oss;
    return {
        id: d.oss_id,
        nome: d.nome,
        cnpj: d.cnpj,
        endereco: d.endereco_social ?? null,
        telefone: d.telefone ?? null,
        email: d.email ?? null,
        status: d.ativa ? 'ativa' : 'inativa',
        createdAt: d.criado_em,
        updatedAt: d.atualizado_em,
    };
}

function fromPayload(p) {
    const m = {};
    if (p.nome !== undefined)     m.nome = p.nome;
    if (p.cnpj !== undefined)     m.cnpj = p.cnpj.replace(/\D/g, '');
    if (p.email !== undefined)    m.email = p.email || null;
    if (p.telefone !== undefined) m.telefone = p.telefone || null;
    if (p.endereco !== undefined) m.endereco_social = p.endereco || null;
    if (p.tipo_org !== undefined) m.tipo_org = p.tipo_org;
    if (p.status !== undefined)   m.ativa = p.status === 'ativa' ? 1 : 0;
    return m;
}

const listar = async () => {
    const lista = await db.oss.findAll({ order: [['nome', 'ASC']] });
    return lista.map(toRecord);
};

const buscarPorId = async (id) => {
    const oss = await db.oss.findOne({
        where: { oss_id: id },
        include: [{ model: db.contrato, as: 'contratos', attributes: ['contrato_id', 'numero', 'status'] }],
    });
    if (!oss) throw new ApiError(httpStatus.NOT_FOUND, 'Organização não encontrada');
    return toRecord(oss);
};

const criar = async (payload) => {
    const dados = fromPayload(payload);
    if (!dados.cnpj) throw new ApiError(httpStatus.BAD_REQUEST, 'CNPJ é obrigatório');

    const existente = await db.oss.findOne({ where: { cnpj: dados.cnpj } });
    if (existente) throw new ApiError(httpStatus.CONFLICT, 'Já existe uma OSS cadastrada com este CNPJ');

    const oss = await db.oss.create(dados);
    return toRecord(oss);
};

const atualizar = async (id, payload) => {
    const oss = await db.oss.findOne({ where: { oss_id: id } });
    if (!oss) throw new ApiError(httpStatus.NOT_FOUND, 'Organização não encontrada');

    const dados = fromPayload(payload);

    if (dados.cnpj && dados.cnpj !== oss.cnpj) {
        const existente = await db.oss.findOne({ where: { cnpj: dados.cnpj } });
        if (existente) throw new ApiError(httpStatus.CONFLICT, 'Já existe uma OSS cadastrada com este CNPJ');
    }

    await oss.update(dados);
    return toRecord(await oss.reload());
};

const remover = async (id) => {
    const oss = await db.oss.findOne({ where: { oss_id: id } });
    if (!oss) throw new ApiError(httpStatus.NOT_FOUND, 'Organização não encontrada');

    const totalContratos = await db.contrato.count({ where: { oss_id: id } });
    if (totalContratos > 0) {
        throw new ApiError(
            httpStatus.CONFLICT,
            `Não é possível excluir: OSS possui ${totalContratos} contrato(s) vinculado(s)`,
        );
    }

    await oss.destroy();
};

module.exports = { listar, buscarPorId, criar, atualizar, remover };
