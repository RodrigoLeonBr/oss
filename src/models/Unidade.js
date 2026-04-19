const { Model, DataTypes } = require('sequelize');

class Unidade extends Model {
  static init(sequelize) {
    return super.init(
      {
        unidade_id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: sequelize.literal('(UUID())') },
        contrato_id: { type: DataTypes.CHAR(36), allowNull: false },
        nome: { type: DataTypes.STRING(200), allowNull: false },
        sigla: { type: DataTypes.STRING(20), allowNull: false },
        tipo: { type: DataTypes.ENUM('hospital', 'upa', 'unacon', 'pa', 'ambulatorio', 'outro'), allowNull: false },
        cnes: DataTypes.STRING(20),
        endereco: DataTypes.TEXT,
        porte: DataTypes.STRING(100),
        capacidade_leitos: DataTypes.INTEGER,
        especialidades: DataTypes.JSON,
        responsavel_tecnico: DataTypes.STRING(200),
        valor_mensal_unidade: DataTypes.DECIMAL(15, 2),
        percentual_peso: DataTypes.DECIMAL(5, 2),
        ativa: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 1 },
      },
      {
        sequelize,
        modelName: 'unidade',
        tableName: 'tb_unidades',
        timestamps: true,
        createdAt: 'criado_em',
        updatedAt: 'atualizado_em',
        paranoid: true,
        deletedAt: 'deleted_at',
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.contrato, { foreignKey: 'contrato_id', as: 'contrato' });
    this.hasMany(models.bloco_producao, { foreignKey: 'unidade_id', as: 'blocos' });
    this.hasMany(models.indicador, { foreignKey: 'unidade_id', as: 'indicadores' });
    this.hasMany(models.comissao, { foreignKey: 'unidade_id', as: 'comissoes' });
    this.hasMany(models.documento_regulatorio, { foreignKey: 'unidade_id', as: 'documentos' });
    this.hasMany(models.consolidacao, { foreignKey: 'unidade_id', as: 'consolidacoes' });
  }
}

module.exports = Unidade;
