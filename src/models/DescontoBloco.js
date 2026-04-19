const { Model, DataTypes } = require('sequelize');

class DescontoBloco extends Model {
  static init(sequelize) {
    return super.init(
      {
        desc_bloco_id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: sequelize.literal('(UUID())') },
        repasse_id: { type: DataTypes.CHAR(36), allowNull: false },
        bloco_id: { type: DataTypes.CHAR(36), allowNull: false },
        mes_referencia: { type: DataTypes.DATEONLY, allowNull: false },
        meta_mensal: { type: DataTypes.DECIMAL(15, 4), allowNull: false },
        valor_realizado: { type: DataTypes.DECIMAL(15, 4), allowNull: false },
        percentual_atingimento: { type: DataTypes.DECIMAL(8, 4), allowNull: false },
        faixa: { type: DataTypes.ENUM('acima_meta', 'entre_85_100', 'entre_70_84', 'abaixo_70'), allowNull: false },
        orcamento_bloco: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
        percentual_desconto: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
        valor_desconto: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
        auditado: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 0 },
        auditado_por: DataTypes.CHAR(36),
        data_auditoria: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'desconto_bloco',
        tableName: 'tb_descontos_bloco',
        timestamps: true,
        createdAt: 'criado_em',
        updatedAt: false,
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.repasse_mensal, { foreignKey: 'repasse_id', as: 'repasse' });
    this.belongsTo(models.bloco_producao, { foreignKey: 'bloco_id', as: 'bloco' });
    this.belongsTo(models.usuario, { foreignKey: 'auditado_por', as: 'auditor' });
  }
}

module.exports = DescontoBloco;
