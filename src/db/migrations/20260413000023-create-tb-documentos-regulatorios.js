'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_documentos_regulatorios', {
      doc_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal('(UUID())'),
      },
      unidade_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'tb_unidades', key: 'unidade_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      tipo_documento: {
        type: Sequelize.ENUM(
          'CNES', 'Alvara_Sanitario', 'Licenca_Ambiental', 'AVCB',
          'Registro_CFM', 'Registro_COREN', 'CRF', 'Habilitacao_UNACON', 'Outro'
        ),
        allowNull: false,
      },
      numero_documento: { type: Sequelize.STRING(100), allowNull: true },
      orgao_emissor: { type: Sequelize.STRING(100), allowNull: true },
      data_emissao: { type: Sequelize.DATEONLY, allowNull: true },
      data_vencimento: { type: Sequelize.DATEONLY, allowNull: true },
      ativa: { type: Sequelize.TINYINT(1), allowNull: false, defaultValue: 1 },
      arquivo_url: { type: Sequelize.STRING(500), allowNull: true },
      observacoes: { type: Sequelize.TEXT, allowNull: true },
      criado_em: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      atualizado_em: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('tb_documentos_regulatorios', ['unidade_id'], { name: 'idx_docs_unidade' });
    await queryInterface.addIndex('tb_documentos_regulatorios', ['data_vencimento'], { name: 'idx_docs_vencimento' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_documentos_regulatorios');
  },
};
