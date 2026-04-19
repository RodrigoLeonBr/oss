const { Model, DataTypes } = require('sequelize');

class Consolidacao extends Model {
  static init(sequelize) {
    return super.init(
      {
        consolidacao_id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: sequelize.literal('(UUID())') },
        unidade_id: { type: DataTypes.CHAR(36), allowNull: false },
        tipo_periodo: { type: DataTypes.ENUM('trimestral', 'quadrimestral'), allowNull: false },
        periodo_numero: { type: DataTypes.TINYINT, allowNull: false },
        ano: { type: DataTypes.SMALLINT, allowNull: false },
        data_inicio: { type: DataTypes.DATEONLY, allowNull: false },
        data_fim: { type: DataTypes.DATEONLY, allowNull: false },
        status: { type: DataTypes.ENUM('gerado', 'validado', 'arquivado'), allowNull: false, defaultValue: 'gerado' },
        gerado_por: DataTypes.CHAR(36),
      },
      {
        sequelize,
        modelName: 'consolidacao',
        tableName: 'tb_consolidacoes',
        timestamps: true,
        createdAt: 'gerado_em',
        updatedAt: false,
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.unidade, { foreignKey: 'unidade_id', as: 'unidade' });
    this.hasMany(models.consolidacao_item, { foreignKey: 'consolidacao_id', as: 'itens' });
  }
}

module.exports = Consolidacao;
