const { Model, DataTypes } = require('sequelize');

class Oss extends Model {
  static init(sequelize) {
    return super.init(
      {
        oss_id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: sequelize.literal('(UUID())') },
        nome: { type: DataTypes.STRING(200), allowNull: false },
        cnpj: { type: DataTypes.CHAR(18), allowNull: false, unique: true },
        tipo_org: { type: DataTypes.ENUM('Fundacao', 'Associacao', 'Cooperativa', 'Instituto', 'Outro'), allowNull: false, defaultValue: 'Instituto' },
        email: DataTypes.STRING(200),
        telefone: DataTypes.STRING(20),
        endereco_social: DataTypes.TEXT,
        endereco_adm: DataTypes.TEXT,
        site: DataTypes.STRING(200),
        ativa: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 1 },
      },
      {
        sequelize,
        modelName: 'oss',
        tableName: 'tb_oss',
        timestamps: true,
        createdAt: 'criado_em',
        updatedAt: 'atualizado_em',
        paranoid: true,
        deletedAt: 'deleted_at',
      }
    );
  }

  static associate(models) {
    this.hasMany(models.contrato, { foreignKey: 'oss_id', as: 'contratos' });
    this.hasMany(models.usuario, { foreignKey: 'oss_id', as: 'usuarios' });
  }
}

module.exports = Oss;
