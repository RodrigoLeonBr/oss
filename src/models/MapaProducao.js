const { Model, DataTypes } = require('sequelize');

class MapaProducao extends Model {
  static init(sequelize) {
    return super.init(
      {
        mapa_id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: sequelize.literal('(UUID())') },
        indicador_id: { type: DataTypes.CHAR(36), allowNull: false },
        fonte: { type: DataTypes.ENUM('sia', 'sih'), allowNull: false, defaultValue: 'sia' },
        tipo_filtro: { type: DataTypes.ENUM('grupo', 'subgrupo', 'forma', 'procedimento'), allowNull: false },
        valor_filtro: { type: DataTypes.STRING(10), allowNull: false },
        ativo: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 1 },
      },
      {
        sequelize,
        modelName: 'mapa_producao',
        tableName: 'tb_mapa_producao',
        timestamps: true,
        createdAt: 'criado_em',
        updatedAt: 'atualizado_em',
      },
    );
  }

  static associate(models) {
    this.belongsTo(models.indicador, { foreignKey: 'indicador_id', as: 'indicador' });
  }
}

module.exports = MapaProducao;
