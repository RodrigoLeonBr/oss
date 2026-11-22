const { Model, DataTypes } = require('sequelize');

class UnaconProcedimento extends Model {
  static init(sequelize) {
    return super.init(
      {
        procedimento_id: {
          type: DataTypes.CHAR(36),
          primaryKey: true,
          defaultValue: sequelize.literal('(UUID())'),
        },
        paciente_id: {
          type: DataTypes.CHAR(36),
          allowNull: false,
        },
        competencia: {
          type: DataTypes.CHAR(7),
          allowNull: false,
        },
        tipo: {
          type: DataTypes.ENUM('quimioterapia', 'cirurgia', 'consulta', 'exame_sadt', 'outro'),
          allowNull: false,
        },
        subtipo: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        codigo_sigtap: {
          type: DataTypes.STRING(20),
          allowNull: true,
        },
        descricao_procedimento: {
          type: DataTypes.STRING(300),
          allowNull: true,
        },
        data_solicitacao: {
          type: DataTypes.DATEONLY,
          allowNull: true,
        },
        data_execucao: {
          type: DataTypes.DATEONLY,
          allowNull: true,
        },
        dias_ate_inicio: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        status_lei_60_dias: {
          type: DataTypes.ENUM('dentro_prazo', 'fora_prazo', 'nao_aplicavel'),
          allowNull: false,
          defaultValue: 'nao_aplicavel',
        },
        profissional_nome: {
          type: DataTypes.STRING(200),
          allowNull: true,
        },
        especialidade: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        comparecimento: {
          type: DataTypes.ENUM('atendido', 'ausente', 'cancelado', 'desconhecido'),
          allowNull: false,
          defaultValue: 'atendido',
        },
        tipo_agendamento: {
          type: DataTypes.STRING(50),
          allowNull: true,
        },
        complexidade: {
          type: DataTypes.ENUM('baixa', 'media', 'alta', 'nao_informada'),
          allowNull: false,
          defaultValue: 'nao_informada',
        },
        fonte_origem: {
          type: DataTypes.ENUM('vault_ra', 'conecta', 'manual'),
          allowNull: false,
          defaultValue: 'vault_ra',
        },
        arquivo_origem: {
          type: DataTypes.STRING(300),
          allowNull: true,
        },
      },
      {
        sequelize,
        modelName: 'unacon_procedimento',
        tableName: 'tb_unacon_procedimentos',
        timestamps: true,
        createdAt: 'criado_em',
        updatedAt: 'atualizado_em',
      }
    );
  }

  static associate(models) {
    const Paciente = models.unacon_paciente || models.UnaconPaciente;
    const Conciliacao = models.unacon_conciliacao || models.UnaconConciliacao;
    this.belongsTo(Paciente, { foreignKey: 'paciente_id', as: 'paciente' });
    this.hasMany(Conciliacao, { foreignKey: 'procedimento_id', as: 'conciliacoes' });
  }
}

module.exports = UnaconProcedimento;
