const { Model, DataTypes } = require('sequelize');

class RepasseMensal extends Model {
  static init(sequelize) {
    return super.init(
      {
        repasse_id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: sequelize.literal('(UUID())') },
        contrato_id: { type: DataTypes.CHAR(36), allowNull: false },
        historico_contrato_id: { type: DataTypes.CHAR(36), allowNull: false },
        mes_referencia: { type: DataTypes.DATEONLY, allowNull: false },
        valor_mensal_base: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
        parcela_fixa: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
        parcela_variavel: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
        desconto_producao_total: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0.00 },
        desconto_qualidade_total: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0.00 },
        desconto_total: { type: DataTypes.VIRTUAL, get() {
          return parseFloat(this.getDataValue('desconto_producao_total') || 0) + parseFloat(this.getDataValue('desconto_qualidade_total') || 0);
        }},
        repasse_final: { type: DataTypes.VIRTUAL, get() {
          return parseFloat(this.getDataValue('valor_mensal_base') || 0) - this.desconto_total;
        }},
        percentual_retido: { type: DataTypes.VIRTUAL, get() {
          const base = parseFloat(this.getDataValue('valor_mensal_base'));
          return base ? parseFloat(((this.desconto_total / base) * 100).toFixed(2)) : 0;
        }},
        status: { type: DataTypes.ENUM('calculado', 'validado', 'aprovado', 'pago'), allowNull: false, defaultValue: 'calculado' },
        calculado_em: DataTypes.DATE,
        validado_por: DataTypes.CHAR(36),
        data_validacao: DataTypes.DATE,
        aprovado_por: DataTypes.CHAR(36),
        data_aprovacao: DataTypes.DATE,
        data_pagamento: DataTypes.DATE,
        observacoes: DataTypes.TEXT,
      },
      {
        sequelize,
        modelName: 'repasse_mensal',
        tableName: 'tb_repasse_mensal',
        timestamps: true,
        createdAt: 'criado_em',
        updatedAt: 'atualizado_em',
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.contrato, { foreignKey: 'contrato_id', as: 'contrato' });
    this.belongsTo(models.historico_contrato, { foreignKey: 'historico_contrato_id', as: 'versao_contrato' });
    this.hasMany(models.desconto_bloco, { foreignKey: 'repasse_id', as: 'descontos_bloco' });
    this.hasMany(models.desconto_indicador, { foreignKey: 'repasse_id', as: 'descontos_indicador' });
  }
}

module.exports = RepasseMensal;
