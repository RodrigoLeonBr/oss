const { Model, DataTypes } = require('sequelize');

class Indicador extends Model {
  static init(sequelize) {
    return super.init(
      {
        indicador_id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: sequelize.literal('(UUID())') },
        unidade_id: DataTypes.CHAR(36),
        bloco_id: DataTypes.CHAR(36),
        codigo: { type: DataTypes.STRING(50), allowNull: false, unique: true },
        nome: { type: DataTypes.STRING(300), allowNull: false },
        descricao: DataTypes.TEXT,
        tipo: { type: DataTypes.ENUM('quantitativo', 'qualitativo'), allowNull: false },
        grupo: { type: DataTypes.ENUM('auditoria_operacional', 'qualidade_atencao', 'transversal', 'rh'), allowNull: false },
        formula_calculo: DataTypes.TEXT,
        unidade_medida: DataTypes.STRING(50),
        periodicidade: { type: DataTypes.ENUM('mensal', 'bimestral', 'trimestral', 'quadrimestral', 'unico'), allowNull: false, defaultValue: 'mensal' },
        tipo_implantacao: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 0 },
        prazo_dias_impl: DataTypes.INTEGER,
        fonte_dados: { type: DataTypes.ENUM('SIASUS', 'SIH', 'CNES', 'Prontuario', 'Manual', 'Misto'), allowNull: false, defaultValue: 'Manual' },
        peso_perc: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0.00 },
        meta_tipo: { type: DataTypes.ENUM('igualdade', 'maior_igual', 'menor_igual', 'entre', 'percentual_max'), allowNull: false, defaultValue: 'maior_igual' },
        vigencia_inicio: DataTypes.DATEONLY,
        vigencia_fim: DataTypes.DATEONLY,
        prazo_implantacao: DataTypes.DATEONLY,
        versao: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
        ativo: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 1 },
      },
      {
        sequelize,
        modelName: 'indicador',
        tableName: 'tb_indicadores',
        timestamps: true,
        createdAt: 'criado_em',
        updatedAt: 'atualizado_em',
        paranoid: true,
        deletedAt: 'deleted_at',
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.unidade, { foreignKey: 'unidade_id', as: 'unidade' });
    this.belongsTo(models.bloco_producao, { foreignKey: 'bloco_id', as: 'bloco' });
    this.hasMany(models.meta, { foreignKey: 'indicador_id', as: 'metas' });
    this.hasMany(models.acompanhamento_mensal, { foreignKey: 'indicador_id', as: 'acompanhamentos' });
    this.hasMany(models.historico_indicador, { foreignKey: 'indicador_id', as: 'historico' });
  }
}

module.exports = Indicador;
