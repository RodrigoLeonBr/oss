const { Model, DataTypes } = require('sequelize');

class ConsolidacaoItem extends Model {
  static init(sequelize) {
    return super.init(
      {
        item_id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: sequelize.literal('(UUID())') },
        consolidacao_id: { type: DataTypes.CHAR(36), allowNull: false },
        indicador_id: { type: DataTypes.CHAR(36), allowNull: false },
        soma_realizado: DataTypes.DECIMAL(15, 4),
        media_realizado: DataTypes.DECIMAL(15, 4),
        meta_periodo: DataTypes.DECIMAL(15, 4),
        percentual_cumprimento: DataTypes.DECIMAL(8, 4),
        faixa: { type: DataTypes.ENUM('acima_meta', 'entre_85_100', 'entre_70_84', 'abaixo_70') },
        meses_cumpridos: DataTypes.TINYINT,
        meses_totais: DataTypes.TINYINT,
        desconto_periodo: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0.00 },
      },
      {
        sequelize,
        modelName: 'consolidacao_item',
        tableName: 'tb_consolidacao_itens',
        timestamps: true,
        createdAt: 'criado_em',
        updatedAt: false,
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.consolidacao, { foreignKey: 'consolidacao_id', as: 'consolidacao' });
    this.belongsTo(models.indicador, { foreignKey: 'indicador_id', as: 'indicador' });
  }
}

module.exports = ConsolidacaoItem;
