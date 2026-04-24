'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tb_metas', 'parent_meta_id', {
      type: Sequelize.CHAR(36),
      allowNull: true,
      references: { model: 'tb_metas', key: 'meta_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
    await queryInterface.addColumn('tb_metas', 'papel', {
      type: Sequelize.ENUM('agregada', 'componente', 'avulsa'),
      allowNull: false,
      defaultValue: 'avulsa',
    });
    await queryInterface.addColumn('tb_metas', 'peso', {
      type: Sequelize.DECIMAL(10, 4),
      allowNull: true,
    });
    await queryInterface.addIndex('tb_metas', ['parent_meta_id'], { name: 'idx_meta_parent' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('tb_metas', 'idx_meta_parent');
    await queryInterface.removeColumn('tb_metas', 'peso');
    await queryInterface.removeColumn('tb_metas', 'papel');
    await queryInterface.removeColumn('tb_metas', 'parent_meta_id');
  },
};
