'use strict';

// Hospital Municipal (HMA) — faixas de cumprimento e % de repasse (informativo, parte variável):
// - Quantitativos (blocos/indicadores): cumprido ≥ 85% (meta_parcial = 85), parcial 70–84,99% (meta_minima = 70),
//   não cumprido < 70%. Repasse informativo: 100% / 90% / 70% (regra_recebimento.unidades[HMA].repasse_info).
// - HMA-QL-24..29 são "quanto menor melhor": meta_tipo = menor_igual (padrão: cumprido ≤ 100%, parcial ≤ 115%).
// Atualiza também o snapshot dos lançamentos (Recebimento lê o snapshot) e o status gravado.

const { avaliar } = require('../../helper/avaliacaoCumprimento');

const HMA = 'uuuu0001-0001-0001-0001-000000000001';
const MENOR = ['HMA-QL-24', 'HMA-QL-25', 'HMA-QL-26', 'HMA-QL-27', 'HMA-QL-28', 'HMA-QL-29'];
const REPASSE = { cumprido: 100, parcial: 90, nao_cumprido: 70 };

async function reavaliar(q, filtroSql, repl, baseCol) {
  const [linhas] = await q(
    `SELECT a.acomp_id, a.valor_realizado, a.${baseCol} base, a.meta_minima, a.meta_parcial, a.meta_tipo_snap
       FROM tb_acompanhamento_mensal a JOIN tb_indicadores i USING (indicador_id)
      WHERE ${filtroSql} AND a.valor_realizado IS NOT NULL AND a.${baseCol} > 0`,
    repl,
  );
  for (const l of linhas) {
    const status = avaliar((Number(l.valor_realizado) / Number(l.base)) * 100, l);
    await q('UPDATE tb_acompanhamento_mensal SET status_cumprimento = ? WHERE acomp_id = ?', [status, l.acomp_id]);
  }
}

async function aplicar(queryInterface, up) {
  const q = (sql, replacements) => queryInterface.sequelize.query(sql, { replacements });

  // 1) quantitativos do HMA: faixas 85/70
  const [minimo, parcial] = up ? [70, 85] : [null, null];
  const quant = 'i.unidade_id = ? AND i.tipo = \'quantitativo\'';
  await q(`UPDATE tb_metas m JOIN tb_indicadores i USING (indicador_id) SET m.meta_minima = ?, m.meta_parcial = ? WHERE ${quant}`, [minimo, parcial, HMA]);
  await q(`UPDATE tb_acompanhamento_mensal a JOIN tb_indicadores i USING (indicador_id) SET a.meta_minima = ?, a.meta_parcial = ? WHERE ${quant}`, [minimo, parcial, HMA]);
  await reavaliar(q, quant, [HMA], 'meta_vigente_mensal');

  // 2) menor é melhor
  const tipo = up ? 'menor_igual' : 'maior_igual';
  await q('UPDATE tb_metas m JOIN tb_indicadores i USING (indicador_id) SET m.meta_tipo = ? WHERE i.codigo IN (?)', [tipo, MENOR]);
  await q('UPDATE tb_acompanhamento_mensal a JOIN tb_indicadores i USING (indicador_id) SET a.meta_tipo_snap = ? WHERE i.codigo IN (?)', [tipo, MENOR]);
  await reavaliar(q, 'i.codigo IN (?)', [MENOR], 'meta_vigente_qualit');

  // 3) % de repasse informativo (contrato compartilhado: regra por unidade já existe p/ UNACON)
  const alvo = 'regra_recebimento LIKE \'%"unidades"%\'';
  if (up) {
    await q(`UPDATE tb_historico_contrato SET regra_recebimento = JSON_SET(regra_recebimento, '$.unidades."${HMA}"', JSON_OBJECT('repasse_info', JSON_OBJECT('cumprido', ?, 'parcial', ?, 'nao_cumprido', ?))) WHERE ${alvo}`,
      [REPASSE.cumprido, REPASSE.parcial, REPASSE.nao_cumprido]);
  } else {
    await q(`UPDATE tb_historico_contrato SET regra_recebimento = JSON_REMOVE(regra_recebimento, '$.unidades."${HMA}"') WHERE ${alvo}`);
  }
}

module.exports = {
  up: (queryInterface) => aplicar(queryInterface, true),
  down: (queryInterface) => aplicar(queryInterface, false),
};
