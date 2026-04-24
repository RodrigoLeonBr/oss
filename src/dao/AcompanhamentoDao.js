const { Op } = require('sequelize');
const SuperDao = require('./SuperDao');
const db = require('../models');

class AcompanhamentoDao extends SuperDao {
    constructor() {
        super(db.acompanhamento_mensal);
    }

    async findByMesEIndicador(mesReferencia, indicadorId, metaId = null) {
        const where = { mes_referencia: mesReferencia, indicador_id: indicadorId };
        if (metaId) {
            where.meta_id = metaId;
        }
        return db.acompanhamento_mensal.findOne({ where });
    }

    async findByMes(mesReferencia, where = {}) {
        return db.acompanhamento_mensal.findAll({
            where: { mes_referencia: mesReferencia, ...where },
            include: [
                {
                    model: db.indicador,
                    as: 'indicador',
                    include: [
                        { model: db.unidade, as: 'unidade', attributes: ['unidade_id', 'nome', 'sigla'] },
                        { model: db.bloco_producao, as: 'bloco', attributes: ['bloco_id', 'nome', 'valor_mensal_alocado'] },
                    ],
                },
            ],
            order: [['mes_referencia', 'DESC']],
        });
    }

    async findComIndicador(where = {}) {
        return db.acompanhamento_mensal.findAll({
            where,
            include: [
                {
                    model: db.indicador,
                    as: 'indicador',
                    attributes: ['indicador_id', 'codigo', 'nome', 'tipo', 'grupo', 'peso_perc'],
                    include: [
                        { model: db.unidade, as: 'unidade', attributes: ['unidade_id', 'nome', 'sigla'] },
                    ],
                },
            ],
            order: [['mes_referencia', 'DESC']],
        });
    }

    async findAcompanhamentoAnterior(indicadorId, mesReferencia) {
        const data = new Date(mesReferencia);
        data.setMonth(data.getMonth() - 1);
        const mesAnterior = data.toISOString().slice(0, 10);

        return db.acompanhamento_mensal.findOne({
            where: { indicador_id: indicadorId, mes_referencia: mesAnterior, status_aprovacao: 'aprovado' },
        });
    }
}

module.exports = AcompanhamentoDao;
