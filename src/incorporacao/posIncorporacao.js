#!/usr/bin/env node
// Rotina pós-incorporação. Roda depois de qualquer conversão, carga, importação ou correção
// de dados da prestação. Registra a execução em logs/incorporacao.jsonl e as pendências de
// memória em logs/memoria-pendente.jsonl.
//
// Uso:
//   npm run pos-incorporacao -- --unidade=pa_zanaga --competencia=2026-08 --gatilho=manual --comando="carga de escalas"
//   npm run pos-incorporacao -- --etapa=memoria            (só uma etapa)
//   npm run pos-incorporacao -- --pendentes                (lista pendências de memória)
//   npm run pos-incorporacao -- --concluir=<id>            (fecha a pendência de memória <id>)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ETAPAS, MEMORIA_PENDENTE, LOGS } = require('./etapas');
const { detectar, inferirParametros } = require('./gatilhos');

const LOG = path.join(LOGS, 'incorporacao.jsonl');

function lerArgs(argv) {
    const a = {};
    argv.forEach((s) => {
        const m = s.match(/^--([^=]+)(?:=(.*))?$/);
        if (m) {
            a[m[1]] = m[2] === undefined ? true : m[2];
        }
    });
    return a;
}

function lerJsonl(arq) {
    if (!fs.existsSync(arq)) {
        return [];
    }
    return fs
        .readFileSync(arq, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => {
            try {
                return JSON.parse(l);
            } catch (e) {
                return null;
            }
        })
        .filter(Boolean);
}

function pendenciasMemoria() {
    const linhas = lerJsonl(MEMORIA_PENDENTE);
    const concluidas = new Set(
        linhas
            .filter((l) => {
                return l.status === 'concluida';
            })
            .map((l) => {
                return l.id;
            }),
    );
    return linhas.filter((l) => {
        return l.status === 'pendente' && !concluidas.has(l.id);
    });
}

function concluir(id, obs) {
    const existe = pendenciasMemoria().some((p) => {
        return p.id === id;
    });
    if (!existe) {
        return { ok: false, erro: `pendência ${id} não encontrada ou já concluída` };
    }
    fs.mkdirSync(LOGS, { recursive: true });
    fs.appendFileSync(
        MEMORIA_PENDENTE,
        `${JSON.stringify({
            id,
            status: 'concluida',
            em: new Date().toISOString(),
            obs: obs || null,
        })}\n`,
    );
    return { ok: true, id, restantes: pendenciasMemoria().length };
}

function executar(args) {
    const comando = typeof args.comando === 'string' ? args.comando : null;
    const inferido = comando ? inferirParametros(comando) : {};
    const det = comando ? detectar(comando) : null;
    const ctx = {
        id: `${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}-${crypto
            .randomBytes(3)
            .toString('hex')}`,
        em: new Date().toISOString(),
        gatilho: args.gatilho || 'manual',
        comando,
        tipo: det ? det.tipo : null,
        unidade: args.unidade || inferido.unidade || null,
        competencia: args.competencia || inferido.competencia || null,
    };

    const escolhidas =
        args.etapa && args.etapa !== 'tudo'
            ? ETAPAS.filter((e) => {
                  return String(args.etapa).split(',').includes(e.id);
              })
            : ETAPAS;

    const etapas = escolhidas.map((e) => {
        const t0 = Date.now();
        if (!e.executar) {
            return { id: e.id, fase: e.fase, status: 'nao_implementada', detalhe: e.descricao };
        }
        try {
            const r = e.executar(ctx) || {};
            return {
                id: e.id,
                fase: e.fase,
                status: r.status || 'ok',
                detalhe: r.detalhe || null,
                ms: Date.now() - t0,
            };
        } catch (err) {
            return {
                id: e.id,
                fase: e.fase,
                status: 'erro',
                detalhe: err.message,
                ms: Date.now() - t0,
            };
        }
    });

    const registro = { ...ctx, etapas };
    fs.mkdirSync(LOGS, { recursive: true });
    fs.appendFileSync(LOG, `${JSON.stringify(registro)}\n`);
    return { ...registro, pendencias_memoria: pendenciasMemoria().length };
}

if (require.main === module) {
    const args = lerArgs(process.argv.slice(2));
    let saida;
    if (args.pendentes) {
        saida = { pendencias_memoria: pendenciasMemoria() };
    } else if (typeof args.concluir === 'string') {
        saida = concluir(args.concluir, args.obs);
    } else {
        saida = executar(args);
    }
    process.stdout.write(`${JSON.stringify(saida, null, 2)}\n`);
    if (saida && saida.ok === false) {
        process.exitCode = 1;
    }
}

module.exports = { executar, concluir, pendenciasMemoria, lerArgs };
