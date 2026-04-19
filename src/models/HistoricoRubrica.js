const { Model, DataTypes } = require('sequelize');

class HistoricoRubrica extends Model {
  static init(sequelize) {
    return super.init(
      {
        hist_rub_id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: sequelize.literal('(UUID())') },
        rubrica_id: { type: DataTypes.CHAR(36), allowNull: false },
        aditivo_id: DataTypes.CHAR(36),
        versao: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
        vigencia_inicio: { type: DataTypes.DATEONLY, allowNull: false },
        vigencia_fim: DataTypes.DATEONLY,
        valor_orcado_mensal: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
        motivo_versao: { type: DataTypes.TEXT, allowNull: false },
      },
      {
        sequelize,
        modelName: 'historico_rubrica',
        tableName: 'tb_historico_rubricas',
        timestamps: true,
        createdAt: 'criado_em',
        updatedAt: false,
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.rubrica, { foreignKey: 'rubrica_id', as: 'rubrica' });
    this.belongsTo(models.aditivo, { foreignKey: 'aditivo_id', as: 'aditivo' });
  }
}

module.exports = HistoricoRubrica;
