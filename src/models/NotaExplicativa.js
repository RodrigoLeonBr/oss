const { Model, DataTypes } = require('sequelize');

class NotaExplicativa extends Model {
  static init(sequelize) {
    return super.init(
      {
        nota_id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: sequelize.literal('(UUID())') },
        acomp_id: { type: DataTypes.CHAR(36), allowNull: false },
        descricao: { type: DataTypes.TEXT, allowNull: false },
        causa_raiz: DataTypes.TEXT,
        acao_corretiva: DataTypes.TEXT,
        previsao_normalizacao: DataTypes.DATEONLY,
        criado_por: { type: DataTypes.CHAR(36), allowNull: false },
        validado_por: DataTypes.CHAR(36),
        status_validacao: { type: DataTypes.ENUM('pendente', 'aceita', 'rejeitada'), allowNull: false, defaultValue: 'pendente' },
        motivo_rejeicao_nota: DataTypes.TEXT,
      },
      {
        sequelize,
        modelName: 'nota_explicativa',
        tableName: 'tb_notas_explicativas',
        timestamps: true,
        createdAt: 'criado_em',
        updatedAt: 'atualizado_em',
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.acompanhamento_mensal, { foreignKey: 'acomp_id', as: 'acompanhamento' });
    this.belongsTo(models.usuario, { foreignKey: 'criado_por', as: 'autor' });
    this.belongsTo(models.usuario, { foreignKey: 'validado_por', as: 'validador' });
  }
}

module.exports = NotaExplicativa;
