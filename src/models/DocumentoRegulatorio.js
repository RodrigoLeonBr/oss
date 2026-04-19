const { Model, DataTypes } = require('sequelize');

class DocumentoRegulatorio extends Model {
  static init(sequelize) {
    return super.init(
      {
        doc_id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: sequelize.literal('(UUID())') },
        unidade_id: { type: DataTypes.CHAR(36), allowNull: false },
        tipo_documento: {
          type: DataTypes.ENUM('CNES', 'Alvara_Sanitario', 'Licenca_Ambiental', 'AVCB', 'Registro_CFM', 'Registro_COREN', 'CRF', 'Habilitacao_UNACON', 'Outro'),
          allowNull: false,
        },
        numero_documento: DataTypes.STRING(100),
        orgao_emissor: DataTypes.STRING(100),
        data_emissao: DataTypes.DATEONLY,
        data_vencimento: DataTypes.DATEONLY,
        ativa: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 1 },
        arquivo_url: DataTypes.STRING(500),
        observacoes: DataTypes.TEXT,
      },
      {
        sequelize,
        modelName: 'documento_regulatorio',
        tableName: 'tb_documentos_regulatorios',
        timestamps: true,
        createdAt: 'criado_em',
        updatedAt: 'atualizado_em',
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.unidade, { foreignKey: 'unidade_id', as: 'unidade' });
  }
}

module.exports = DocumentoRegulatorio;
