// Gestão do financeiro pela Comissão: grupos canônicos (série entre planos de rubricas 2022/2024/…),
// observações (nota mês×unidade×conta, texto de seção do relatório, pendência com a OSS),
// fechamento de mês (read-only) e permissões do módulo 'financeiro'.

const CONTAS = ['custeio', 'investimento', 'provisao'];

const PERMISSOES = [
    ['admin', 1, 1, 1, 1],
    ['gestor_sms', 1, 1, 1, 0],
    ['auditora', 1, 1, 1, 0],
    ['conselheiro_cms', 1, 0, 0, 0],
    ['visualizador', 1, 0, 0, 0],
];

module.exports = {
    async up(queryInterface, Sequelize) {
        const uuid = {
            type: Sequelize.CHAR(36),
            primaryKey: true,
            defaultValue: Sequelize.literal('(UUID())'),
        };
        const fk = (table, key, allowNull = false) => {
            return {
                type: Sequelize.CHAR(36),
                allowNull,
                references: { model: table, key },
                onDelete: allowNull ? 'SET NULL' : 'CASCADE',
            };
        };
        const ts = {
            criado_em: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            atualizado_em: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        };

        // Grupo canônico: comum a todos os contratos/planos; cada rubrica (grupo ou categoria) aponta para um.
        await queryInterface.createTable('tb_grupo_financeiro', {
            grupo_financeiro_id: uuid,
            codigo: { type: Sequelize.STRING(20), allowNull: false, unique: true },
            nome: { type: Sequelize.STRING(100), allowNull: false },
            natureza: { type: Sequelize.ENUM('receita', 'despesa'), allowNull: false },
            ordem: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        });
        await queryInterface.addColumn('tb_rubricas', 'grupo_financeiro_id', {
            ...fk('tb_grupo_financeiro', 'grupo_financeiro_id', true),
            after: 'natureza',
        });

        await queryInterface.createTable('tb_observacao_financeira', {
            obs_id: uuid,
            contrato_id: fk('tb_contratos', 'contrato_id'),
            tipo: { type: Sequelize.ENUM('nota', 'secao', 'pendencia'), allowNull: false },
            unidade_id: fk('tb_unidades', 'unidade_id', true),
            conta: Sequelize.ENUM(...CONTAS),
            mes_referencia: Sequelize.DATEONLY, // nota/pendência: mês a que se refere
            periodo_ini: Sequelize.DATEONLY, // seção: período do relatório
            periodo_fim: Sequelize.DATEONLY,
            secao: Sequelize.STRING(60),
            texto: { type: Sequelize.TEXT, allowNull: false },
            status: Sequelize.ENUM('aberta', 'resolvida'),
            resolvida_em: Sequelize.DATE,
            origem: {
                type: Sequelize.ENUM('sistema', 'historico'),
                allowNull: false,
                defaultValue: 'sistema',
            },
            fonte: Sequelize.STRING(255), // historico: arquivo/página do parecer de onde veio
            criado_por: Sequelize.CHAR(36),
            ...ts,
            deletado_em: Sequelize.DATE,
        });
        await queryInterface.addIndex('tb_observacao_financeira', ['contrato_id', 'tipo', 'mes_referencia'], { name: 'ix_obsfin_mes' });
        await queryInterface.addIndex('tb_observacao_financeira', ['contrato_id', 'periodo_ini', 'periodo_fim', 'secao'], { name: 'ix_obsfin_secao' });

        await queryInterface.createTable('tb_fechamento_financeiro', {
            fechamento_id: uuid,
            contrato_id: fk('tb_contratos', 'contrato_id'),
            mes_referencia: { type: Sequelize.DATEONLY, allowNull: false },
            fechado_por: Sequelize.CHAR(36),
            fechado_em: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });
        await queryInterface.addIndex('tb_fechamento_financeiro', ['contrato_id', 'mes_referencia'], {
            unique: true,
            name: 'uk_fechamento_contrato_mes',
        });

        await queryInterface.bulkInsert(
            'tb_permissoes_perfil',
            PERMISSOES.map(([perfil, v, i, u, d]) => {
                return {
                    perfil,
                    modulo: 'financeiro',
                    can_view: v,
                    can_insert: i,
                    can_update: u,
                    can_delete: d,
                    escopo: 'global',
                };
            }),
        );
    },

    async down(queryInterface) {
        await queryInterface.bulkDelete('tb_permissoes_perfil', { modulo: 'financeiro' });
        await queryInterface.dropTable('tb_fechamento_financeiro');
        await queryInterface.dropTable('tb_observacao_financeira');
        await queryInterface.removeColumn('tb_rubricas', 'grupo_financeiro_id');
        await queryInterface.dropTable('tb_grupo_financeiro');
    },
};
