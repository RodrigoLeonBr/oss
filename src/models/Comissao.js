const { Model, DataTypes } = require('sequelize');

class Comissao extends Model {
  static init(sequelize) {
    return super.init(
      {
        comissao_id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: sequelize.literal('(UUID())') },
        unidade_id: { type: DataTypes.CHAR(36), allowNull: false },
        tipo: {
          type: DataTypes.ENUM('CCIH', 'SAU', 'CIPA', 'NSP', 'Prontuarios', 'Obitos', 'Etica_Medica', 'Etica_Enfermagem', 'Humanizacao', 'GTH', 'Farmacoterapeutica', 'Gerenciamento_Residuos', 'Outro'),
          allowNull: false,
        },
        data_constituicao: DataTypes.DATEONLY,
        funcionando: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 0 },
        ultima_reuniao: DataTypes.DATEONLY,
        integrantes: DataTypes.JSON,
        observacoes: DataTypes.TEXT,
      },
      {
        sequelize,
        modelName: 'comissao',
        tableName: 'tb_comissoes',
        timestamps: true,
        createdAt: 'criado_em',
        updatedAt: 'atualizado_em',
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.unidade, { foreignKey: 'unidade_id', as: 'unidade' });
  }
}

module.exports = Comissao;
