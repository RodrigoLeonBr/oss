/**
 * Carga histórica por GRUPO CANÔNICO (anos em que só há demonstrativo agregado: pareceres 2023/2025).
 *
 * CSV (separador ';', decimal com ponto, cabeçalho obrigatório):
 *   contrato;unidade;conta;mes;tipo;grupo;valor;fonte
 *   009/2023;HMA;custeio;2023-01;repasse;;8123456.78;parecer-anual-2023 §4.4
 * tipo: repasse | rendimento | outras_receitas | despesa | transferencia | recursos_proprios | saldo
 * grupo: só p/ despesa — código de tb_grupo_financeiro (PESSOAL, …) ou vazio = "despesa sem detalhamento".
 *
 * Rubricas históricas: H-<GRUPO>, H-DESPESA, H-OUTRAS (inativas: não aparecem na grade de lançamento);
 * repasse/rendimento entram nas raízes R01/R02 do contrato (criadas se faltarem, p/ Zanaga).
 * Idempotente: apaga o que tiver fonte 'historico:%' na (unidade, conta, mês) antes de gravar.
 * Recusa mês que já tenha lançamento NÃO histórico (carga detalhada prevalece) e mês fechado.
 *
 * Uso: node src/db/carregaHistorico.js <arquivo.csv> [--dry-run]
 */
const fs = require('fs');
const db = require('../models');

const TIPOS = ['repasse', 'rendimento', 'outras_receitas', 'despesa', 'transferencia', 'recursos_proprios', 'saldo'];
const CONTAS = ['custeio', 'investimento', 'provisao'];
const DRY = Symbol('dry');
const cent = (v) => {
    return Math.round(Number(v) * 100);
};

function lerCsv(texto) {
    const [cab, ...linhas] = texto.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => {
        return l.trim() && !l.startsWith('#');
    });
    const cols = cab.split(';').map((c) => {
        return c.trim();
    });
    return linhas.map((l, i) => {
        const o = Object.fromEntries(l.split(';').map((v, j) => {
            return [cols[j], (v || '').trim()];
        }));
        o.linha = i + 2;
        return o;
    });
}

/** Valida e agrupa; devolve erros e o fluxo mensal reconstituído por conta (pura, testável). */
function valida(regs, gruposValidos) {
    const erros = [];
    const fluxo = new Map(); // unidade|conta → mes → {entradas, saidas, mov, saldo}
    for (const r of regs) {
        const e = (m) => {
            erros.push(`linha ${r.linha}: ${m}`);
        };
        if (!TIPOS.includes(r.tipo)) e(`tipo inválido "${r.tipo}"`);
        if (!CONTAS.includes(r.conta)) e(`conta inválida "${r.conta}"`);
        if (!/^\d{4}-\d{2}$/.test(r.mes)) e(`mes deve ser AAAA-MM: "${r.mes}"`);
        if (r.valor === '' || Number.isNaN(Number(r.valor))) e(`valor inválido "${r.valor}"`);
        if (r.grupo && (r.tipo !== 'despesa' || !gruposValidos.has(r.grupo))) e(`grupo inválido "${r.grupo}" p/ ${r.tipo}`);
        const k = `${r.contrato}|${r.unidade}|${r.conta}`;
        if (!fluxo.has(k)) fluxo.set(k, new Map());
        const m = fluxo.get(k);
        if (!m.has(r.mes)) m.set(r.mes, { entradas: 0, saidas: 0, mov: 0, saldo: null });
        const f = m.get(r.mes);
        const v = cent(r.valor);
        if (['repasse', 'rendimento', 'outras_receitas'].includes(r.tipo)) f.entradas += v;
        else if (r.tipo === 'despesa') f.saidas += v;
        else if (r.tipo === 'saldo') f.saldo = v;
        else f.mov += v;
    }
    // saldo anterior + entradas − saídas + movimentações = saldo (só onde há dois saldos seguidos)
    const avisos = [];
    for (const [k, meses] of fluxo) {
        let ant = null;
        for (const mes of [...meses.keys()].sort()) {
            const f = meses.get(mes);
            if (ant != null && f.saldo != null) {
                const dif = ant + f.entradas - f.saidas + f.mov - f.saldo;
                if (dif !== 0) avisos.push(`${k} ${mes}: fluxo não fecha (diferença ${(dif / 100).toFixed(2)})`);
            }
            ant = f.saldo;
        }
    }
    return { erros, avisos };
}

