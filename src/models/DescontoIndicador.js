const { Model, DataTypes } = require('sequelize');

class DescontoIndicador extends Model {
  static init(sequelize) {
    return super.init(
      {
        desc_ind_id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: sequelize.literal('(UUID())') },
        repasse_id: { type: DataTypes.CHAR(36), allowNull: false },
        acomp_id: { type: DataTypes.CHAR(36), allowNull: false },
        indicador_id: { type: DataTypes.CHAR(36), allowNull: false },
        mes_referencia: { type: DataTypes.DATEONLY, allowNull: false },
        modelo_desconto: { type: DataTypes.ENUM('flat', 'ponderado'), allowNull: false },
        peso_indicador: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0.00 },
        percentual_desconto: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
        valor_desconto: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
        auditado: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 0 },
        auditado_por: DataTypes.CHAR(36),
        data_auditoria: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'desconto_indicador',
        tableName: 'tb_descontos_indicador',
        timestamps: true,
        createdAt: 'criado_em',
        updatedAt: false,
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.repasse_mensal, { foreignKey: 'repasse_id', as: 'repasse' });
    this.belongsTo(models.acompanhamento_mensal, { foreignKey: 'acomp_id', as: 'acompanhamento' });
    this.belongsTo(models.indicador, { foreignKey: 'indicador_id', as: 'indicador' });
    this.belongsTo(models.usuario, { foreignKey: 'auditado_por', as: 'auditor' });
  }
}

module.exports = DescontoIndicador;
