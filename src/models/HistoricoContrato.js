const { Model, DataTypes } = require('sequelize');

class HistoricoContrato extends Model {
  static init(sequelize) {
    return super.init(
      {
        historico_id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: sequelize.literal('(UUID())') },
        contrato_id: { type: DataTypes.CHAR(36), allowNull: false },
        aditivo_id: DataTypes.CHAR(36),
        versao: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
        vigencia_inicio: { type: DataTypes.DATEONLY, allowNull: false },
        vigencia_fim: DataTypes.DATEONLY,
        valor_mensal_base: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
        perc_fixo: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
        perc_variavel: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
        modelo_desconto_qual: { type: DataTypes.ENUM('flat', 'ponderado'), allowNull: false },
        motivo_versao: { type: DataTypes.TEXT, allowNull: false },
        aprovado_por: DataTypes.CHAR(36),
      },
      {
        sequelize,
        modelName: 'historico_contrato',
        tableName: 'tb_historico_contrato',
        timestamps: true,
        createdAt: 'criado_em',
        updatedAt: false,
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.contrato, { foreignKey: 'contrato_id', as: 'contrato' });
    this.belongsTo(models.aditivo, { foreignKey: 'aditivo_id', as: 'aditivo' });
    this.hasMany(models.repasse_mensal, { foreignKey: 'historico_contrato_id', as: 'repasses' });
  }
}

module.exports = HistoricoContrato;
