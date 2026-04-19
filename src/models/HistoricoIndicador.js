const { Model, DataTypes } = require('sequelize');

class HistoricoIndicador extends Model {
  static init(sequelize) {
    return super.init(
      {
        hist_ind_id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: sequelize.literal('(UUID())') },
        indicador_id: { type: DataTypes.CHAR(36), allowNull: false },
        aditivo_id: DataTypes.CHAR(36),
        versao: { type: DataTypes.INTEGER, allowNull: false },
        vigencia_inicio: { type: DataTypes.DATEONLY, allowNull: false },
        vigencia_fim: DataTypes.DATEONLY,
        nome: { type: DataTypes.STRING(300), allowNull: false },
        formula_calculo: DataTypes.TEXT,
        periodicidade: { type: DataTypes.STRING(30), allowNull: false },
        peso_perc: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
        meta_tipo: { type: DataTypes.STRING(30), allowNull: false },
        fonte_dados: { type: DataTypes.STRING(30), allowNull: false },
        motivo_versao: { type: DataTypes.TEXT, allowNull: false },
        alterado_por: DataTypes.CHAR(36),
      },
      {
        sequelize,
        modelName: 'historico_indicador',
        tableName: 'tb_historico_indicadores',
        timestamps: true,
        createdAt: 'criado_em',
        updatedAt: false,
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.indicador, { foreignKey: 'indicador_id', as: 'indicador' });
    this.belongsTo(models.aditivo, { foreignKey: 'aditivo_id', as: 'aditivo' });
    this.belongsTo(models.usuario, { foreignKey: 'alterado_por', as: 'alterador' });
  }
}

module.exports = HistoricoIndicador;
