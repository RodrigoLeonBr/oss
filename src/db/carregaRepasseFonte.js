// Carrega o repasse por fonte de recurso (transcrito do cronograma de desembolso dos relatórios) em tb_repasse_fonte.
// Uso: node src/db/carregaRepasseFonte.js <repasse-fontes.json>
// JSON: { "fonte": "<documento>", "linhas": [["HMA", "2026-01", "05", "Federal - MAC", 1528379.44], ...] }
// Só grava se, por unidade/mês, a soma das fontes = repasse (R01.01) já carregado em tb_execucao_financeira.
// Idempotente: apaga e regrava os (unidade, mês) do arquivo.

const fs = require('fs');
const db = require('../models');

const q = (sql, replacements, transaction) => {
    return db.sequelize.query(sql, { replacements, transaction, logging: false });
};

async function carregar(arquivo) {
    const { fonte, linhas } = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    const [repasses] = await q(
        `SELECT u.sigla, u.unidade_id, DATE_FORMAT(e.mes_referencia, '%Y-%m') AS mes, SUM(e.valor_realizado) AS valor
         FROM tb_execucao_financeira e JOIN tb_rubricas r USING (rubrica_id) JOIN tb_unidades u USING (unidade_id)
         WHERE r.codigo = 'R01.01' GROUP BY u.unidade_id, e.mes_referencia`,
    );
    const chave = (sigla, mes) => {
        return `${sigla}|${mes}`;
    };
    const repasse = new Map(
        repasses.map((r) => {
            return [chave(r.sigla, r.mes), r];
        }),
    );
    const soma = new Map();
    linhas.forEach(([sigla, mes, , , valor]) => {
        const k = chave(sigla, mes);
        soma.set(k, (soma.get(k) || 0) + Math.round(valor * 100));
    });
    const erros = [];
    soma.forEach((v, k) => {
        const r = repasse.get(k);
        if (!r) {
            erros.push(`${k}: sem repasse carregado`);
        } else if (Math.round(r.valor * 100) !== v) {
            erros.push(`${k}: fontes ${v / 100} ≠ repasse ${r.valor}`);
        }
    });
    if (erros.length) {
        throw new Error(`Fontes não fecham com o repasse:\n  ${erros.join('\n  ')}`);
    }

    await db.sequelize.transaction(async (t) => {
        const meses = [...soma.keys()].map((k) => {
            return [repasse.get(k).unidade_id, `${k.split('|')[1]}-01`];
        });
        await q(
            'DELETE FROM tb_repasse_fonte WHERE (unidade_id, mes_referencia) IN (?)',
            [meses],
            t,
        );
        await q(
            `INSERT INTO tb_repasse_fonte (unidade_id, mes_referencia, fonte_codigo, fonte_descricao, valor, fonte) VALUES ?`,
            [
                linhas
                    .filter(([, , , , valor]) => {
                        return Math.round(valor * 100) !== 0;
                    })
                    .map(([sigla, mes, codigo, descricao, valor]) => {
                        return [
                            repasse.get(chave(sigla, mes)).unidade_id,
                            `${mes}-01`,
                            codigo,
                            descricao,
                            valor,
                            fonte,
                        ];
                    }),
            ],
            t,
        );
    });
    console.log(`${soma.size} unidade/mês conferidos e gravados`);
    await db.sequelize.close();
}

carregar(process.argv[2]).catch((e) => {
    console.error(e.message);
    process.exit(1);
});
