'use strict';

/**
 * Catálogo dos documentos da prestação de contas convertidos para .md (prestacao-vault/vault).
 * Espelho do catálogo SQLite (prestacao-vault/indice/vault.db), sincronizado por
 * `npm run catalogo:atualizar -- --banco`. Substitui manifest.csv e RESUME_2026.md como registro.
 * Base para ligar evidências a indicadores, justificativas, atas e capacitações (fases 3 a 5).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_documento', {
      doc_id: { type: Sequelize.CHAR(36), primaryKey: true, defaultValue: Sequelize.literal('(UUID())') },
      caminho_md: { type: Sequelize.STRING(500), allowNull: false },
      origem_pdf: { type: Sequelize.STRING(500), allowNull: true },
      hash_md: { type: Sequelize.CHAR(40), allowNull: true },
      unidade_id: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: 'tb_unidades', key: 'unidade_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      unidade_vault: { type: Sequelize.STRING(30), allowNull: true },
      ano: { type: Sequelize.SMALLINT, allowNull: true },
      mes: { type: Sequelize.STRING(20), allowNull: true },
      competencia: { type: Sequelize.CHAR(7), allowNull: true },
      tipo: { type: Sequelize.STRING(40), allowNull: true },
      subpath: { type: Sequelize.STRING(300), allowNull: true },
      assunto: { type: Sequelize.STRING(300), allowNull: true },
      paginas: { type: Sequelize.INTEGER, allowNull: true },
      scanned: { type: Sequelize.TINYINT(1), allowNull: false, defaultValue: 0 },
      ocr: { type: Sequelize.STRING(30), allowNull: true },
      status_conversao: { type: Sequelize.ENUM('ok', 'erro', 'pendente'), allowNull: false, defaultValue: 'ok' },
      erro: { type: Sequelize.TEXT, allowNull: true },
      convertido_em: { type: Sequelize.DATE, allowNull: true },
      catalogado_em: { type: Sequelize.DATE, allowNull: true },
      ativo: { type: Sequelize.TINYINT(1), allowNull: false, defaultValue: 1 },
      criado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      atualizado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('tb_documento', ['caminho_md'], { unique: true, name: 'uq_documento_caminho' });
    await queryInterface.addIndex('tb_documento', ['unidade_id', 'competencia', 'tipo'], { name: 'idx_documento_unid_comp_tipo' });
    await queryInterface.addIndex('tb_documento', ['origem_pdf'], { name: 'idx_documento_origem' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_documento');
  },
};
