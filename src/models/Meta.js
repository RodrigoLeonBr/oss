const { Model, DataTypes } = require('sequelize');

class Meta extends Model {
  static init(sequelize) {
    return super.init(
      {
        meta_id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: sequelize.literal('(UUID())') },
        indicador_id: { type: DataTypes.CHAR(36), allowNull: false },
        aditivo_id: DataTypes.CHAR(36),
        versao: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
        vigencia_inicio: { type: DataTypes.DATEONLY, allowNull: true },
        vigencia_fim: DataTypes.DATEONLY,
        meta_mensal: DataTypes.DECIMAL(15, 4),
        meta_anual: DataTypes.DECIMAL(15, 4),
        meta_valor_qualit: DataTypes.DECIMAL(15, 4),
        meta_tipo: {
          type: DataTypes.ENUM('maior_igual', 'menor_igual'),
          allowNull: false,
          defaultValue: 'maior_igual',
        },
        meta_minima: DataTypes.DECIMAL(15, 4),
        meta_parcial: DataTypes.DECIMAL(15, 4),
        unidade_medida: DataTypes.STRING(50),
        nome: { type: DataTypes.STRING(500), allowNull: false },
        observacoes: DataTypes.TEXT,
        prazo_implantacao: DataTypes.DATEONLY,
        aprovado_por: DataTypes.CHAR(36),
        parent_meta_id: DataTypes.CHAR(36),
        papel: {
          type: DataTypes.ENUM('agregada', 'componente', 'avulsa'),
          allowNull: false,
          defaultValue: 'avulsa',
        },
        peso: DataTypes.DECIMAL(10, 4),
      },
      {
        sequelize,
        modelName: 'meta',
        tableName: 'tb_metas',
        timestamps: true,
        createdAt: 'criado_em',
        updatedAt: 'atualizado_em',
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.indicador, { foreignKey: 'indicador_id', as: 'indicador' });
    this.belongsTo(models.aditivo, { foreignKey: 'aditivo_id', as: 'aditivo' });
    this.belongsTo(models.usuario, { foreignKey: 'aprovado_por', as: 'aprovador' });
    this.belongsTo(models.meta, { foreignKey: 'parent_meta_id', as: 'parent' });
    this.hasMany(models.meta, { foreignKey: 'parent_meta_id', as: 'children' });
    this.hasMany(models.acompanhamento_mensal, { foreignKey: 'meta_id', as: 'acompanhamentos' });
  }
}

module.exports = Meta;
