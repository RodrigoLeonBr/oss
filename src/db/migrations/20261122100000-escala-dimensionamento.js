// Dimensionamento contratado das escalas (postos por turno, por setor) — base do "Contrato × Apresentado" —
// e permissões do módulo 'escalas'.

const PERMISSOES = [
    ['admin', 1, 1, 1, 1, 'global'],
    ['gestor_sms', 1, 1, 1, 0, 'global'],
    ['auditora', 1, 1, 1, 0, 'global'],
    ['conselheiro_cms', 1, 0, 0, 0, 'global'],
    ['visualizador', 1, 0, 0, 0, 'global'],
    ['contratada_scmc', 1, 0, 0, 0, 'proprio'],
    ['contratada_indsh', 1, 0, 0, 0, 'proprio'],
];

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('tb_escala_dimensionamento', {
            dimensionamento_id: {
                type: Sequelize.CHAR(36),
                primaryKey: true,
                defaultValue: Sequelize.literal('(UUID())'),
            },
            unidade_id: {
                type: Sequelize.CHAR(36),
                allowNull: false,
                references: { model: 'tb_unidades', key: 'unidade_id' },
                onDelete: 'CASCADE',
            },
            setor_id: {
                type: Sequelize.CHAR(36),
                allowNull: false,
                references: { model: 'tb_escala_setores', key: 'setor_id' },
                onDelete: 'CASCADE',
            },
            // null = qualquer categoria; senão filtra tb_escala_profissionais.categoria (medico, enfermagem…)
            categoria: { type: Sequelize.STRING(40), allowNull: true },
            turno_inicio: { type: Sequelize.TIME, allowNull: false },
            turno_fim: { type: Sequelize.TIME, allowNull: false }, // ≤ início = vira o dia
            qtd_postos: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
            dias_semana: { type: Sequelize.STRING(7), allowNull: false, defaultValue: '1234567' }, // 1=dom (DAYOFWEEK)
            vigencia_inicio: { type: Sequelize.DATEONLY, allowNull: false },
            vigencia_fim: { type: Sequelize.DATEONLY, allowNull: true },
            fonte: { type: Sequelize.STRING(300), allowNull: true },
            obs: { type: Sequelize.TEXT, allowNull: true },
            ativo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
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
        });
        await queryInterface.addIndex('tb_escala_dimensionamento', ['unidade_id', 'ativo'], {
            name: 'idx_escala_dim_unidade',
        });

        await queryInterface.bulkInsert(
            'tb_permissoes_perfil',
            PERMISSOES.map(([perfil, v, i, u, d, escopo]) => {
                return {
                    perfil,
                    modulo: 'escalas',
                    can_view: v,
                    can_insert: i,
                    can_update: u,
                    can_delete: d,
                    escopo,
                };
            }),
        );
    },

    async down(queryInterface) {
        await queryInterface.bulkDelete('tb_permissoes_perfil', { modulo: 'escalas' });
        await queryInterface.dropTable('tb_escala_dimensionamento');
    },
};
