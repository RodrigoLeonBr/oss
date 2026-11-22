const { Model, DataTypes } = require('sequelize');

class UnaconUpload extends Model {
  static init(sequelize) {
    return super.init(
      {
        upload_id: {
          type: DataTypes.CHAR(36),
          primaryKey: true,
          defaultValue: sequelize.literal('(UUID())'),
        },
        nome_arquivo: {
          type: DataTypes.STRING(250),
          allowNull: false,
        },
        tipo_fonte: {
          type: DataTypes.ENUM('conecta_consultas', 'conecta_cirurgias', 'planilha_geral'),
          allowNull: false,
        },
        competencia: {
          type: DataTypes.CHAR(7),
          allowNull: true,
        },
        total_linhas: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        linhas_processadas: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        linhas_erros: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        usuario_id: {
          type: DataTypes.CHAR(36),
          allowNull: true,
        },
        criado_em: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
        },
      },
      {
        sequelize,
        modelName: 'unacon_upload',
        tableName: 'tb_unacon_uploads',
        timestamps: false,
      }
    );
  }

  static associate(models) {
    if (models.usuario) this.belongsTo(models.usuario, { foreignKey: 'usuario_id', as: 'usuario' });
  }
}

module.exports = UnaconUpload;
