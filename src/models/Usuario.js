const { Model, DataTypes } = require('sequelize');

class Usuario extends Model {
  static init(sequelize) {
    return super.init(
      {
        usuario_id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: sequelize.literal('(UUID())') },
        nome: { type: DataTypes.STRING(200), allowNull: false },
        email: { type: DataTypes.STRING(200), allowNull: false, unique: true },
        cpf: { type: DataTypes.CHAR(14), unique: true },
        telefone: DataTypes.STRING(20),
        perfil: {
          type: DataTypes.ENUM('admin', 'gestor_sms', 'auditora', 'conselheiro_cms', 'contratada_scmc', 'contratada_indsh', 'central_regulacao', 'visualizador'),
          allowNull: false,
        },
        oss_id: DataTypes.CHAR(36),
        senha_hash: { type: DataTypes.STRING(72), allowNull: false },
        token_2fa: DataTypes.STRING(32),
        ativo: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 1 },
        ultimo_acesso: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'usuario',
        tableName: 'tb_usuarios',
        timestamps: true,
        createdAt: 'data_criacao',
        updatedAt: 'atualizado_em',
        paranoid: true,
        deletedAt: 'deleted_at',
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.oss, { foreignKey: 'oss_id', as: 'organizacao' });
  }
}

module.exports = Usuario;
