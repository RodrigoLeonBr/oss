const { Model, DataTypes } = require('sequelize');

class BlocoProducao extends Model {
  static init(sequelize) {
    return super.init(
      {
        bloco_id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: sequelize.literal('(UUID())') },
        unidade_id: { type: DataTypes.CHAR(36), allowNull: false },
        codigo: { type: DataTypes.STRING(30), allowNull: false },
        nome: { type: DataTypes.STRING(150), allowNull: false },
        descricao: DataTypes.TEXT,
        valor_mensal_alocado: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        percentual_peso_bloco: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
        ativo: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 1 },
      },
      {
        sequelize,
        modelName: 'bloco_producao',
        tableName: 'tb_blocos_producao',
        timestamps: true,
        createdAt: 'criado_em',
        updatedAt: 'atualizado_em',
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.unidade, { foreignKey: 'unidade_id', as: 'unidade' });
    this.hasMany(models.indicador, { foreignKey: 'bloco_id', as: 'indicadores' });
    this.hasMany(models.historico_bloco, { foreignKey: 'bloco_id', as: 'historico' });
    this.hasMany(models.desconto_bloco, { foreignKey: 'bloco_id', as: 'descontos' });
  }
}

module.exports = BlocoProducao;
