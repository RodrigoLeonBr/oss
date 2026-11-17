'use strict';

/**
 * Grupos canônicos de despesa = plano de 7 grupos usado em 2023 (o mais agregado; o plano de 14
 * grupos codificados de 2025+ cabe nele). Série histórica do painel agrega por aqui.
 * Fonte: prestacao-vault/vault/financeiro-historico/_analise/2025-parecer-anual-2023-final.md §2.
 */
const GRUPOS = [
    ['PESSOAL', 'Pessoal e reflexos (inclui serviços médicos)', 'despesa', 1],
    ['MAT_ASSIST', 'Materiais de consumo assistencial', 'despesa', 2],
    ['MAT_CONSUMO', 'Materiais de consumo', 'despesa', 3],
    ['FINANCEIRAS', 'Seguros, tributos e despesas bancárias', 'despesa', 4],
    ['GERAIS', 'Despesas gerais e administrativas', 'despesa', 5],
    ['SERVICOS', 'Serviços terceirizados, manutenção e locação', 'despesa', 6],
    ['INVESTIMENTO', 'Investimento (bens permanentes e obras)', 'despesa', 7],
];

// grupo do plano SCMC (código raiz em tb_rubricas) → grupo canônico
const DE_PARA = {
    '01': 'PESSOAL',
    '02': 'PESSOAL',
    '03': 'GERAIS',
    '04': 'GERAIS',
    '05': 'FINANCEIRAS',
    '06': 'MAT_ASSIST',
    '07': 'MAT_ASSIST',
    '08': 'MAT_CONSUMO',
    '09': 'MAT_CONSUMO',
    '10': 'SERVICOS',
    '11': 'SERVICOS',
    '12': 'GERAIS',
    '13': 'SERVICOS',
    '14': 'INVESTIMENTO',
};

module.exports = {
    async up(queryInterface) {
        const q = (sql, replacements) => {
            return queryInterface.sequelize.query(sql, { replacements });
        };
        for (const [codigo, nome, natureza, ordem] of GRUPOS) {
            await q(
                `INSERT INTO tb_grupo_financeiro (grupo_financeiro_id, codigo, nome, natureza, ordem)
                 VALUES (UUID(), ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE nome = VALUES(nome), natureza = VALUES(natureza), ordem = VALUES(ordem)`,
                [codigo, nome, natureza, ordem],
            );
        }
        // só rubricas raiz de despesa; categorias herdam do pai (FinanceiroService faz COALESCE)
        for (const [raiz, grupo] of Object.entries(DE_PARA)) {
            await q(
                `UPDATE tb_rubricas r JOIN tb_grupo_financeiro g ON g.codigo = ?
                    SET r.grupo_financeiro_id = g.grupo_financeiro_id
                  WHERE r.codigo = ? AND r.rubrica_pai_id IS NULL AND r.natureza = 'despesa'`,
                [grupo, raiz],
            );
        }
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query('UPDATE tb_rubricas SET grupo_financeiro_id = NULL');
        await queryInterface.sequelize.query('DELETE FROM tb_grupo_financeiro');
    },
};
