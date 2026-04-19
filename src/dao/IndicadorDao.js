const SuperDao = require('./SuperDao');
const db = require('../models');

class IndicadorDao extends SuperDao {
    constructor() {
        super(db.indicador);
    }

    async findAtivos(where = {}) {
        return db.indicador.findAll({
            where: { ...where, ativo: true },
            include: [
                { model: db.unidade, as: 'unidade', attributes: ['unidade_id', 'nome', 'sigla'] },
                { model: db.bloco_producao, as: 'bloco', attributes: ['bloco_id', 'nome', 'codigo'] },
            ],
            order: [['codigo', 'ASC']],
        });
    }

    async findTodos(where = {}) {
        return db.indicador.findAll({
            where,
            include: [
                { model: db.unidade, as: 'unidade', attributes: ['unidade_id', 'nome', 'sigla'] },
                { model: db.bloco_producao, as: 'bloco', attributes: ['bloco_id', 'nome', 'codigo'] },
            ],
            order: [['codigo', 'ASC']],
            paranoid: false,
        });
    }

    async findPorId(indicadorId) {
        return db.indicador.findOne({
            where: { indicador_id: indicadorId },
            include: [
                { model: db.unidade, as: 'unidade' },
                { model: db.bloco_producao, as: 'bloco' },
                { model: db.meta, as: 'metas' },
            ],
            paranoid: false,
        });
    }

    async softDelete(indicadorId) {
        return db.indicador.destroy({ where: { indicador_id: indicadorId } });
    }
}

module.exports = IndicadorDao;
