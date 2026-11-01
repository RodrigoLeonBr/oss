// Ponte por arquivos (contingência do MCP). O chat grava claude-bridge/inbox/<id>.json:
//   { "id": "...", "ferramenta": "<nome>", "params": { ... } }
// e lê claude-bridge/outbox/<id>.json (+ <id>.md quando formato != json).
// Uso: npm run ponte   (deixar rodando no host; não no container)
require('../core/bootstrap');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { db } = require('../core/bootstrap');
const { executar } = require('../core/ferramentas');
const { PONTE, escreverAtomico, idSeguro, mascarar } = require('../core/limites');
const { pingProducao } = require('../../config/producaoDb');
const { gerar: gerarSnapshots } = require('./snapshots');
const { version } = require('../../../package.json');

const INBOX = path.join(PONTE, 'inbox');
const FEITOS = path.join(INBOX, 'processados');
const OUTBOX = path.join(PONTE, 'outbox');
[INBOX, FEITOS, OUTBOX].forEach((d) => {
    return fs.mkdirSync(d, { recursive: true });
});

const vistos = new Set();
let fila = Promise.resolve(); // ponytail: um pedido por vez; paralelizar se a fila crescer

async function processar(nome) {
    const abs = path.join(INBOX, nome);
    if (!fs.existsSync(abs)) {
        return;
    }
    let pedido;
    try {
        pedido = JSON.parse(fs.readFileSync(abs, 'utf8').trim()); // trim também remove o BOM do Windows
    } catch (e) {
        if (Date.now() - fs.statSync(abs).mtimeMs < 10000) {
            vistos.delete(nome);
            return;
        } // pode estar sendo gravado
        pedido = { erroLeitura: `JSON inválido: ${e.message}` };
    }
    const id = idSeguro(pedido.id || path.basename(nome, '.json'));
    const params = pedido.params || {};
    const r = pedido.erroLeitura
        ? { ok: false, erro: pedido.erroLeitura }
        : await executar(pedido.ferramenta, params, { canal: 'ponte', id });
    const envelope = {
        id,
        ok: r.ok,
        ferramenta: pedido.ferramenta,
        params,
        gerado_em: new Date().toISOString(),
        ...(r.ok
            ? {
                  dados: r.arquivo ? undefined : r.dados,
                  arquivo: r.arquivo ? r.arquivo.chat : undefined,
              }
            : { erro: r.erro }),
    };
    if (r.ok && params.formato !== 'json') {
        escreverAtomico(path.join(OUTBOX, `${id}.md`), r.texto);
    }
    escreverAtomico(path.join(OUTBOX, `${id}.json`), mascarar(JSON.stringify(envelope, null, 2)));
    const destino = path.join(
        FEITOS,
        fs.existsSync(path.join(FEITOS, nome)) ? `${Date.now()}-${nome}` : nome,
    );
    fs.renameSync(abs, destino);
}

function enfileirar(nome) {
    if (!nome || !/\.json$/i.test(nome) || vistos.has(nome)) {
        return;
    }
    vistos.add(nome);
    fila = fila
        .then(() => {
            return processar(nome);
        })
        .catch((e) => {
            return console.error(`ponte: ${nome}: ${e.message}`);
        })
        .finally(() => {
            if (!fs.existsSync(path.join(INBOX, nome))) {
                vistos.delete(nome);
            }
        });
}

const varrer = () => {
    return fs.readdirSync(INBOX).forEach(enfileirar);
};

async function status() {
    const bancoOk = await db.sequelize.authenticate().then(
        () => {
            return true;
        },
        () => {
            return false;
        },
    );
    escreverAtomico(
        path.join(PONTE, 'status.json'),
        JSON.stringify(
            {
                vivo_em: new Date().toISOString(),
                versao: version,
                banco_ok: bancoOk,
                producao_ok: await pingProducao(),
            },
            null,
            2,
        ),
    );
}

fs.watch(INBOX, (_, nome) => {
    return enfileirar(nome);
});
setInterval(varrer, 3000);
setInterval(() => {
    return status().catch(() => {});
}, 60000);
cron.schedule(
    '0 6 * * *',
    () => {
        return gerarSnapshots()
            .then((r) => {
                return console.error(
                    `snapshots: ${r.feitos.length} gerados, ${r.falhas.length} falhas`,
                );
            })
            .catch((e) => {
                return console.error(`snapshots: ${e.message}`);
            });
    },
    { timezone: 'America/Sao_Paulo' },
);

varrer();
status().catch(() => {});
console.error(`ponte ativa: ${INBOX}`);
