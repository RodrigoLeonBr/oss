'use strict';

// PA Zanaga (contrato 002/2025, INDSH): vigências anuais ago→jul, 90/10, grupos quantitativos com peso
// e 3 conjuntos qualitativos (vig.1 ago/24–jul/25: 12 | vig.2 ago/25–jul/26: 15 já existentes | vig.3 ago/26→: 10).
// Também: tb_notas_explicativas.alcance_considerado (aceite parcial da comissão, % do peso considerado).
// Idempotente por código. Nada de lançamento é apagado.

const { randomUUID } = require('crypto');

const C = 'cccc0003-0003-0003-0003-000000000003';
const U = 'uuuu0005-0005-0005-0005-000000000005';
const B_ATD = 'bbbb0016-0016-0016-0016-000000000016'; // reaproveita o antigo ZAN-PA
const B_CR = 'bbbb0017-0017-0017-0017-000000000017';
const B_SADT = 'bbbb0018-0018-0018-0018-000000000018';
const AD1 = 'aaaa0003-0001-0001-0001-000000000001';
const AD2 = 'aaaa0003-0002-0002-0002-000000000002';

const VIG1 = ['2024-08-01', '2025-07-31'];
const VIG2 = ['2025-08-01', '2026-07-31'];
const VIG3 = ['2026-08-01', null];

// [codigo, nome, meta, peso, grupo, meta_tipo]
const QUAL_VIG1 = [
  ['ZAN24-QL-01', 'Taxa de Satisfação dos Usuários', 80, 10, 'qualidade_atencao'],
  ['ZAN24-QL-02', 'Taxa de Prontuários Médicos Corretamente Finalizados', 100, 9, 'auditoria_operacional'],
  ['ZAN24-QL-03', 'Tempo Máximo Atendimento Risco Vermelho (≤5 min)', 100, 9, 'qualidade_atencao'],
  ['ZAN24-QL-04', 'Taxa de Transferência de Usuários (≤1%)', 1, 10, 'qualidade_atencao', 'menor_igual'],
  ['ZAN24-QL-05', 'Taxa de Revisão de Prontuários pela Comissão de Óbito', 100, 6, 'auditoria_operacional'],
  ['ZAN24-QL-06', 'Taxa de Revisão de Prontuários pela CCIH', 100, 6, 'auditoria_operacional'],
  ['ZAN24-QL-07', 'Taxa de Revisão de Prontuários (Salas Amarela/Vermelha)', 90, 6, 'auditoria_operacional'],
  ['ZAN24-QL-08', 'Taxa de Usuários Adultos Classificados por Enfermeiro', 70, 9, 'qualidade_atencao'],
  ['ZAN24-QL-09', 'Tempo Médio Espera Risco Verde (acolhimento ao médico)', 80, 9, 'qualidade_atencao'],
  ['ZAN24-QL-10', 'Tempo Médio Espera Risco Azul (acolhimento ao médico)', 80, 9, 'qualidade_atencao'],
  ['ZAN24-QL-11', 'Tempo Máximo Espera Risco Amarelo (≤30 min)', 90, 9, 'qualidade_atencao'],
  ['ZAN24-QL-12', 'Médicos Cadastrados no CNES', 100, 8, 'rh'],
];
const QUAL_VIG3 = [
  ['ZAN26-QL-01', 'Satisfação dos Usuários (amostra mínima 2%)', 85, 15, 'qualidade_atencao'],
  ['ZAN26-QL-02', 'Prontuários com Finalização Completa', 90, 9, 'auditoria_operacional'],
  ['ZAN26-QL-03', 'Atendimento Risco Vermelho (≤5 min)', 100, 9, 'qualidade_atencao'],
  ['ZAN26-QL-04', 'Transferências de Usuários (≤1%)', 1, 10, 'qualidade_atencao', 'menor_igual'],
  ['ZAN26-QL-05', 'Comissão de Óbitos', 100, 6, 'auditoria_operacional'],
  ['ZAN26-QL-06', 'CCIH — Comissão de Controle de Infecção', 100, 6, 'auditoria_operacional'],
  ['ZAN26-QL-07', 'Comissão de Revisão de Prontuários', 90, 6, 'auditoria_operacional'],
  ['ZAN26-QL-08', 'Classificação de Risco (Auditoria Manchester)', 100, 9, 'qualidade_atencao'],
  ['ZAN26-QL-09', 'Relatórios Assistenciais e Financeiros no Prazo', 100, 11, 'transversal'],
  ['ZAN26-QL-10', 'Educação Permanente (plano executado)', 100, 9, 'rh'],
];
// Lançamentos ago/26 já feitos no conjunto vig.2 que têm equivalente direto na vig.3
const MOVER_AGO26 = { 'ZAN-QL-14': 'ZAN26-QL-01', 'ZAN-QL-13': 'ZAN26-QL-09', 'ZAN-QL-15': 'ZAN26-QL-10' };

