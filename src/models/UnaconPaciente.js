const { Model, DataTypes } = require('sequelize');

class UnaconPaciente extends Model {
  static init(sequelize) {
    return super.init(
      {
        paciente_id: {
          type: DataTypes.CHAR(36),
          primaryKey: true,
          defaultValue: sequelize.literal('(UUID())'),
        },
        nome: {
          type: DataTypes.STRING(250),
          allowNull: false,
        },
        nome_normalizado: {
          type: DataTypes.STRING(250),
          allowNull: false,
        },
        cpf: {
          type: DataTypes.CHAR(11),
          allowNull: true,
        },
        cns: {
          type: DataTypes.CHAR(15),
          allowNull: true,
        },
        data_nascimento: {
          type: DataTypes.DATEONLY,
          allowNull: true,
        },
        idade: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        prontuario: {
          type: DataTypes.STRING(50),
          allowNull: true,
        },
        municipio_origem: {
          type: DataTypes.STRING(150),
          allowNull: true,
        },
      },
      {
        sequelize,
        modelName: 'unacon_paciente',
        tableName: 'tb_unacon_pacientes',
        timestamps: true,
        createdAt: 'criado_em',
        updatedAt: 'atualizado_em',
      }
    );
  }

  static associate(models) {
    const Procedimento = models.unacon_procedimento || models.UnaconProcedimento;
    this.hasMany(Procedimento, { foreignKey: 'paciente_id', as: 'procedimentos' });
  }
}

module.exports = UnaconPaciente;
