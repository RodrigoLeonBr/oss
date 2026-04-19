'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_usuarios', {
      usuario_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal('(UUID())'),
      },
      nome: { type: Sequelize.STRING(200), allowNull: false },
      email: { type: Sequelize.STRING(200), allowNull: false, unique: true },
      cpf: { type: Sequelize.CHAR(14), allowNull: true, unique: true },
      telefone: { type: Sequelize.STRING(20), allowNull: true },
      perfil: {
        type: Sequelize.ENUM(
          'admin', 'gestor_sms', 'auditora', 'conselheiro_cms',
          'contratada_scmc', 'contratada_indsh', 'central_regulacao', 'visualizador'
        ),
        allowNull: false,
      },
      oss_id: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: 'tb_oss', key: 'oss_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      senha_hash: { type: Sequelize.STRING(72), allowNull: false },
      token_2fa: { type: Sequelize.STRING(32), allowNull: true },
      ativo: { type: Sequelize.TINYINT(1), allowNull: false, defaultValue: 1 },
      data_criacao: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      ultimo_acesso: { type: Sequelize.DATE, allowNull: true },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
      atualizado_em: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('tb_usuarios', ['perfil'], { name: 'idx_usuarios_perfil' });
    await queryInterface.addIndex('tb_usuarios', ['oss_id'], { name: 'idx_usuarios_oss' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_usuarios');
  },
};
