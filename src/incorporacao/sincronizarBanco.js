// Espelha o catálogo SQLite (prestacao-vault/indice/vault.db) em tb_documento (MySQL).
// Upsert por caminho_md em lotes; documentos que saíram do catálogo ficam com ativo = 0.
// Roda no host (precisa do banco): npm run catalogo:atualizar -- --banco

const { abrir } = require('./catalogo');

const SIGLA = {
    hm: 'HMA',
    unacon: 'UNACON',
    upa_cillos: 'UPA-CIL',
    upa_dona_rosa: 'UPA-DR',
    pa_zanaga: 'UPA-ZAN',
};
const LOTE = 500;
const dataOuNulo = (s) => {
    return s ? new Date(s) : null;
};

async function sincronizar() {
    // eslint-disable-next-line global-require
    const db = require('../models');
    const t0 = Date.now();
    const lite = abrir();
    const docs = lite.prepare('SELECT * FROM documentos').all();
    lite.close();

    const [us] = await db.sequelize.query(
        'SELECT unidade_id, sigla FROM tb_unidades WHERE deleted_at IS NULL',
    );
    const porSigla = Object.fromEntries(
        us.map((u) => {
            return [u.sigla, u.unidade_id];
        }),
    );

    const colunas = [
        'caminho_md',
        'origem_pdf',
        'hash_md',
        'unidade_id',
        'unidade_vault',
        'ano',
        'mes',
        'competencia',
        'tipo',
        'subpath',
        'assunto',
        'paginas',
        'scanned',
        'ocr',
        'convertido_em',
        'catalogado_em',
        'ativo',
    ];
    const atualiza = colunas
        .filter((c) => {
            return c !== 'caminho_md';
        })
        .map((c) => {
            return `${c} = VALUES(${c})`;
        })
        .join(', ');
    let gravados = 0;
    for (let i = 0; i < docs.length; i += LOTE) {
        const lote = docs.slice(i, i + LOTE);
        const vals = [];
        const linhas = lote.map((d) => {
            vals.push(
                d.caminho_md,
                d.origem,
                d.hash,
                porSigla[SIGLA[d.unidade]] || null,
                d.unidade,
                d.ano,
                d.mes,
                d.competencia,
                d.tipo,
                d.subpath,
                (d.assunto || '').slice(0, 300),
                d.paginas,
                d.scanned ? 1 : 0,
                d.ocr,
                dataOuNulo(d.convertido_em),
                dataOuNulo(d.catalogado_em),
                d.ativo,
            );
            return `(${colunas
                .map(() => {
                    return '?';
                })
                .join(',')})`;
        });
        // eslint-disable-next-line no-await-in-loop
        await db.sequelize.query(
            `INSERT INTO tb_documento (${colunas.join(',')}) VALUES ${linhas.join(
                ',',
            )} ON DUPLICATE KEY UPDATE ${atualiza}, atualizado_em = CURRENT_TIMESTAMP`,
            { replacements: vals, logging: false },
        );
        gravados += lote.length;
    }
    const [[{ n }]] = await db.sequelize.query(
        'SELECT COUNT(*) n FROM tb_documento WHERE ativo = 1',
    );
    await db.sequelize.close();
    return { gravados, ativos_no_banco: Number(n), ms: Date.now() - t0 };
}

module.exports = { sincronizar };
