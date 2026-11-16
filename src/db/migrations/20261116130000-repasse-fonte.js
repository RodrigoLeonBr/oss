// Repasse da SMS por fonte de recurso (cronograma de desembolso do relatório da prestação de contas).
// Soma das fontes no mês = rubrica R01.01 (Repasse Secretaria de Saúde) em tb_execucao_financeira.
// Carga: src/db/carregaRepasseFonte.js.

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('tb_repasse_fonte', {
            repasse_fonte_id: {
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
            mes_referencia: { type: Sequelize.DATEONLY, allowNull: false },
            fonte_codigo: { type: Sequelize.CHAR(2), allowNull: false }, // 01 municipal, 02 estadual, 05 federal
            fonte_descricao: { type: Sequelize.STRING(60), allowNull: false }, // ex.: "Federal - MAC"
            valor: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
            fonte: Sequelize.STRING(255),
        });
        await queryInterface.addIndex(
            'tb_repasse_fonte',
            ['unidade_id', 'mes_referencia', 'fonte_codigo', 'fonte_descricao'],
            { unique: true, name: 'uk_repasse_fonte' },
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('tb_repasse_fonte');
    },
};
