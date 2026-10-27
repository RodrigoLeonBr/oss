'use strict';

// Regra de recebimento versionada por vigência (tb_historico_contrato.regra_recebimento, JSON).
// - PA Zanaga (002/2025): fixa_variavel, proporcional, escala 95/90/80/70.
// - UPA Dona Rosa (066/2024, 2º aditivo 2026): producao_qualidade — repasse × escala(nota qual por níveis)
//   − desconto por faixa das linhas Atendimento/SADT (50/50 sobre 95%), apuração trimestral.
// Idempotente.

const ZAN = 'cccc0003-0003-0003-0003-000000000003';
const DR = 'cccc0002-0002-0002-0002-000000000002';
const DR_UNI = 'uuuu0004-0004-0004-0004-000000000004';
const DR_AD2 = 'aaaa0002-0002-0002-0002-000000000002';
const DR_PA = 'bbbb0014-0014-0014-0014-000000000014';
const DR_SADT = 'bbbb0015-0015-0015-0015-000000000015';
const DR_VALOR = 1600982.91;
const DR_INI = '2026-01-01';

const REGRA_ZAN = {
  modelo: 'fixa_variavel',
  pontuacao: 'proporcional',
  escala: [{ min: 95, perc: 100 }, { min: 90, perc: 90 }, { min: 80, perc: 80 }, { min: 70, perc: 60 }],
  abaixo: 0,
};
const REGRA_DR = {
  modelo: 'producao_qualidade',
  pontuacao: 'niveis',
  escala: [{ min: 80, perc: 100 }, { min: 75, perc: 95 }, { min: 65, perc: 90 }],
  abaixo: 85,
  producao: { faixas: [{ min: 85, desc: 0 }, { min: 70, desc: 10 }], abaixo: 30, periodo: 'trimestral' },
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const q = (sql, replacements) => queryInterface.sequelize.query(sql, { replacements });
    const [[{ n: temCol }]] = await q(
      "SELECT COUNT(*) n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'tb_historico_contrato' AND column_name = 'regra_recebimento'",
    );
    if (!Number(temCol)) {
      await queryInterface.addColumn('tb_historico_contrato', 'regra_recebimento', {
        type: Sequelize.TEXT,
        allowNull: true,
        after: 'motivo_versao',
        comment: 'JSON regra de recebimento da vigência (helper/percentualRecebimento.js); null = fixa_variavel padrão',
      });
    }

    await q('UPDATE tb_historico_contrato SET regra_recebimento = ? WHERE contrato_id = ?', [JSON.stringify(REGRA_ZAN), ZAN]);

    const [[dr]] = await q('SELECT contrato_id FROM tb_contratos WHERE contrato_id = ?', [DR]);
    if (!dr) return; // banco sem o seed da Dona Rosa

    // ── Contrato / aditivo / vigência 2026 ───────────────────────────────────
    await q('UPDATE tb_contratos SET valor_mensal_base = ?, perc_fixo = 95, perc_variavel = 5 WHERE contrato_id = ?', [DR_VALOR, DR]);
    await q(
      `INSERT IGNORE INTO tb_aditivos (aditivo_id, contrato_id, numero_aditivo, data_assinatura, data_vigencia_inicio, tipo_aditivo, descricao_sumaria, novo_valor_mensal, aplicado, aplicado_em)
       VALUES (?, ?, 2, ?, ?, 'misto', '2º Termo Aditivo: Plano de Trabalho 2026 (SADT RX 1.450 / Lab 3.000; matriz de pontuação qualitativa)', ?, 1, NOW())`,
      [DR_AD2, DR, DR_INI, DR_INI, DR_VALOR],
    );
    await q("UPDATE tb_historico_contrato SET vigencia_fim = '2025-12-31' WHERE contrato_id = ? AND versao = 1 AND vigencia_fim IS NULL", [DR]);
    const [[v2]] = await q('SELECT 1 x FROM tb_historico_contrato WHERE contrato_id = ? AND versao = 2', [DR]);
    if (!v2) {
      await q(
        `INSERT INTO tb_historico_contrato (historico_id, contrato_id, aditivo_id, versao, vigencia_inicio, vigencia_fim, valor_mensal_base, perc_fixo, perc_variavel, modelo_desconto_qual, motivo_versao, regra_recebimento)
         VALUES (UUID(), ?, ?, 2, ?, NULL, ?, 95, 5, 'ponderado', '2º Termo Aditivo — Plano de Trabalho 2026.', ?)`,
        [DR, DR_AD2, DR_INI, DR_VALOR, JSON.stringify(REGRA_DR)],
      );
    } else {
      await q('UPDATE tb_historico_contrato SET regra_recebimento = ? WHERE contrato_id = ? AND versao = 2', [JSON.stringify(REGRA_DR), DR]);
    }

    // ── Linhas de serviço: Atendimento e SADT 50/50 ──────────────────────────
    const metade = (DR_VALOR * 0.95) / 2;
    await q("UPDATE tb_blocos_producao SET percentual_peso_bloco = 50, valor_mensal_alocado = ?, nome = 'Atendimentos Médicos' WHERE bloco_id = ?", [metade, DR_PA]);
    await q("UPDATE tb_blocos_producao SET percentual_peso_bloco = 50, valor_mensal_alocado = ?, nome = 'SADT — Raio X e Exames Laboratoriais' WHERE bloco_id = ?", [metade, DR_SADT]);
    const [[hb]] = await q('SELECT COUNT(*) n FROM tb_historico_blocos WHERE bloco_id IN (?)', [[DR_PA, DR_SADT]]);
    if (!Number(hb.n)) {
      for (const bloco of [DR_PA, DR_SADT]) {
        await q(
          `INSERT INTO tb_historico_blocos (hist_bloco_id, bloco_id, aditivo_id, versao, vigencia_inicio, vigencia_fim, valor_mensal_alocado, percentual_peso_bloco, motivo_versao)
           VALUES (UUID(), ?, ?, 1, ?, NULL, ?, 50, 'Linha de serviço UPA Dona Rosa (cláusula 14.1: 50/50 sobre 95% do custeio)')`,
          [bloco, DR_AD2, DR_INI, metade],
        );
      }
    }

    // ── Correções de meta (valores lançados já estão nesta escala) ───────────
    await q("UPDATE tb_indicadores SET peso_perc = 5, meta_tipo = 'menor_igual' WHERE codigo = 'DR-QL-15'");
    await q("UPDATE tb_indicadores SET meta_tipo = 'menor_igual' WHERE codigo = 'DR-QL-18'");
    await q(
      `UPDATE tb_metas m JOIN tb_indicadores i USING (indicador_id)
          SET m.meta_tipo = 'menor_igual', m.meta_valor_qualit = CASE i.codigo WHEN 'DR-QL-15' THEN 4 ELSE 24 END, m.meta_minima = NULL, m.meta_parcial = NULL
        WHERE i.codigo IN ('DR-QL-15', 'DR-QL-18')`,
    );
    await q(
      `UPDATE tb_acompanhamento_mensal a JOIN tb_indicadores i USING (indicador_id)
          SET a.meta_tipo_snap = 'menor_igual', a.meta_minima = NULL, a.meta_parcial = NULL
        WHERE i.codigo IN ('DR-QL-15', 'DR-QL-18') AND i.unidade_id = ?`,
      [DR_UNI],
    );
  },

  async down(queryInterface) {
    const q = (sql, replacements) => queryInterface.sequelize.query(sql, { replacements });
    await q(
      `UPDATE tb_acompanhamento_mensal a JOIN tb_indicadores i USING (indicador_id)
          SET a.meta_tipo_snap = 'maior_igual' WHERE i.codigo IN ('DR-QL-15', 'DR-QL-18')`,
    );
    await q(
      `UPDATE tb_metas m JOIN tb_indicadores i USING (indicador_id)
          SET m.meta_tipo = 'maior_igual', m.meta_valor_qualit = CASE i.codigo WHEN 'DR-QL-15' THEN 100 ELSE 24 END,
              m.meta_minima = CASE i.codigo WHEN 'DR-QL-15' THEN 0.85 ELSE NULL END,
              m.meta_parcial = CASE i.codigo WHEN 'DR-QL-15' THEN 0.70 ELSE NULL END
        WHERE i.codigo IN ('DR-QL-15', 'DR-QL-18')`,
    );
    await q("UPDATE tb_indicadores SET peso_perc = 100, meta_tipo = 'maior_igual' WHERE codigo = 'DR-QL-15'");
    await q("UPDATE tb_indicadores SET meta_tipo = 'maior_igual' WHERE codigo = 'DR-QL-18'");
    await q('DELETE FROM tb_historico_blocos WHERE bloco_id IN (?)', [[DR_PA, DR_SADT]]);
    await q("UPDATE tb_blocos_producao SET percentual_peso_bloco = 62.5, valor_mensal_alocado = 1500000, nome = 'Atendimento Médico' WHERE bloco_id = ?", [DR_PA]);
    await q("UPDATE tb_blocos_producao SET percentual_peso_bloco = 37.5, valor_mensal_alocado = 900000, nome = 'SADT' WHERE bloco_id = ?", [DR_SADT]);
    await q('DELETE FROM tb_historico_contrato WHERE contrato_id = ? AND versao = 2', [DR]);
    await q('UPDATE tb_historico_contrato SET vigencia_fim = NULL WHERE contrato_id = ? AND versao = 1', [DR]);
    await q('DELETE FROM tb_aditivos WHERE aditivo_id = ?', [DR_AD2]);
    await q('UPDATE tb_contratos SET valor_mensal_base = 2400000, perc_fixo = 85, perc_variavel = 15 WHERE contrato_id = ?', [DR]);
    await queryInterface.removeColumn('tb_historico_contrato', 'regra_recebimento');
  },
};