async function carregar(arquivo, { dryRun = false } = {}) {
    const regs = lerCsv(fs.readFileSync(arquivo, 'utf8'));
    const q = (sql, replacements, t) => {
        return db.sequelize.query(sql, { replacements, transaction: t, type: db.Sequelize.QueryTypes.SELECT, logging: false });
    };
    const x = (sql, replacements, t) => {
        return db.sequelize.query(sql, { replacements, transaction: t, logging: false });
    };
    const grupos = new Map((await q('SELECT grupo_financeiro_id, codigo, nome FROM tb_grupo_financeiro')).map((g) => {
        return [g.codigo, g];
    }));
    const { erros, avisos } = valida(regs, new Set(grupos.keys()));
    if (erros.length) throw new Error(`CSV inválido:\n${erros.slice(0, 30).join('\n')}`);

    const resumo = { dryRun, linhas: regs.length, gravados: 0, ignorados: [], avisos };
    try {
        await db.sequelize.transaction(async (t) => {
            const uni = new Map((await q(
                'SELECT u.unidade_id, u.sigla, c.contrato_id, c.numero FROM tb_unidades u JOIN tb_contratos c ON c.contrato_id = u.contrato_id',
                [],
                t,
            )).map((u) => {
                return [`${u.numero}|${u.sigla}`, u];
            }));
            const rub = new Map(); // contrato_id|codigo → rubrica_id
            const rubrica = async (contratoId, codigo, nome, natureza, nivel, grupoId, ativo) => {
                const k = `${contratoId}|${codigo}`;
                if (rub.has(k)) return rub.get(k);
                let [r] = await q('SELECT rubrica_id FROM tb_rubricas WHERE contrato_id = ? AND codigo = ?', [contratoId, codigo], t);
                if (!r) {
                    await x(
                        `INSERT INTO tb_rubricas (rubrica_id, contrato_id, codigo, nome, nivel, natureza, grupo_financeiro_id, ativo)
                         VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)`,
                        [contratoId, codigo, nome, nivel, natureza, grupoId, ativo],
                        t,
                    );
                    [r] = await q('SELECT rubrica_id FROM tb_rubricas WHERE contrato_id = ? AND codigo = ?', [contratoId, codigo], t);
                }
                rub.set(k, r.rubrica_id);
                return r.rubrica_id;
            };

            // célula = unidade|conta|mes: limpa histórico anterior; pula se houver carga detalhada ou mês fechado
            const celulas = new Map();
            for (const r of regs) {
                const u = uni.get(`${r.contrato}|${r.unidade}`);
                if (!u) throw new Error(`linha ${r.linha}: unidade ${r.unidade} não pertence ao contrato ${r.contrato}`);
                const mes = `${r.mes}-01`;
                const ck = `${u.unidade_id}|${r.conta}|${mes}`;
                if (!celulas.has(ck)) {
                    const [det] = await q(
                        `SELECT COUNT(*) n FROM tb_execucao_financeira WHERE unidade_id = ? AND conta = ? AND mes_referencia = ?
                            AND COALESCE(fonte, '') NOT LIKE 'historico:%'`,
                        [u.unidade_id, r.conta, mes],
                        t,
                    );
                    const [fech] = await q(
                        'SELECT COUNT(*) n FROM tb_fechamento_financeiro WHERE contrato_id = ? AND mes_referencia = ?',
                        [u.contrato_id, mes],
                        t,
                    );
                    const pula = Number(det.n) > 0 ? 'já tem carga detalhada' : Number(fech.n) > 0 ? 'mês fechado' : null;
                    if (pula) resumo.ignorados.push(`${r.unidade} ${r.conta} ${r.mes}: ${pula}`);
                    else {
                        const w = [u.unidade_id, r.conta, mes];
                        await x("DELETE FROM tb_execucao_financeira WHERE unidade_id = ? AND conta = ? AND mes_referencia = ? AND fonte LIKE 'historico:%'", w, t);
                        await x("DELETE FROM tb_movimentacao_conta WHERE unidade_id = ? AND conta = ? AND mes_referencia = ? AND fonte LIKE 'historico:%'", w, t);
                    }
                    celulas.set(ck, !pula);
                }
                if (!celulas.get(ck)) continue; // eslint-disable-line no-continue

                const fonte = `historico:${r.fonte || arquivo.split(/[\\/]/).pop()}`.slice(0, 255);
                const v = Number(r.valor);
                const w = [u.unidade_id, r.conta, mes];
                if (r.tipo === 'saldo') {
                    await x(
                        `INSERT INTO tb_saldo_conta (saldo_id, unidade_id, conta, mes_referencia, saldo, fonte) VALUES (UUID(), ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE saldo = VALUES(saldo), fonte = VALUES(fonte)`,
                        [...w, v, fonte],
                        t,
                    );
                } else if (r.tipo === 'transferencia' || r.tipo === 'recursos_proprios') {
                    await x(
                        `INSERT INTO tb_movimentacao_conta (mov_id, unidade_id, conta, mes_referencia, tipo, descricao, valor, fonte)
                         VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)`,
                        [...w, r.tipo, 'Movimentação (histórico)', v, fonte],
                        t,
                    );
                } else {
                    let rid;
                    if (r.tipo === 'repasse') rid = await rubrica(u.contrato_id, 'R01', 'REPASSE', 'receita', 'grupo', null, 1);
                    else if (r.tipo === 'rendimento') rid = await rubrica(u.contrato_id, 'R02', 'FINANCEIRO - RECEITA', 'receita', 'grupo', null, 1);
                    else if (r.tipo === 'outras_receitas') rid = await rubrica(u.contrato_id, 'H-OUTRAS', 'Outras receitas (histórico)', 'receita', 'grupo', null, 0);
                    else if (r.grupo) {
                        const g = grupos.get(r.grupo);
                        rid = await rubrica(u.contrato_id, `H-${r.grupo}`, `${g.nome} (histórico)`, 'despesa', 'grupo', g.grupo_financeiro_id, 0);
                    } else rid = await rubrica(u.contrato_id, 'H-DESPESA', 'Despesa sem detalhamento (histórico)', 'despesa', 'grupo', null, 0);
                    // várias linhas na mesma rubrica/célula somam
                    await x(
                        `INSERT INTO tb_execucao_financeira (exec_id, rubrica_id, unidade_id, conta, mes_referencia, valor_realizado, status_aprovacao, fonte)
                         VALUES (UUID(), ?, ?, ?, ?, ?, 'aprovado', ?)
                         ON DUPLICATE KEY UPDATE valor_realizado = valor_realizado + VALUES(valor_realizado)`,
                        [rid, ...w, v, fonte],
                        t,
                    );
                }
                resumo.gravados++;
            }
            if (dryRun) throw DRY;
        });
    } catch (e) {
        if (e !== DRY) throw e;
    }
    return resumo;
}