// [codigo, bloco, vigencia_inicio, obrigatorio]
const QUANT = [
  ['ZAN-QT-PA-01', B_ATD, VIG1[0], 1],
  ['ZAN-QT-PA-02', B_CR, VIG2[0], 1],
  ['ZAN-QT-PA-03', B_CR, VIG2[0], 0], // Procedimentos de Enfermagem: informativo
  ['ZAN-QT-SADT-01', B_SADT, VIG2[0], 1],
  ['ZAN-QT-SADT-02', B_SADT, VIG2[0], 1],
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const q = (sql, replacements) => queryInterface.sequelize.query(sql, { replacements });
    const [[{ n: temCol }]] = await q(
      "SELECT COUNT(*) n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'tb_notas_explicativas' AND column_name = 'alcance_considerado'",
    );
    if (!Number(temCol)) {
      await queryInterface.addColumn('tb_notas_explicativas', 'alcance_considerado', {
        type: Sequelize.DECIMAL(8, 4),
        allowNull: true,
        after: 'status_validacao',
        comment: 'Aceite da comissão: % do peso considerado (null = 100)',
      });
    }

    const [[contrato]] = await q('SELECT contrato_id, valor_mensal_base FROM tb_contratos WHERE contrato_id = ?', [C]);
    if (!contrato) return; // banco sem o seed do Zanaga
    const base = contrato.valor_mensal_base;

    // ── Contrato: início ago/24, 90/10, aditivos anuais ──────────────────────
    await q("UPDATE tb_contratos SET data_inicio = '2024-08-01', perc_fixo = 90, perc_variavel = 10, modelo_desconto_qual = 'ponderado' WHERE contrato_id = ?", [C]);
    for (const [id, n, ini, desc] of [
      [AD1, 1, VIG2[0], '1º aditamento: vigência ago/2025–jul/2026; quantitativo em 3 grupos (Atendimentos, Classificação de Risco, SADT); qualitativo 15 indicadores'],
      [AD2, 2, VIG3[0], '2º aditamento: vigência ago/2026–jul/2027; qualitativo 10 indicadores'],
    ]) {
      await q(
        `INSERT IGNORE INTO tb_aditivos (aditivo_id, contrato_id, numero_aditivo, data_assinatura, data_vigencia_inicio, tipo_aditivo, descricao_sumaria, valor_anterior, novo_valor_mensal, aplicado, aplicado_em)
         VALUES (?, ?, ?, ?, ?, 'misto', ?, ?, ?, 1, NOW())`,
        [id, C, n, ini, ini, desc, base, base],
      );
    }
    await q(
      `UPDATE tb_historico_contrato SET vigencia_inicio = ?, vigencia_fim = ?, perc_fixo = 90, perc_variavel = 10, modelo_desconto_qual = 'ponderado'
       WHERE contrato_id = ? AND versao = 1`,
      [VIG1[0], VIG1[1], C],
    );
    for (const [versao, ad, [ini, fim]] of [[2, AD1, VIG2], [3, AD2, VIG3]]) {
      const [[existe]] = await q('SELECT 1 x FROM tb_historico_contrato WHERE contrato_id = ? AND versao = ?', [C, versao]);
      if (!existe) {
        await q(
          `INSERT INTO tb_historico_contrato (historico_id, contrato_id, aditivo_id, versao, vigencia_inicio, vigencia_fim, valor_mensal_base, perc_fixo, perc_variavel, modelo_desconto_qual, motivo_versao)
           VALUES (UUID(), ?, ?, ?, ?, ?, ?, 90, 10, 'ponderado', ?)`,
          [C, ad, versao, ini, fim, base, `Aditamento ${versao - 1} (vigência ${ini}).`],
        );
      }
    }

    // ── Grupos quantitativos (blocos) com peso por vigência ──────────────────
    const fixa = Number(base) * 0.9;
    await q("UPDATE tb_blocos_producao SET nome = 'Atendimentos Médicos', percentual_peso_bloco = 33.33, valor_mensal_alocado = ? WHERE bloco_id = ?", [fixa / 3, B_ATD]);
    for (const [id, codigo, nome] of [[B_CR, 'ZAN-CR', 'Classificação de Risco'], [B_SADT, 'ZAN-SADT', 'SADT — Raio X e Exames Laboratoriais']]) {
      await q(
        `INSERT IGNORE INTO tb_blocos_producao (bloco_id, unidade_id, codigo, nome, valor_mensal_alocado, percentual_peso_bloco, ativo)
         VALUES (?, ?, ?, ?, ?, 33.33, 1)`,
        [id, U, codigo, nome, fixa / 3],
      );
    }
    const [[temHist]] = await q('SELECT COUNT(*) n FROM tb_historico_blocos WHERE bloco_id IN (?)', [[B_ATD, B_CR, B_SADT]]);
    if (!Number(temHist.n)) {
      for (const [bloco, ad, versao, [ini, fim], valor, peso] of [
        [B_ATD, null, 1, VIG1, fixa, 100],
        [B_ATD, AD1, 2, [VIG2[0], null], fixa / 3, 33.33],
        [B_CR, AD1, 1, [VIG2[0], null], fixa / 3, 33.33],
        [B_SADT, AD1, 1, [VIG2[0], null], fixa / 3, 33.34],
      ]) {
        await q(
          `INSERT INTO tb_historico_blocos (hist_bloco_id, bloco_id, aditivo_id, versao, vigencia_inicio, vigencia_fim, valor_mensal_alocado, percentual_peso_bloco, motivo_versao)
           VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, 'Grupo quantitativo PA Zanaga (peso igual entre grupos vigentes)')`,
          [bloco, ad, versao, ini, fim, valor, peso],
        );
      }
    }

    // ── Quantitativos: bloco, vigência, informativo, tolerância 80% ──────────
    for (const [codigo, bloco, ini, obrigatorio] of QUANT) {
      await q('UPDATE tb_indicadores SET bloco_id = ?, vigencia_inicio = ?, vigencia_fim = NULL, obrigatorio = ? WHERE codigo = ?', [bloco, ini, obrigatorio, codigo]);
    }
    const quantCodigos = QUANT.map((x) => x[0]);
    await q('UPDATE tb_metas m JOIN tb_indicadores i USING (indicador_id) SET m.meta_minima = 80, m.meta_parcial = 80 WHERE i.codigo IN (?)', [quantCodigos]);
    await q('UPDATE tb_acompanhamento_mensal a JOIN tb_indicadores i USING (indicador_id) SET a.meta_minima = 80, a.meta_parcial = 80 WHERE i.codigo IN (?)', [quantCodigos]);

    // ── Qualitativos vig.2 (existentes): vigência ago/25–jul/26 ──────────────
    await q("UPDATE tb_indicadores SET vigencia_inicio = ?, vigencia_fim = ? WHERE codigo LIKE 'ZAN-QL-%'", VIG2);

    // ── Qualitativos vig.1 e vig.3 ───────────────────────────────────────────
    const criar = async (lista, [ini, fim], ano) => {
      for (const [codigo, nome, meta, peso, grupo, metaTipo = 'maior_igual'] of lista) {
        const [[ja]] = await q('SELECT indicador_id FROM tb_indicadores WHERE codigo = ?', [codigo]);
        if (ja) continue;
        const indId = randomUUID();
        await q(
          `INSERT INTO tb_indicadores (indicador_id, unidade_id, codigo, nome, tipo, grupo, unidade_medida, periodicidade, fonte_dados, peso_perc, meta_tipo, contrato_id, ano, obrigatorio, vigencia_inicio, vigencia_fim)
           VALUES (?, ?, ?, ?, 'qualitativo', ?, '%', 'mensal', 'Manual', ?, ?, ?, ?, 1, ?, ?)`,
          [indId, U, codigo, `${nome} (UPA Zanaga)`, grupo, peso, metaTipo, C, ano, ini, fim],
        );
        await q(
          `INSERT INTO tb_metas (meta_id, indicador_id, versao, nome, meta_valor_qualit, meta_tipo, unidade_medida, papel)
           VALUES (UUID(), ?, 1, ?, ?, ?, '%', 'avulsa')`,
          [indId, `Meta ${codigo}`, meta, metaTipo],
        );
      }
    };
    await criar(QUAL_VIG1, VIG1, 2024);
    await criar(QUAL_VIG3, VIG3, 2026);

    // ── ago/26: move lançamentos equivalentes p/ o conjunto vig.3 ────────────
    for (const [de, para] of Object.entries(MOVER_AGO26)) {
      await q(
        `UPDATE tb_acompanhamento_mensal a
           JOIN tb_indicadores io ON io.indicador_id = a.indicador_id AND io.codigo = ?
           JOIN tb_indicadores dst ON dst.codigo = ?
           JOIN tb_metas md ON md.indicador_id = dst.indicador_id
            SET a.indicador_id = dst.indicador_id, a.meta_id = md.meta_id, a.meta_vigente_qualit = md.meta_valor_qualit
          WHERE a.mes_referencia >= ?`,
        [de, para, VIG3[0]],
      );
    }
    const [sobra] = await q(
      "SELECT i.codigo, DATE_FORMAT(a.mes_referencia, '%Y-%m') mes FROM tb_acompanhamento_mensal a JOIN tb_indicadores i USING (indicador_id) WHERE i.codigo LIKE 'ZAN-QL-%' AND a.mes_referencia >= ?",
      [VIG3[0]],
    );
    if (sobra.length) {
      console.log(`[zanaga] ${sobra.length} lançamento(s) qualitativo(s) de ago/26+ ficaram no conjunto vig.2 (fora de vigência, relançar na vig.3): ${sobra.map((s) => `${s.codigo}@${s.mes}`).join(', ')}`);
    }
  },

  async down(queryInterface) {
    const q = (sql, replacements) => queryInterface.sequelize.query(sql, { replacements });
    for (const [de, para] of Object.entries(MOVER_AGO26)) {
      await q(
        `UPDATE tb_acompanhamento_mensal a
           JOIN tb_indicadores io ON io.indicador_id = a.indicador_id AND io.codigo = ?
           JOIN tb_indicadores dst ON dst.codigo = ?
           JOIN tb_metas md ON md.indicador_id = dst.indicador_id
            SET a.indicador_id = dst.indicador_id, a.meta_id = md.meta_id, a.meta_vigente_qualit = md.meta_valor_qualit
          WHERE a.mes_referencia >= ?`,
        [para, de, VIG3[0]],
      );
    }
    const novos = [...QUAL_VIG1, ...QUAL_VIG3].map((x) => x[0]);
    await q('DELETE m FROM tb_metas m JOIN tb_indicadores i USING (indicador_id) WHERE i.codigo IN (?)', [novos]);
    await q('DELETE FROM tb_indicadores WHERE codigo IN (?)', [novos]);
    await q("UPDATE tb_indicadores SET vigencia_inicio = '2026-01-01', vigencia_fim = NULL WHERE codigo LIKE 'ZAN-QL-%'");
    const quantCodigos = QUANT.map((x) => x[0]);
    await q('UPDATE tb_acompanhamento_mensal a JOIN tb_indicadores i USING (indicador_id) SET a.meta_minima = NULL, a.meta_parcial = NULL WHERE i.codigo IN (?)', [quantCodigos]);
    await q('UPDATE tb_metas m JOIN tb_indicadores i USING (indicador_id) SET m.meta_minima = NULL, m.meta_parcial = NULL WHERE i.codigo IN (?)', [quantCodigos]);
    await q("UPDATE tb_indicadores SET bloco_id = ?, vigencia_inicio = '2026-01-01', obrigatorio = 1 WHERE codigo IN (?)", [B_ATD, quantCodigos]);
    await q('DELETE FROM tb_historico_blocos WHERE bloco_id IN (?)', [[B_ATD, B_CR, B_SADT]]);
    await q('DELETE FROM tb_blocos_producao WHERE bloco_id IN (?)', [[B_CR, B_SADT]]);
    await q("UPDATE tb_blocos_producao SET nome = 'Pronto Atendimento', percentual_peso_bloco = 100, valor_mensal_alocado = 2400000 WHERE bloco_id = ?", [B_ATD]);
    await q('DELETE FROM tb_historico_contrato WHERE contrato_id = ? AND versao IN (2, 3)', [C]);
    await q("UPDATE tb_historico_contrato SET vigencia_inicio = '2025-01-01', vigencia_fim = NULL, perc_fixo = 85, perc_variavel = 15, modelo_desconto_qual = 'flat' WHERE contrato_id = ? AND versao = 1", [C]);
    await q('DELETE FROM tb_aditivos WHERE aditivo_id IN (?)', [[AD1, AD2]]);
    await q("UPDATE tb_contratos SET data_inicio = '2025-01-01', perc_fixo = 85, perc_variavel = 15, modelo_desconto_qual = 'flat' WHERE contrato_id = ?", [C]);
    await queryInterface.removeColumn('tb_notas_explicativas', 'alcance_considerado');
  },
};
