const { Model, DataTypes } = require('sequelize');

class Contrato extends Model {
  static init(sequelize) {
    return super.init(
      {
        contrato_id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: sequelize.literal('(UUID())') },
        oss_id: { type: DataTypes.CHAR(36), allowNull: false },
        numero: { type: DataTypes.STRING(50), allowNull: false },
        tipo: { type: DataTypes.ENUM('contrato_gestao', 'chamamento_publico', 'convenio', 'outro'), allowNull: false },
        data_inicio: { type: DataTypes.DATEONLY, allowNull: false },
        data_fim: { type: DataTypes.DATEONLY, allowNull: false },
        valor_mensal_base: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
        valor_anual: { type: DataTypes.VIRTUAL, get() { return parseFloat(this.getDataValue('valor_mensal_base')) * 12; } },
        perc_fixo: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 90.00 },
        perc_variavel: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 10.00 },
        modelo_desconto_qual: { type: DataTypes.ENUM('flat', 'ponderado'), allowNull: false },
        numero_aditivos: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        status: { type: DataTypes.ENUM('Ativo', 'Encerrado', 'Suspenso', 'Rompido'), allowNull: false, defaultValue: 'Ativo' },
        observacoes: DataTypes.TEXT,
      },
      {
        sequelize,
        modelName: 'contrato',
        tableName: 'tb_contratos',
        timestamps: true,
        createdAt: 'criado_em',
        updatedAt: 'atualizado_em',
        paranoid: true,
        deletedAt: 'deleted_at',
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.oss, { foreignKey: 'oss_id', as: 'organizacao' });
    this.hasMany(models.aditivo, { foreignKey: 'contrato_id', as: 'aditivos' });
    this.hasMany(models.historico_contrato, { foreignKey: 'contrato_id', as: 'historico' });
    this.hasMany(models.unidade, { foreignKey: 'contrato_id', as: 'unidades' });
    this.hasMany(models.repasse_mensal, { foreignKey: 'contrato_id', as: 'repasses' });
    this.hasMany(models.rubrica, { foreignKey: 'contrato_id', as: 'rubricas' });
  }
}

module.exports = Contrato;
