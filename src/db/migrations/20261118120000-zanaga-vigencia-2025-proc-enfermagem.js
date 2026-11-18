'use strict';

// PA Zanaga (517/2025, INDSH): contrato assinado em ago/2025 (medições desde set/2025), não ago/2024.
// - Procedimentos de Enfermagem sai no 1º Aditamento (ago/2026): vigência termina em 31/07/2026.
// - Atendimentos Médicos passa a valer desde ago/2025.
// - Indicadores ZAN24-QL-* (premissa antiga de vigência ago/24–jul/25, sem lançamentos): soft-delete.
// Idempotente. Nenhum lançamento é apagado.

module.exports = {
  async up(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q("UPDATE tb_indicadores SET vigencia_fim = '2026-07-31' WHERE codigo = 'ZAN-QT-PA-03'");
    await q("UPDATE tb_indicadores SET vigencia_inicio = '2025-08-01' WHERE codigo = 'ZAN-QT-PA-01'");
    await q(`UPDATE tb_indicadores i SET i.ativo = 0, i.deleted_at = COALESCE(i.deleted_at, NOW())
             WHERE i.codigo LIKE 'ZAN24-QL-%'
               AND NOT EXISTS (SELECT 1 FROM tb_acompanhamento_mensal a WHERE a.indicador_id = i.indicador_id)`);
  },

  async down(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q("UPDATE tb_indicadores SET vigencia_fim = NULL WHERE codigo = 'ZAN-QT-PA-03'");
    await q("UPDATE tb_indicadores SET vigencia_inicio = '2024-08-01' WHERE codigo = 'ZAN-QT-PA-01'");
    await q("UPDATE tb_indicadores SET ativo = 1, deleted_at = NULL WHERE codigo LIKE 'ZAN24-QL-%'");
  },
};
