'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_comissoes', {
      comissao_id: {
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
      tipo: {
        type: Sequelize.ENUM(
          'CCIH', 'SAU', 'CIPA', 'NSP', 'Prontuarios', 'Obitos',
          'Etica_Medica', 'Etica_Enfermagem', 'Humanizacao', 'GTH',
          'Farmacoterapeutica', 'Gerenciamento_Residuos', 'Outro'
        ),
        allowNull: false,
      },
      data_constituicao: { type: Sequelize.DATEONLY, allowNull: true },
      funcionando: { type: Sequelize.TINYINT(1), allowNull: false, defaultValue: 0 },
      ultima_reuniao: { type: Sequelize.DATEONLY, allowNull: true },
      integrantes: { type: Sequelize.JSON, allowNull: true },
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

    await queryInterface.addConstraint('tb_comissoes', {
      fields: ['unidade_id', 'tipo'],
      type: 'unique',
      name: 'uk_comissao_tipo_unidade',
    });
    await queryInterface.addIndex('tb_comissoes', ['unidade_id'], { name: 'idx_comissoes_unidade' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_comissoes');
  },
};
