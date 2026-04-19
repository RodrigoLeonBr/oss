const { Model, DataTypes } = require('sequelize');

class Aditivo extends Model {
  static init(sequelize) {
    return super.init(
      {
        aditivo_id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: sequelize.literal('(UUID())') },
        contrato_id: { type: DataTypes.CHAR(36), allowNull: false },
        numero_aditivo: { type: DataTypes.INTEGER, allowNull: false },
        data_assinatura: { type: DataTypes.DATEONLY, allowNull: false },
        data_vigencia_inicio: { type: DataTypes.DATEONLY, allowNull: false },
        tipo_aditivo: {
          type: DataTypes.ENUM('prorrogacao', 'reajuste_financeiro', 'alteracao_metas', 'alteracao_indicadores', 'alteracao_blocos', 'alteracao_regras', 'misto'),
          allowNull: false,
        },
        descricao_sumaria: { type: DataTypes.STRING(500), allowNull: false },
        conteudo_completo: DataTypes.TEXT('long'),
        documento_url: DataTypes.STRING(500),
        valor_anterior: DataTypes.DECIMAL(15, 2),
        novo_valor_mensal: DataTypes.DECIMAL(15, 2),
        nova_data_fim: DataTypes.DATEONLY,
        ipca_aplicado: DataTypes.DECIMAL(6, 4),
        aplicado: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 0 },
        aplicado_em: DataTypes.DATE,
        aprovado_por: DataTypes.CHAR(36),
      },
      {
        sequelize,
        modelName: 'aditivo',
        tableName: 'tb_aditivos',
        timestamps: true,
        createdAt: 'criado_em',
        updatedAt: false,
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.contrato, { foreignKey: 'contrato_id', as: 'contrato' });
    this.belongsTo(models.usuario, { foreignKey: 'aprovado_por', as: 'aprovador' });
  }
}

module.exports = Aditivo;
