'use strict';

// UNACON (contrato 009/2023, compartilhado com HMA e UPA Cillos — 6º Termo Aditivo, 2026):
// regra por unidade em tb_historico_contrato.regra_recebimento.unidades[unidade_id].
// - 95% produção: eixos Quimioterapia 62,5 / Cirurgias 37,5 (50/30 do TR redistribuído enquanto o
//   eixo Ambulatório/Consultas 20% não tem indicadores); SADT de retaguarda = informativo (peso 0).
//   Faixas ≥85 sem desconto, 70–84,9 −10%, <70 −30%. Apuração quadrimestral (aplica mai/set/jan).
// - 5% qualitativo linear: perde 5% × peso da meta não atingida por mês (binário), quadrimestral.
// - Pequena Cirurgia: "não é meta, apenas acompanhamento" → obrigatorio = 0.
// Valor mensal = tb_unidades.valor_mensal_unidade (provisório). Idempotente.

const C009 = 'cccc0001-0001-0001-0001-000000000001';
const UNA = 'uuuu0002-0002-0002-0002-000000000002';

const REGRA_UNA = {
  modelo: 'producao_qualidade',
  pontuacao: 'binaria',
  perc_fixo: 95,
  perc_variavel: 5,
  // peso do eixo por código de bloco (sobrepõe tb_blocos_producao, que é rateio do contrato inteiro)
  pesos_blocos: { 'UNA-QT': 62.5, 'UNA-PC': 37.5, 'UNA-SADT': 0 },
  qualidade: { modo: 'linear', periodo: 'quadrimestral' },
  producao: { faixas: [{ min: 85, desc: 0 }, { min: 70, desc: 10 }], abaixo: 30, periodo: 'quadrimestral' },
};

const comUnidade = (json, regra) => {
  const r = json ? JSON.parse(json) : {};
  const unidades = { ...(r.unidades || {}) };
  if (regra) unidades[UNA] = regra;
  else delete unidades[UNA];
  const out = { ...r, unidades };
  if (!Object.keys(unidades).length) delete out.unidades;
  return Object.keys(out).length ? JSON.stringify(out) : null;
};

async function gravarRegra(q, regra) {
  const [hs] = await q('SELECT historico_id, regra_recebimento FROM tb_historico_contrato WHERE contrato_id = ?', [C009]);
  for (const h of hs) {
    await q('UPDATE tb_historico_contrato SET regra_recebimento = ? WHERE historico_id = ?', [comUnidade(h.regra_recebimento, regra), h.historico_id]);
  }
}

module.exports = {
  async up(queryInterface) {
    const q = (sql, replacements) => queryInterface.sequelize.query(sql, { replacements });
    const [[c]] = await q('SELECT contrato_id FROM tb_contratos WHERE contrato_id = ?', [C009]);
    if (!c) return;

    await gravarRegra(q, REGRA_UNA);

    await q("UPDATE tb_indicadores SET obrigatorio = 0 WHERE codigo = 'UNA-QT-PC-03' AND unidade_id = ?", [UNA]);
  },

  async down(queryInterface) {
    const q = (sql, replacements) => queryInterface.sequelize.query(sql, { replacements });
    await q("UPDATE tb_indicadores SET obrigatorio = 1 WHERE codigo = 'UNA-QT-PC-03' AND unidade_id = ?", [UNA]);
    await gravarRegra(q, null);
  },
};
