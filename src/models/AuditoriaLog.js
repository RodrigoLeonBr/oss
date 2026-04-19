const { Model, DataTypes } = require('sequelize');

class AuditoriaLog extends Model {
  static init(sequelize) {
    return super.init(
      {
        log_id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: sequelize.literal('(UUID())') },
        usuario_id: DataTypes.CHAR(36),
        tabela_afetada: { type: DataTypes.STRING(100), allowNull: false },
        registro_id: DataTypes.CHAR(36),
        operacao: {
          type: DataTypes.ENUM('INSERT', 'UPDATE', 'DELETE', 'SELECT', 'LOGIN', 'LOGOUT', 'EXPORT', 'APPROVE', 'REJECT'),
          allowNull: false,
        },
        dados_antes: DataTypes.JSON,
        dados_depois: DataTypes.JSON,
        ip_origem: DataTypes.STRING(45),
        user_agent: DataTypes.TEXT,
        descricao_mudanca: DataTypes.TEXT,
      },
      {
        sequelize,
        modelName: 'auditoria_log',
        tableName: 'tb_auditoria_logs',
        timestamps: true,
        createdAt: 'data_operacao',
        updatedAt: false,
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.usuario, { foreignKey: 'usuario_id', as: 'usuario' });
  }
}

module.exports = AuditoriaLog;
