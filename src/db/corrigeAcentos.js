/**
 * Corrige acentuação perdida em carga antiga (charset): cada caractere não-ASCII virou '??' ('???' p/ —, ≥, ≤).
 * 1) de-para exato em src/db/dados/acentos-depara.json (gerado no DEV a partir dos valores corrigidos);
 * 2) senão, casa com textos dos seeders (frase inteira ou palavra a palavra, candidato único).
 * Valor sem solução segura fica como está e é listado.
 *
 * Uso:  node src/db/corrigeAcentos.js            # prévia (não grava)
 *       node src/db/corrigeAcentos.js --aplicar  # grava
 * Container: docker compose -f docker-compose.deploy.yml exec api node src/db/corrigeAcentos.js --aplicar
 */
const fs = require('fs');
const path = require('path');
const db = require('../models');

const DEPARA = require('./dados/acentos-depara.json');
const ALVOS = [
    ['tb_indicadores', 'indicador_id', 'nome'],
    ['tb_indicadores', 'indicador_id', 'unidade_medida'],
    ['tb_metas', 'meta_id', 'unidade_medida'],
    ['tb_metas', 'meta_id', 'observacoes'],
    ['tb_blocos_producao', 'bloco_id', 'nome'],
    ['tb_unidades', 'unidade_id', 'especialidades'], // JSON (array de strings)
];
const ESPECIAL = { 'N??': 'Nº', '??': '×', '???': '—', '1??': '1º' }; // palavra isolada

const seeders = path.join(__dirname, 'seeders');
const texto = fs.readdirSync(seeders).map((f) => {
    return fs.readFileSync(path.join(seeders, f), 'utf8');
}).join('\n') + Object.values(DEPARA).join('\n');
const frases = [...new Set([...texto.matchAll(/'([^'\n]{4,160})'/g)].map((m) => {
    return m[1];
}).concat(Object.values(DEPARA)).filter((s) => {
    return /[^\x00-\x7F]/.test(s);
}))];
const palavras = [...new Set(texto.match(/[A-Za-zÀ-ÿºª×]+/g))];

const esc = (s) => {
    return s.replace(/[.*+()[\]{}|^$\\]/g, '\\$&');
};
// corrida de n '?' = 1..n/2 caracteres não-ASCII (2 ou 3 bytes cada)
const padrao = (s) => {
    return new RegExp(`^${s.split(/(\?{2,})/).map((t, i) => {
        return i % 2 ? `[^\\x00-\\x7F]{1,${Math.floor(t.length / 2)}}` : esc(t);
    }).join('')}$`);
};
const unico = (lista, re) => {
    const c = [...new Set(lista.filter((x) => {
        return re.test(x);
    }))];
    return new Set(c.map((x) => {
        return x.toLowerCase();
    })).size === 1 ? c[0] : null;
};

function conserta(v) {
    if (!/\?\?/.test(v)) return v;
    if (DEPARA[v]) return DEPARA[v];
    const inteira = unico(frases, padrao(v));
    if (inteira) return inteira;
    const out = [];
    for (const w of v.split(/(\s+|[()/,>%.-])/)) {
        if (!/\?\?/.test(w)) out.push(w);
        else if (ESPECIAL[w]) out.push(ESPECIAL[w]);
        else {
            const p = unico(palavras, padrao(w));
            if (!p) return null;
            out.push(p);
        }
    }
    return out.join('');
}

async function main() {
    const aplicar = process.argv.includes('--aplicar');
    let total = 0;
    for (const [tabela, pk, col] of ALVOS) {
        const [linhas] = await db.sequelize.query(
            `SELECT ${pk} AS id, ${col} AS v FROM ${tabela} WHERE ${col} LIKE '%??%'`,
            { logging: false },
        );
        const sem = new Set();
        let ok = 0;
        for (const { id, v: bruto } of linhas) {
            const v = typeof bruto === 'string' ? bruto : JSON.stringify(bruto);
            let novo;
            if (v.startsWith('[')) {
                const itens = JSON.parse(v).map((x) => {
                    return conserta(x) || x;
                });
                novo = JSON.stringify(itens);
            } else novo = conserta(v);
            if (!novo || /\?\?/.test(novo)) {
                sem.add(v);
                continue; // eslint-disable-line no-continue
            }
            if (aplicar) {
                await db.sequelize.query(`UPDATE ${tabela} SET ${col} = ? WHERE ${pk} = ?`, {
                    replacements: [novo, id],
                    logging: false,
                });
            }
            ok++;
        }
        total += ok;
        console.log(`${tabela}.${col}: corrompidos ${linhas.length}, ${aplicar ? 'corrigidos' : 'corrigíveis'} ${ok}, sem solução ${sem.size}`);
        sem.forEach((x) => {
            console.log(`   ? ${x.slice(0, 140)}`);
        });
    }
    console.log(aplicar ? `OK: ${total} valores gravados.` : `Prévia: ${total} valores. Rode com --aplicar para gravar.`);
}

if (require.main === module) {
    // self-check do reconstrutor (sem banco)
    console.assert(conserta('Raz??o') === 'Razão', 'palavra');
    console.assert(conserta('Monitoramento ??? sem meta num??rica no aditivo') === 'Monitoramento — sem meta numérica no aditivo', 'frase');
    main().catch((e) => {
        console.error(e);
        process.exitCode = 1;
    }).finally(() => {
        return db.sequelize.close();
    });
}

module.exports = { conserta };
