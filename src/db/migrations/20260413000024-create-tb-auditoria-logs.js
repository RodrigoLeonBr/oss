'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_auditoria_logs', {
      log_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal('(UUID())'),
      },
      usuario_id: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: 'tb_usuarios', key: 'usuario_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      tabela_afetada: { type: Sequelize.STRING(100), allowNull: false },
      registro_id: { type: Sequelize.CHAR(36), allowNull: true },
      operacao: {
        type: Sequelize.ENUM(
          'INSERT', 'UPDATE', 'DELETE', 'SELECT',
          'LOGIN', 'LOGOUT', 'EXPORT', 'APPROVE', 'REJECT'
        ),
        allowNull: false,
      },
      dados_antes: { type: Sequelize.JSON, allowNull: true },
      dados_depois: { type: Sequelize.JSON, allowNull: true },
      ip_origem: { type: Sequelize.STRING(45), allowNull: true },
      user_agent: { type: Sequelize.TEXT, allowNull: true },
      data_operacao: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      descricao_mudanca: { type: Sequelize.TEXT, allowNull: true },
    });

    await queryInterface.addIndex('tb_auditoria_logs', ['usuario_id'], { name: 'idx_audit_usuario' });
    await queryInterface.addIndex('tb_auditoria_logs', ['tabela_afetada'], { name: 'idx_audit_tabela' });
    await queryInterface.addIndex('tb_auditoria_logs', ['data_operacao'], { name: 'idx_audit_data' });
    await queryInterface.addIndex('tb_auditoria_logs', ['operacao'], { name: 'idx_audit_operacao' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_auditoria_logs');
  },
};
