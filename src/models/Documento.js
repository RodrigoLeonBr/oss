const { Model, DataTypes } = require('sequelize');

class Documento extends Model {
  static init(sequelize) {
    return super.init(
      {
        doc_id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: sequelize.literal('(UUID())') },
        caminho_md: { type: DataTypes.STRING(500), allowNull: false },
        origem_pdf: DataTypes.STRING(500),
        hash_md: DataTypes.CHAR(40),
        unidade_id: DataTypes.CHAR(36),
        unidade_vault: DataTypes.STRING(30),
        ano: DataTypes.SMALLINT,
        mes: DataTypes.STRING(20),
        competencia: DataTypes.CHAR(7),
        tipo: DataTypes.STRING(40),
        subpath: DataTypes.STRING(300),
        assunto: DataTypes.STRING(300),
        paginas: DataTypes.INTEGER,
        scanned: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 0 },
        ocr: DataTypes.STRING(30),
        status_conversao: { type: DataTypes.ENUM('ok', 'erro', 'pendente'), allowNull: false, defaultValue: 'ok' },
        erro: DataTypes.TEXT,
        convertido_em: DataTypes.DATE,
        catalogado_em: DataTypes.DATE,
        ativo: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 1 },
      },
      {
        sequelize,
        modelName: 'documento',
        tableName: 'tb_documento',
        timestamps: true,
        createdAt: 'criado_em',
        updatedAt: 'atualizado_em',
      },
    );
  }

  static associate(models) {
    this.belongsTo(models.unidade, { foreignKey: 'unidade_id', as: 'unidade' });
  }
}

module.exports = Documento;
