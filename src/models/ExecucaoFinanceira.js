const { Model, DataTypes } = require('sequelize');

class ExecucaoFinanceira extends Model {
  static init(sequelize) {
    return super.init(
      {
        exec_id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: sequelize.literal('(UUID())') },
        rubrica_id: { type: DataTypes.CHAR(36), allowNull: false },
        unidade_id: { type: DataTypes.CHAR(36), allowNull: false },
        conta: { type: DataTypes.ENUM('custeio', 'investimento', 'provisao'), allowNull: false, defaultValue: 'custeio' },
        mes_referencia: { type: DataTypes.DATEONLY, allowNull: false },
        valor_orcado: DataTypes.DECIMAL(15, 2),
        valor_realizado: DataTypes.DECIMAL(15, 2),
        variacao: { type: DataTypes.VIRTUAL, get() {
          return (parseFloat(this.getDataValue('valor_realizado') || 0)) - parseFloat(this.getDataValue('valor_orcado'));
        }},
        variacao_perc: { type: DataTypes.VIRTUAL, get() {
          const orcado = parseFloat(this.getDataValue('valor_orcado'));
          if (!orcado) return null;
          return parseFloat(((this.variacao / orcado) * 100).toFixed(4));
        }},
        status_aprovacao: { type: DataTypes.ENUM('rascunho', 'submetido', 'aprovado'), allowNull: false, defaultValue: 'rascunho' },
        fonte: DataTypes.STRING(255),
        preenchido_por: DataTypes.CHAR(36),
        aprovado_por: DataTypes.CHAR(36),
      },
      {
        sequelize,
        modelName: 'execucao_financeira',
        tableName: 'tb_execucao_financeira',
        timestamps: true,
        createdAt: 'criado_em',
        updatedAt: 'atualizado_em',
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.rubrica, { foreignKey: 'rubrica_id', as: 'rubrica' });
    this.belongsTo(models.unidade, { foreignKey: 'unidade_id', as: 'unidade' });
    this.belongsTo(models.usuario, { foreignKey: 'preenchido_por', as: 'preenchedor' });
    this.belongsTo(models.usuario, { foreignKey: 'aprovado_por', as: 'aprovador' });
  }
}

module.exports = ExecucaoFinanceira;
