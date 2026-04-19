const { Model, DataTypes } = require('sequelize');

class HistoricoBloco extends Model {
  static init(sequelize) {
    return super.init(
      {
        hist_bloco_id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: sequelize.literal('(UUID())') },
        bloco_id: { type: DataTypes.CHAR(36), allowNull: false },
        aditivo_id: DataTypes.CHAR(36),
        versao: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
        vigencia_inicio: { type: DataTypes.DATEONLY, allowNull: false },
        vigencia_fim: DataTypes.DATEONLY,
        valor_mensal_alocado: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
        percentual_peso_bloco: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
        motivo_versao: { type: DataTypes.TEXT, allowNull: false },
      },
      {
        sequelize,
        modelName: 'historico_bloco',
        tableName: 'tb_historico_blocos',
        timestamps: true,
        createdAt: 'criado_em',
        updatedAt: false,
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.bloco_producao, { foreignKey: 'bloco_id', as: 'bloco' });
    this.belongsTo(models.aditivo, { foreignKey: 'aditivo_id', as: 'aditivo' });
  }
}

module.exports = HistoricoBloco;
