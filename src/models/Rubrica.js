const { Model, DataTypes } = require('sequelize');

class Rubrica extends Model {
  static init(sequelize) {
    return super.init(
      {
        rubrica_id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: sequelize.literal('(UUID())') },
        contrato_id: { type: DataTypes.CHAR(36), allowNull: false },
        rubrica_pai_id: DataTypes.CHAR(36),
        codigo: { type: DataTypes.STRING(20), allowNull: false },
        nome: { type: DataTypes.STRING(200), allowNull: false },
        nivel: { type: DataTypes.ENUM('grupo', 'categoria'), allowNull: false },
        ativo: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 1 },
      },
      {
        sequelize,
        modelName: 'rubrica',
        tableName: 'tb_rubricas',
        timestamps: true,
        createdAt: 'criado_em',
        updatedAt: false,
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.contrato, { foreignKey: 'contrato_id', as: 'contrato' });
    this.belongsTo(models.rubrica, { foreignKey: 'rubrica_pai_id', as: 'pai' });
    this.hasMany(models.rubrica, { foreignKey: 'rubrica_pai_id', as: 'filhas' });
    this.hasMany(models.execucao_financeira, { foreignKey: 'rubrica_id', as: 'execucoes' });
    this.hasMany(models.historico_rubrica, { foreignKey: 'rubrica_id', as: 'historico' });
  }
}

module.exports = Rubrica;
