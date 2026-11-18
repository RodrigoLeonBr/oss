'use strict';

// PA Zanaga, vig. ago/25–jul/26 — cadastro alinhado ao nome dos indicadores:
// - ZAN-QL-10 "Profissional Médico em Exercício (>95%)": cumprido a partir de 95% (meta_parcial = 95).
// - ZAN-QL-14 "Satisfação do Usuário (≥80% Bom/Ótimo)": meta 80 (valor lançado é o próprio % de satisfação).
// Atualiza também o snapshot dos lançamentos (Recebimento lê o snapshot) e o status gravado.

const { avaliar } = require('../../helper/avaliacaoCumprimento');

const AJUSTES = {
  up: { 'ZAN-QL-10': { meta_parcial: 95 }, 'ZAN-QL-14': { meta_valor_qualit: 80 } },
  down: { 'ZAN-QL-10': { meta_parcial: null }, 'ZAN-QL-14': { meta_valor_qualit: 100 } },
};

async function aplicar(queryInterface, lado) {
  const q = (sql, replacements) => queryInterface.sequelize.query(sql, { replacements });
  for (const [codigo, campos] of Object.entries(AJUSTES[lado])) {
    const [col, val] = Object.entries(campos)[0];
    await q(`UPDATE tb_metas m JOIN tb_indicadores i USING (indicador_id) SET m.${col} = ? WHERE i.codigo = ?`, [val, codigo]);
    const snap = col === 'meta_valor_qualit' ? 'meta_vigente_qualit' : col;
    await q(`UPDATE tb_acompanhamento_mensal a JOIN tb_indicadores i USING (indicador_id) SET a.${snap} = ? WHERE i.codigo = ?`, [val, codigo]);

    const [linhas] = await q(
      `SELECT a.acomp_id, a.valor_realizado, a.meta_vigente_qualit, a.meta_minima, a.meta_parcial, a.meta_tipo_snap
         FROM tb_acompanhamento_mensal a JOIN tb_indicadores i USING (indicador_id)
        WHERE i.codigo = ? AND a.valor_realizado IS NOT NULL`,
      [codigo],
    );
    for (const l of linhas) {
      const status = avaliar((Number(l.valor_realizado) / Number(l.meta_vigente_qualit)) * 100, l);
      await q('UPDATE tb_acompanhamento_mensal SET status_cumprimento = ? WHERE acomp_id = ?', [status, l.acomp_id]);
    }
  }
}

module.exports = {
  up: (queryInterface) => aplicar(queryInterface, 'up'),
  down: (queryInterface) => aplicar(queryInterface, 'down'),
};
