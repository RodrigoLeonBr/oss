'use strict';

/** Vigência e prazo de implantação passam a pertencer ao indicador; tb_metas deixa de armazenar. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tb_indicadores', 'vigencia_inicio', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn('tb_indicadores', 'vigencia_fim', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn('tb_indicadores', 'prazo_implantacao', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    // Copia a vigência da meta mais recente (por início) para o indicador
    await queryInterface.sequelize.query(`
      UPDATE tb_indicadores i
      INNER JOIN (
        SELECT m.indicador_id, m.vigencia_inicio, m.vigencia_fim, m.prazo_implantacao
        FROM tb_metas m
        INNER JOIN (
          SELECT indicador_id, MAX(vigencia_inicio) AS mx
          FROM tb_metas
          WHERE vigencia_inicio IS NOT NULL
          GROUP BY indicador_id
        ) t ON m.indicador_id = t.indicador_id AND m.vigencia_inicio = t.mx
      ) x ON i.indicador_id = x.indicador_id
      SET
        i.vigencia_inicio = x.vigencia_inicio,
        i.vigencia_fim = x.vigencia_fim,
        i.prazo_implantacao = x.prazo_implantacao
    `);

    await queryInterface.sequelize.query(`
      UPDATE tb_metas
      SET vigencia_inicio = NULL, vigencia_fim = NULL, prazo_implantacao = NULL
    `);

    await queryInterface.changeColumn('tb_metas', 'vigencia_inicio', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      CREATE OR REPLACE VIEW VW_META_VIGENTE AS
      SELECT
        m.indicador_id, m.meta_id, i.vigencia_inicio, i.vigencia_fim,
        m.meta_mensal, m.meta_anual, m.meta_valor_qualit, m.meta_minima,
        m.meta_parcial, m.unidade_medida, m.observacoes, m.versao
      FROM tb_metas m
      INNER JOIN tb_indicadores i ON i.indicador_id = m.indicador_id
      WHERE i.indicador_id IS NOT NULL
        AND (i.vigencia_fim IS NULL OR i.vigencia_fim >= CURDATE())
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE tb_metas m
      INNER JOIN tb_indicadores i ON i.indicador_id = m.indicador_id
      SET
        m.vigencia_inicio = COALESCE(m.vigencia_inicio, i.vigencia_inicio, '2020-01-01'),
        m.vigencia_fim = COALESCE(m.vigencia_fim, i.vigencia_fim),
        m.prazo_implantacao = COALESCE(m.prazo_implantacao, i.prazo_implantacao)
    `);

    await queryInterface.changeColumn('tb_metas', 'vigencia_inicio', {
      type: Sequelize.DATEONLY,
      allowNull: false,
    });

    await queryInterface.sequelize.query(`
      CREATE OR REPLACE VIEW VW_META_VIGENTE AS
      SELECT
        m.indicador_id, m.meta_id, m.vigencia_inicio, m.vigencia_fim,
        m.meta_mensal, m.meta_anual, m.meta_valor_qualit, m.meta_minima,
        m.meta_parcial, m.unidade_medida, m.observacoes, m.versao
      FROM tb_metas m
      WHERE m.vigencia_fim IS NULL OR m.vigencia_fim >= CURDATE()
    `);

    await queryInterface.removeColumn('tb_indicadores', 'vigencia_inicio');
    await queryInterface.removeColumn('tb_indicadores', 'vigencia_fim');
    await queryInterface.removeColumn('tb_indicadores', 'prazo_implantacao');
  },
};
