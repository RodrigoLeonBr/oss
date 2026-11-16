// Execução financeira das prestações de contas (demonstrativo financeiro consolidado das OSS).
// Planilha = unidade x conta bancária (custeio/investimento/provisão) x mês; linhas = rubricas.
// Carga: src/db/extraiFinanceiro.py (xlsx -> .financeiro.json) + src/db/carregaFinanceiro.js.
// tb_execucao_financeira passa a ter unidade + conta e orçado opcional (prestação só traz realizado).
// Grupo de rubrica não é gravado em execução: é a soma das categorias (a carga valida contra a planilha).

const CONTAS = ['custeio', 'investimento', 'provisao'];

module.exports = {
    async up(queryInterface, Sequelize) {
        const q = (sql) => {
            return queryInterface.sequelize.query(sql);
        };
        const fk = (table, key, allowNull = false) => {
            return {
                type: Sequelize.CHAR(36),
                allowNull,
                references: { model: table, key },
                onDelete: allowNull ? 'SET NULL' : 'CASCADE',
            };
        };
        const uuid = {
            type: Sequelize.CHAR(36),
            primaryKey: true,
            defaultValue: Sequelize.literal('(UUID())'),
        };
        const base = {
            unidade_id: fk('tb_unidades', 'unidade_id'),
            conta: { type: Sequelize.ENUM(...CONTAS), allowNull: false },
            mes_referencia: { type: Sequelize.DATEONLY, allowNull: false },
        };
        const fonte = { fonte: Sequelize.STRING(255) };

        await queryInterface.addColumn('tb_rubricas', 'natureza', {
            type: Sequelize.ENUM('receita', 'despesa'),
            allowNull: false,
            defaultValue: 'despesa',
            after: 'nivel',
        });

        // tabela vazia até aqui: unidade_id pode nascer NOT NULL
        await queryInterface.addColumn('tb_execucao_financeira', 'unidade_id', {
            ...fk('tb_unidades', 'unidade_id'),
            after: 'rubrica_id',
        });
        await queryInterface.addColumn('tb_execucao_financeira', 'conta', {
            type: Sequelize.ENUM(...CONTAS),
            allowNull: false,
            defaultValue: 'custeio',
            after: 'unidade_id',
        });
        await queryInterface.addColumn('tb_execucao_financeira', 'fonte', {
            type: Sequelize.STRING(255),
            after: 'status_aprovacao',
        });
        await q('ALTER TABLE tb_execucao_financeira MODIFY valor_orcado DECIMAL(15,2) NULL');
        await queryInterface.removeConstraint('tb_execucao_financeira', 'uk_exec_rubrica_mes');
        await queryInterface.addIndex(
            'tb_execucao_financeira',
            ['unidade_id', 'conta', 'rubrica_id', 'mes_referencia'],
            {
                unique: true,
                name: 'uk_exec_unidade_conta_rubrica_mes',
            },
        );

        // Fluxos entre contas que não são receita nem despesa. valor > 0 entra na conta, < 0 sai.
        // contraparte NULL = recursos próprios da OSS / arredondamento.
        await queryInterface.createTable('tb_movimentacao_conta', {
            mov_id: uuid,
            ...base,
            tipo: {
                type: Sequelize.ENUM('transferencia', 'recursos_proprios', 'arredondamento'),
                allowNull: false,
            },
            contraparte_unidade_id: fk('tb_unidades', 'unidade_id', true),
            contraparte_conta: Sequelize.ENUM(...CONTAS),
            descricao: { type: Sequelize.STRING(200), allowNull: false },
            valor: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
            ...fonte,
        });
        await queryInterface.addIndex(
            'tb_movimentacao_conta',
            ['unidade_id', 'conta', 'mes_referencia', 'descricao'],
            {
                unique: true,
                name: 'uk_mov_conta_mes_desc',
            },
        );

        // Saldo no fim do mês. O saldo inicial do ano fica no mês anterior (ex.: 2025-12-01).
        await queryInterface.createTable('tb_saldo_conta', {
            saldo_id: uuid,
            ...base,
            saldo: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
            ...fonte,
        });
        await queryInterface.addIndex('tb_saldo_conta', ['unidade_id', 'conta', 'mes_referencia'], {
            unique: true,
            name: 'uk_saldo_conta_mes',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('tb_saldo_conta');
        await queryInterface.dropTable('tb_movimentacao_conta');
        await queryInterface.removeIndex(
            'tb_execucao_financeira',
            'uk_exec_unidade_conta_rubrica_mes',
        );
        await queryInterface.sequelize.query('DELETE FROM tb_execucao_financeira');
        await queryInterface.addConstraint('tb_execucao_financeira', {
            fields: ['rubrica_id', 'mes_referencia'],
            type: 'unique',
            name: 'uk_exec_rubrica_mes',
        });
        await queryInterface.sequelize.query(
            'ALTER TABLE tb_execucao_financeira MODIFY valor_orcado DECIMAL(15,2) NOT NULL',
        );
        await queryInterface.removeColumn('tb_execucao_financeira', 'fonte');
        await queryInterface.removeColumn('tb_execucao_financeira', 'conta');
        await queryInterface.removeColumn('tb_execucao_financeira', 'unidade_id');
        await queryInterface.removeColumn('tb_rubricas', 'natureza');
    },
};
