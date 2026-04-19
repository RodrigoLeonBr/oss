'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_indicadores', {
      indicador_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal('(UUID())'),
      },
      unidade_id: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: 'tb_unidades', key: 'unidade_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      bloco_id: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: 'tb_blocos_producao', key: 'bloco_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      codigo: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      nome: { type: Sequelize.STRING(300), allowNull: false },
      descricao: { type: Sequelize.TEXT, allowNull: true },
      tipo: {
        type: Sequelize.ENUM('quantitativo', 'qualitativo'),
        allowNull: false,
      },
      grupo: {
        type: Sequelize.ENUM('auditoria_operacional', 'qualidade_atencao', 'transversal', 'rh'),
        allowNull: false,
      },
      formula_calculo: { type: Sequelize.TEXT, allowNull: true },
      unidade_medida: { type: Sequelize.STRING(50), allowNull: true },
      periodicidade: {
        type: Sequelize.ENUM('mensal', 'bimestral', 'trimestral', 'quadrimestral', 'unico'),
        allowNull: false,
        defaultValue: 'mensal',
      },
      tipo_implantacao: { type: Sequelize.TINYINT(1), allowNull: false, defaultValue: 0 },
      prazo_dias_impl: { type: Sequelize.INTEGER, allowNull: true },
      fonte_dados: {
        type: Sequelize.ENUM('SIASUS', 'SIH', 'CNES', 'Prontuario', 'Manual', 'Misto'),
        allowNull: false,
        defaultValue: 'Manual',
      },
      peso_perc: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 0.00 },
      meta_tipo: {
        type: Sequelize.ENUM('igualdade', 'maior_igual', 'menor_igual', 'entre', 'percentual_max'),
        allowNull: false,
        defaultValue: 'maior_igual',
      },
      versao: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      ativo: { type: Sequelize.TINYINT(1), allowNull: false, defaultValue: 1 },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
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

    await queryInterface.addIndex('tb_indicadores', ['unidade_id'], { name: 'idx_ind_unidade' });
    await queryInterface.addIndex('tb_indicadores', ['tipo'], { name: 'idx_ind_tipo' });
    await queryInterface.addIndex('tb_indicadores', ['grupo'], { name: 'idx_ind_grupo' });
    await queryInterface.addIndex('tb_indicadores', ['ativo'], { name: 'idx_ind_ativo' });
    await queryInterface.addIndex('tb_indicadores', ['periodicidade'], { name: 'idx_ind_periodicidade' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_indicadores');
  },
};