if (require.main === module) {
    const arq = process.argv.find((a) => {
        return a.endsWith('.csv');
    });
    if (!arq) {
        // self-check da validação (sem banco)
        const regs = [
            { linha: 2, contrato: 'c', unidade: 'U', conta: 'custeio', mes: '2023-01', tipo: 'saldo', grupo: '', valor: '100' },
            { linha: 3, contrato: 'c', unidade: 'U', conta: 'custeio', mes: '2023-02', tipo: 'repasse', grupo: '', valor: '50' },
            { linha: 4, contrato: 'c', unidade: 'U', conta: 'custeio', mes: '2023-02', tipo: 'despesa', grupo: 'PESSOAL', valor: '30' },
            { linha: 5, contrato: 'c', unidade: 'U', conta: 'custeio', mes: '2023-02', tipo: 'saldo', grupo: '', valor: '120' },
        ];
        const g = new Set(['PESSOAL']);
        console.assert(valida(regs, g).avisos.length === 0, 'fluxo fecha');
        regs[3].valor = '121';
        console.assert(/diferença -1\.00/.test(valida(regs, g).avisos[0]), 'acusa diferença');
        console.assert(valida([{ ...regs[0], tipo: 'x' }], g).erros.length === 1, 'tipo inválido');
        console.log('carregaHistorico: OK');
        db.sequelize.close();
    } else {
        carregar(arq, { dryRun: process.argv.includes('--dry-run') }).then((r) => {
            console.log(`${r.dryRun ? '[dry-run] ' : ''}${r.linhas} linhas, ${r.gravados} gravadas, ${r.ignorados.length} células ignoradas`);
            [...new Set(r.ignorados)].forEach((s) => {
                console.log(`  ignorado: ${s}`);
            });
            r.avisos.forEach((s) => {
                console.log(`  aviso: ${s}`);
            });
        }).catch((e) => {
            console.error(e.message);
            process.exitCode = 1;
        }).finally(() => {
            return db.sequelize.close();
        });
    }
}

module.exports = { carregar, valida, lerCsv };
