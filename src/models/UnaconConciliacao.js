const { Model, DataTypes } = require('sequelize');

class UnaconConciliacao extends Model {
  static init(sequelize) {
    return super.init(
      {
        conciliacao_id: {
          type: DataTypes.CHAR(36),
          primaryKey: true,
          defaultValue: sequelize.literal('(UUID())'),
        },
        competencia: {
          type: DataTypes.CHAR(7),
          allowNull: false,
        },
        procedimento_id: {
          type: DataTypes.CHAR(36),
          allowNull: true,
        },
        tabela_sus: {
          type: DataTypes.ENUM('s_apa', 's_aih_pa', 's_prd'),
          allowNull: true,
        },
        id_origem_sus: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        status_conciliacao: {
          type: DataTypes.ENUM('conciliado', 'apenas_oss', 'apenas_sus', 'divergencia'),
          allowNull: false,
        },
        paciente_nome_oss: {
          type: DataTypes.STRING(250),
          allowNull: true,
        },
        paciente_nome_sus: {
          type: DataTypes.STRING(250),
          allowNull: true,
        },
        sigtap_oss: {
          type: DataTypes.STRING(20),
          allowNull: true,
        },
        sigtap_sus: {
          type: DataTypes.STRING(20),
          allowNull: true,
        },
        data_oss: {
          type: DataTypes.DATEONLY,
          allowNull: true,
        },
        data_sus: {
          type: DataTypes.DATEONLY,
          allowNull: true,
        },
        municipio_oss: {
          type: DataTypes.STRING(150),
          allowNull: true,
        },
        municipio_sus: {
          type: DataTypes.STRING(150),
          allowNull: true,
        },
        divergencia_tipo: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        divergencia_detalhe: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        conferido_em: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
        },
      },
      {
        sequelize,
        modelName: 'unacon_conciliacao',
        tableName: 'tb_unacon_conciliacao',
        timestamps: false,
      }
    );
  }

  static associate(models) {
    const Procedimento = models.unacon_procedimento || models.UnaconProcedimento;
    this.belongsTo(Procedimento, { foreignKey: 'procedimento_id', as: 'procedimento' });
  }
}

module.exports = UnaconConciliacao;
