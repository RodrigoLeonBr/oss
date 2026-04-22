'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Snapshot fields — só add se não existirem (idempotente)
    const tableDesc = await queryInterface.describeTable('tb_acompanhamento_mensal');

    if (!tableDesc.meta_minima) {
      await queryInterface.addColumn('tb_acompanhamento_mensal', 'meta_minima', {
        type: Sequelize.DECIMAL(15, 4),
        allowNull: true,
        after: 'meta_vigente_qualit',
      });
    }

    if (!tableDesc.meta_parcial) {
      await queryInterface.addColumn('tb_acompanhamento_mensal', 'meta_parcial', {
        type: Sequelize.DECIMAL(15, 4),
        allowNull: true,
        after: 'meta_minima',
      });
    }

    if (!tableDesc.meta_tipo_snap) {
      await queryInterface.addColumn('tb_acompanhamento_mensal', 'meta_tipo_snap', {
        type: Sequelize.ENUM('maior_igual', 'menor_igual'),
        allowNull: false,
        defaultValue: 'maior_igual',
        after: 'meta_parcial',
      });
    }

    // Expande ENUM status_cumprimento para incluir novos valores
    await queryInterface.changeColumn('tb_acompanhamento_mensal', 'status_cumprimento', {
      type: Sequelize.ENUM(
        'cumprido', 'parcial', 'nao_cumprido', 'nao_aplicavel', 'aguardando',
        'atingido', 'nao_atingido', 'pendente',
      ),
      allowNull: false,
      defaultValue: 'aguardando',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('tb_acompanhamento_mensal', 'meta_tipo_snap');
    await queryInterface.removeColumn('tb_acompanhamento_mensal', 'meta_parcial');
    await queryInterface.removeColumn('tb_acompanhamento_mensal', 'meta_minima');
    await queryInterface.changeColumn('tb_acompanhamento_mensal', 'status_cumprimento', {
      type: Sequelize.ENUM('cumprido', 'parcial', 'nao_cumprido', 'nao_aplicavel', 'aguardando'),
      allowNull: false,
      defaultValue: 'aguardando',
    });
  },
};
