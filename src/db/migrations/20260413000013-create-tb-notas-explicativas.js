'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_notas_explicativas', {
      nota_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal('(UUID())'),
      },
      acomp_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'tb_acompanhamento_mensal', key: 'acomp_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      descricao: { type: Sequelize.TEXT, allowNull: false },
      causa_raiz: { type: Sequelize.TEXT, allowNull: true },
      acao_corretiva: { type: Sequelize.TEXT, allowNull: true },
      previsao_normalizacao: { type: Sequelize.DATEONLY, allowNull: true },
      criado_por: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'tb_usuarios', key: 'usuario_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      validado_por: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: 'tb_usuarios', key: 'usuario_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      status_validacao: {
        type: Sequelize.ENUM('pendente', 'aceita', 'rejeitada'),
        allowNull: false,
        defaultValue: 'pendente',
      },
      motivo_rejeicao_nota: { type: Sequelize.TEXT, allowNull: true },
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

    await queryInterface.addIndex('tb_notas_explicativas', ['acomp_id'], { name: 'idx_notas_acomp' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_notas_explicativas');
  },
};
