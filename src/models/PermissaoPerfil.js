const { Model, DataTypes } = require('sequelize');

class PermissaoPerfil extends Model {
  static init(sequelize) {
    return super.init(
      {
        perm_id: {
          type: DataTypes.CHAR(36),
          primaryKey: true,
          defaultValue: sequelize.literal('(UUID())'),
        },
        perfil: {
          type: DataTypes.ENUM(
            'admin', 'gestor_sms', 'auditora', 'conselheiro_cms',
            'contratada_scmc', 'contratada_indsh', 'central_regulacao', 'visualizador'
          ),
          allowNull: false,
        },
        modulo:     { type: DataTypes.STRING(50), allowNull: false },
        can_view:   { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 0 },
        can_insert: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 0 },
        can_update: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 0 },
        can_delete: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 0 },
        escopo: {
          type: DataTypes.ENUM('global', 'proprio'),
          allowNull: false,
          defaultValue: 'global',
        },
      },
      {
        sequelize,
        modelName: 'permissaoPerfil',
        tableName: 'tb_permissoes_perfil',
        timestamps: false,
      }
    );
  }
}

module.exports = PermissaoPerfil;
