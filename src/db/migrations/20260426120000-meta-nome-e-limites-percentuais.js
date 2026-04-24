'use strict';

/**
 * - nome: identificação obrigatória da linha (ex-observações principais)
 * - meta_minima / meta_parcial: passam a ser % (0-100) sobre o valor de referência da meta
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const qi = queryInterface;
    const t = await queryInterface.sequelize.transaction();
    try {
      await qi.addColumn(
        'tb_metas',
        'nome',
        { type: Sequelize.STRING(500), allowNull: true },
        { transaction: t },
      );
      await qi.sequelize.query(
        `UPDATE tb_metas SET nome = COALESCE(
          NULLIF(TRIM(observacoes), ''),
          CONCAT('Meta ', LEFT(meta_id, 8))
        )`,
        { transaction: t },
      );
      await qi.changeColumn(
        'tb_metas',
        'nome',
        { type: Sequelize.STRING(500), allowNull: false },
        { transaction: t },
      );

      // converter absolutos legados em % (só quando há base > 0)
      await qi.sequelize.query(
        `UPDATE tb_metas
         SET
           meta_minima = CASE
             WHEN meta_mensal IS NOT NULL AND meta_mensal > 0 AND meta_minima IS NOT NULL
               THEN LEAST(100, GREATEST(0, 100 * meta_minima / meta_mensal))
             WHEN meta_mensal IS NULL AND meta_valor_qualit IS NOT NULL AND meta_valor_qualit > 0 AND meta_minima IS NOT NULL
               THEN LEAST(100, GREATEST(0, 100 * meta_minima / meta_valor_qualit))
             ELSE NULL
           END,
           meta_parcial = CASE
             WHEN meta_mensal IS NOT NULL AND meta_mensal > 0 AND meta_parcial IS NOT NULL
               THEN LEAST(100, GREATEST(0, 100 * meta_parcial / meta_mensal))
             WHEN meta_mensal IS NULL AND meta_valor_qualit IS NOT NULL AND meta_valor_qualit > 0 AND meta_parcial IS NOT NULL
               THEN LEAST(100, GREATEST(0, 100 * meta_parcial / meta_valor_qualit))
             ELSE NULL
           END
         WHERE meta_minima IS NOT NULL OR meta_parcial IS NOT NULL`,
        { transaction: t },
      );

      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }

    await qi.sequelize.query(`
      CREATE OR REPLACE VIEW VW_META_VIGENTE AS
      SELECT
        m.indicador_id, m.meta_id, i.vigencia_inicio, i.vigencia_fim,
        m.meta_mensal, m.meta_anual, m.meta_valor_qualit, m.meta_minima,
        m.meta_parcial, m.unidade_medida, m.nome, m.observacoes, m.versao
      FROM tb_metas m
      INNER JOIN tb_indicadores i ON i.indicador_id = m.indicador_id
      WHERE (i.vigencia_fim IS NULL OR i.vigencia_fim >= CURDATE())
    `);
  },

  async down(queryInterface, Sequelize) {
    // Reconverte % → absoluto quando possível (best-effort)
    await queryInterface.sequelize.query(`
      UPDATE tb_metas m
      SET
        meta_minima = CASE
          WHEN m.meta_mensal IS NOT NULL AND m.meta_mensal > 0 AND m.meta_minima IS NOT NULL
            THEN m.meta_mensal * m.meta_minima / 100
          WHEN m.meta_valor_qualit IS NOT NULL AND m.meta_valor_qualit > 0 AND m.meta_minima IS NOT NULL
            THEN m.meta_valor_qualit * m.meta_minima / 100
          ELSE m.meta_minima
        END,
        meta_parcial = CASE
          WHEN m.meta_mensal IS NOT NULL AND m.meta_mensal > 0 AND m.meta_parcial IS NOT NULL
            THEN m.meta_mensal * m.meta_parcial / 100
          WHEN m.meta_valor_qualit IS NOT NULL AND m.meta_valor_qualit > 0 AND m.meta_parcial IS NOT NULL
            THEN m.meta_valor_qualit * m.meta_parcial / 100
          ELSE m.meta_parcial
        END
    `);
    await queryInterface.removeColumn('tb_metas', 'nome');
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE VIEW VW_META_VIGENTE AS
      SELECT
        m.indicador_id, m.meta_id, i.vigencia_inicio, i.vigencia_fim,
        m.meta_mensal, m.meta_anual, m.meta_valor_qualit, m.meta_minima,
        m.meta_parcial, m.unidade_medida, m.observacoes, m.versao
      FROM tb_metas m
      INNER JOIN tb_indicadores i ON i.indicador_id = m.indicador_id
      WHERE (i.vigencia_fim IS NULL OR i.vigencia_fim >= CURDATE())
    `);
  },
};
