// Execução financeira das OSS: painel (resumo/série/comparativo/detalhe), grade de lançamento manual,
// importação (prévia + confirmação), observações/pendências e fechamento de mês.
// Fato base = (unidade, conta, mês): receitas (repasse/rendimento/outras), despesa por grupo, movimentações, saldo.
// Toda agregação é feita em JS sobre os fatos (volume pequeno: ~5 unidades × 3 contas × meses).

/* eslint-disable no-restricted-syntax, no-await-in-loop */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const httpStatus = require('http-status');
const db = require('../models');
const ApiError = require('../helper/ApiError');
const { janelaCivil } = require('../helper/periodoRelatorio');
const { assertContratoNoEscopoOSS, assertUnidadeNoEscopoOSS } = require('../helper/ossScopeHelper');
const { carregar } = require('../db/carregaFinanceiro');

const CONTAS = ['custeio', 'investimento', 'provisao'];
const NIVEIS = ['global', 'oss', 'contrato', 'unidade', 'conta', 'grupo'];
const TMP = path.join(os.tmpdir(), 'oss-financeiro');
const PYTHON = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
const EXTRATOR = path.join(__dirname, '..', 'db', 'extraiFinanceiro.py');

const q = (sql, replacements, transaction) => {
    return db.sequelize.query(sql, { replacements, transaction, type: db.Sequelize.QueryTypes.SELECT, logging: false });
};
const exec = (sql, replacements, transaction) => {
    return db.sequelize.query(sql, { replacements, transaction, logging: false });
};
const cent = (v) => {
    return Math.round(Number(v || 0) * 100);
};
const reais = (c) => {
    return Math.round(c) / 100;
};
const mesAnterior = (ymd) => {
    const [y, m] = ymd.split('-').map(Number);
    return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`;
};

// ───────────────────────── fatos ─────────────────────────

/** WHERE de escopo sobre aliases u (unidade), c (contrato). */
function whereEscopo({ ossId, contratoId, unidadeId, conta }, ossIdFiltro, aliasConta) {
    const w = ['1=1'];
    const r = [];
    if (ossIdFiltro) {
        w.push('c.oss_id = ?');
        r.push(ossIdFiltro);
    }
    if (ossId) {
        w.push('c.oss_id = ?');
        r.push(ossId);
    }
    if (contratoId) {
        w.push('c.contrato_id = ?');
        r.push(contratoId);
    }
    if (unidadeId) {
        w.push('u.unidade_id = ?');
        r.push(unidadeId);
    }
    if (conta) {
        w.push(`${aliasConta}.conta = ?`);
        r.push(conta);
    }
    return { sql: w.join(' AND '), r };
}

/**
 * Fatos mensais por (unidade, conta) entre ini e fim, mais o saldo do mês anterior a ini.
 * @returns {Promise<Array<{oss_id,oss_nome,contrato_id,contrato,unidade_id,sigla,conta,mes,
 *   repasse,rendimento,outrasReceitas,despesa,grupos:Object<string,number>,transferencia,proprios,arredondamento,saldo}>>}
 *   valores em centavos; saldo = null quando não informado.
 */
async function fatos(escopo, ini, fim, ossIdFiltro) {
    const base = `JOIN tb_unidades u ON u.unidade_id = x.unidade_id
                  JOIN tb_contratos c ON c.contrato_id = u.contrato_id
                  JOIN tb_oss o ON o.oss_id = c.oss_id`;
    const cols = `o.oss_id, o.nome AS oss_nome, c.contrato_id, c.numero AS contrato, u.unidade_id, u.sigla,
                  x.conta, DATE_FORMAT(x.mes_referencia, '%Y-%m-%d') AS mes`;
    const we = whereEscopo(escopo, ossIdFiltro, 'x');
    const ant = mesAnterior(ini);

    // categoria → raiz do plano (pai ou ela mesma) → grupo canônico (próprio ou do pai)
    const execs = await q(
        `SELECT ${cols}, r.natureza, COALESCE(rp.codigo, r.codigo) AS raiz, COALESCE(rp.nome, r.nome) AS raiz_nome,
                gf.codigo AS gcod, gf.nome AS gnome, SUM(x.valor_realizado) AS valor
           FROM tb_execucao_financeira x
           JOIN tb_rubricas r ON r.rubrica_id = x.rubrica_id
           LEFT JOIN tb_rubricas rp ON rp.rubrica_id = r.rubrica_pai_id
           LEFT JOIN tb_grupo_financeiro gf ON gf.grupo_financeiro_id = COALESCE(r.grupo_financeiro_id, rp.grupo_financeiro_id)
           ${base}
          WHERE ${we.sql} AND x.mes_referencia BETWEEN ? AND ?
          GROUP BY o.oss_id, c.contrato_id, u.unidade_id, x.conta, x.mes_referencia, r.natureza, raiz, raiz_nome, gcod, gnome`,
        [...we.r, ini, fim],
    );
    const movs = await q(
        `SELECT ${cols}, x.tipo, SUM(x.valor) AS valor FROM tb_movimentacao_conta x ${base}
          WHERE ${we.sql} AND x.mes_referencia BETWEEN ? AND ?
          GROUP BY o.oss_id, c.contrato_id, u.unidade_id, x.conta, x.mes_referencia, x.tipo`,
        [...we.r, ini, fim],
    );
    const saldos = await q(
        `SELECT ${cols}, x.saldo AS valor FROM tb_saldo_conta x ${base}
          WHERE ${we.sql} AND x.mes_referencia BETWEEN ? AND ?`,
        [...we.r, ant, fim],
    );

    const mapa = new Map();
    const fato = (l) => {
        const k = `${l.unidade_id}|${l.conta}|${l.mes}`;
        if (!mapa.has(k)) {
            mapa.set(k, {
                oss_id: l.oss_id,
                oss_nome: l.oss_nome,
                contrato_id: l.contrato_id,
                contrato: l.contrato,
                unidade_id: l.unidade_id,
                sigla: l.sigla,
                conta: l.conta,
                mes: l.mes,
                repasse: 0,
                rendimento: 0,
                outrasReceitas: 0,
                despesa: 0,
                grupos: {},
                transferencia: 0,
                proprios: 0,
                arredondamento: 0,
                saldo: null,
            });
        }
        return mapa.get(k);
    };
    execs.forEach((l) => {
        const f = fato(l);
        const v = cent(l.valor);
        if (l.natureza === 'receita') {
            if (l.raiz === 'R01') f.repasse += v;
            else if (l.raiz === 'R02') f.rendimento += v;
            else f.outrasReceitas += v;
        } else {
            f.despesa += v;
            // sem grupo canônico ainda: cai no grupo do plano original (prefixo "plano:")
            const g = l.gcod ? `${l.gcod}|${l.gnome}` : `plano:${l.raiz}|${l.raiz_nome}`;
            f.grupos[g] = (f.grupos[g] || 0) + v;
        }
    });
    const TIPO = { transferencia: 'transferencia', recursos_proprios: 'proprios', arredondamento: 'arredondamento' };
    movs.forEach((l) => {
        fato(l)[TIPO[l.tipo]] += cent(l.valor);
    });
    saldos.forEach((l) => {
        fato(l).saldo = cent(l.valor);
    });
    return [...mapa.values()];
}

// ───────────────────────── agregação (pura) ─────────────────────────

const chaveNivel = {
    global: () => {
        return ['global', 'Global'];
    },
    oss: (f) => {
        return [f.oss_id, f.oss_nome];
    },
    contrato: (f) => {
        return [f.contrato_id, f.contrato];
    },
    unidade: (f) => {
        return [f.unidade_id, f.sigla];
    },
    conta: (f) => {
        return [`${f.unidade_id}|${f.conta}`, `${f.sigla} ${f.conta}`];
    },
};

/**
 * KPIs de um conjunto de fatos numa janela [ini, fim]. Saldo inicial = saldo do mês anterior a ini;
 * saldo final = último saldo informado ≤ fim, por conta. Valores em reais.
 */
function kpis(lista, ini, fim) {
    const ant = mesAnterior(ini);
    const noPeriodo = lista.filter((f) => {
        return f.mes >= ini && f.mes <= fim;
    });
    const soma = (campo) => {
        return noPeriodo.reduce((s, f) => {
            return s + f[campo];
        }, 0);
    };
    let saldoInicial = 0;
    let saldoFinal = 0;
    let temInicial = false;
    let temFinal = false;
    const porConta = new Map();
    lista.forEach((f) => {
        const k = `${f.unidade_id}|${f.conta}`;
        if (!porConta.has(k)) porConta.set(k, []);
        porConta.get(k).push(f);
    });
    porConta.forEach((fs2) => {
        const ini0 = fs2.find((f) => {
            return f.mes === ant && f.saldo != null;
        });
        if (ini0) {
            saldoInicial += ini0.saldo;
            temInicial = true;
        }
        const ult = fs2
            .filter((f) => {
                return f.mes >= ini && f.mes <= fim && f.saldo != null;
            })
            .sort((a, b) => {
                return a.mes < b.mes ? 1 : -1;
            })[0];
        if (ult) {
            saldoFinal += ult.saldo;
            temFinal = true;
        }
    });
    const grupos = {};
    noPeriodo.forEach((f) => {
        Object.entries(f.grupos).forEach(([g, v]) => {
            grupos[g] = (grupos[g] || 0) + v;
        });
    });
    const despesa = soma('despesa');
    const repasse = soma('repasse');
    const meses = new Set(noPeriodo.map((f) => {
        return f.mes;
    })).size;
    const fluxo = repasse + soma('rendimento') + soma('outrasReceitas') - despesa
        + soma('transferencia') + soma('proprios') + soma('arredondamento');
    return {
        saldoInicial: temInicial ? reais(saldoInicial) : null,
        repasse: reais(repasse),
        rendimento: reais(soma('rendimento')),
        outrasReceitas: reais(soma('outrasReceitas')),
        despesa: reais(despesa),
        transferencias: reais(soma('transferencia')),
        recursosProprios: reais(soma('proprios')),
        arredondamento: reais(soma('arredondamento')),
        saldoFinal: temFinal ? reais(saldoFinal) : null,
        // fluxo do período: inicial + entradas − despesa ± movimentações; ≠ 0 indica mês sem saldo ou dado faltando
        diferencaFluxo: temInicial && temFinal ? reais(saldoInicial + fluxo - saldoFinal) : null,
        mesesComDados: meses,
        coberturaMeses: temFinal && repasse > 0 && meses ? Math.round((saldoFinal / (repasse / meses)) * 10) / 10 : null,
        despesaPorGrupo: Object.entries(grupos)
            .map(([g, v]) => {
                const [codigo, nome] = g.split('|');
                return { codigo, nome, valor: reais(v), perc: despesa ? Math.round((v / despesa) * 1000) / 10 : 0 };
            })
            .sort((a, b) => {
                return b.valor - a.valor;
            }),
    };
}

/** Δ% entre dois números (null se base 0/nula). */
function delta(atual, anterior) {
    if (atual == null || !anterior) return null;
    return Math.round(((atual - anterior) / Math.abs(anterior)) * 1000) / 10;
}

/** Chave do bucket de um mês 'YYYY-MM-01' na granularidade. */
function bucket(mes, gran) {
    const [y, m] = mes.split('-').map(Number);
    if (gran === 'mes') return mes.slice(0, 7);
    if (gran === 'trim') return `${y}-T${Math.ceil(m / 3)}`;
    if (gran === 'quad') return `${y}-Q${Math.ceil(m / 4)}`;
    return String(y);
}

/** Série por bucket: fluxos somados; saldo = soma do último saldo de cada conta dentro do bucket. */
function serieAgregada(lista, gran) {
    const porBucket = new Map();
    lista.forEach((f) => {
        const b = bucket(f.mes, gran);
        if (!porBucket.has(b)) porBucket.set(b, []);
        porBucket.get(b).push(f);
    });
    return [...porBucket.keys()].sort().map((b) => {
        const fs2 = porBucket.get(b);
        const meses = fs2.map((f) => {
            return f.mes;
        }).sort();
        const k = kpis(fs2, meses[0], meses[meses.length - 1]);
        return {
            periodo: b,
            repasse: k.repasse,
            rendimento: k.rendimento,
            despesa: k.despesa,
            saldo: k.saldoFinal,
            despesaPorGrupo: k.despesaPorGrupo,
        };
    });
}

// ───────────────────────── painel ─────────────────────────

function nivelDoEscopo(e) {
    if (e.conta) return 'conta';
    if (e.unidadeId) return 'unidade';
    if (e.contratoId) return 'contrato';
    if (e.ossId) return 'oss';
    return 'global';
}

async function validaEscopo(e, ossIdFiltro) {
    await assertContratoNoEscopoOSS(e.contratoId, ossIdFiltro);
    await assertUnidadeNoEscopoOSS(e.unidadeId, ossIdFiltro);
}

/** Resumo do escopo na janela + período anterior + linhas de drill (nível abaixo). */
async function resumo(e, ossIdFiltro) {
    await validaEscopo(e, ossIdFiltro);
    const j = janelaCivil(e.periodo);
    const lista = await fatos(e, mesAnterior(j.anterior.inicio), j.fim, ossIdFiltro);
    const atual = kpis(lista, j.inicio, j.fim);
    const anterior = kpis(lista, j.anterior.inicio, j.anterior.fim);
    const nivel = nivelDoEscopo(e);
    const filho = NIVEIS[NIVEIS.indexOf(nivel) + 1];
    let drill;
    if (filho === 'grupo') {
        drill = atual.despesaPorGrupo.map((g) => {
            return { id: g.codigo, nome: g.nome, nivel: 'grupo', despesa: g.valor, perc: g.perc };
        });
    } else {
        const grupos = new Map();
        lista.forEach((f) => {
            const [id, nome] = chaveNivel[filho](f);
            if (!grupos.has(id)) grupos.set(id, { id, nome, fs: [] });
            grupos.get(id).fs.push(f);
        });
        drill = [...grupos.values()]
            .map((g) => {
                const k = kpis(g.fs, j.inicio, j.fim);
                const ka = kpis(g.fs, j.anterior.inicio, j.anterior.fim);
                return { id: g.id, nome: g.nome, nivel: filho, ...k, deltaDespesa: delta(k.despesa, ka.despesa) };
            })
            .sort((a, b) => {
                return String(a.nome).localeCompare(String(b.nome));
            });
    }
    const pendencias = await listarObservacoes(
        { contratoId: e.contratoId, tipo: 'pendencia', status: 'aberta' },
        ossIdFiltro,
    );
    return {
        janela: j,
        nivel,
        atual,
        anterior,
        variacao: {
            repasse: delta(atual.repasse, anterior.repasse),
            despesa: delta(atual.despesa, anterior.despesa),
            saldoFinal: delta(atual.saldoFinal, anterior.saldoFinal),
        },
        drill,
        pendencias,
    };
}

/** Série longa (multi-anos) + marcos (início de contrato no escopo). */
async function serie(e, ossIdFiltro) {
    await validaEscopo(e, ossIdFiltro);
    const ini = `${e.ini}-01`;
    const fim = `${e.fim}-01`;
    const lista = await fatos(e, ini, fim, ossIdFiltro);
    const pontos = serieAgregada(
        lista.filter((f) => {
            return f.mes >= ini;
        }),
        e.granularidade,
    );
    const we = whereEscopo({ ...e, conta: null }, ossIdFiltro);
    const marcos = await q(
        `SELECT DISTINCT DATE_FORMAT(c.data_inicio, '%Y-%m-01') AS mes, CONCAT('Contrato ', c.numero) AS rotulo
           FROM tb_contratos c JOIN tb_unidades u ON u.contrato_id = c.contrato_id
          WHERE ${we.sql} AND c.data_inicio BETWEEN ? AND ? ORDER BY mes`,
        [...we.r, ini, fim],
    );
    return { granularidade: e.granularidade, pontos, marcos };
}

/** Mesmo período civil (ex.: 2º quadrimestre) em vários anos. */
async function comparativo(e, ossIdFiltro) {
    await validaEscopo(e, ossIdFiltro);
    const anos = [...e.anos].sort();
    const janelas = anos.map((ano) => {
        return janelaCivil({ tipo: e.tipo, ano, n: e.n });
    });
    const lista = await fatos(e, mesAnterior(janelas[0].inicio), janelas[janelas.length - 1].fim, ossIdFiltro);
    return {
        tipo: e.tipo,
        n: e.n,
        anos: janelas.map((j, i) => {
            const k = kpis(lista, j.inicio, j.fim);
            const mensal = serieAgregada(
                lista.filter((f) => {
                    return f.mes >= j.inicio && f.mes <= j.fim;
                }),
                'mes',
            );
            const prev = i ? kpis(lista, janelas[i - 1].inicio, janelas[i - 1].fim) : null;
            return {
                ano: anos[i],
                rotulo: j.rotulo,
                ...k,
                deltaDespesa: prev ? delta(k.despesa, prev.despesa) : null,
                deltaRepasse: prev ? delta(k.repasse, prev.repasse) : null,
                mensal,
            };
        }),
    };
}

/** Rubrica × mês no plano original do contrato (escopo precisa ter contrato ou unidade). */
async function detalhe(e, ossIdFiltro) {
    await validaEscopo(e, ossIdFiltro);
    let { contratoId } = e;
    if (!contratoId && e.unidadeId) {
        const [u] = await q('SELECT contrato_id FROM tb_unidades WHERE unidade_id = ?', [e.unidadeId]);
        contratoId = u && u.contrato_id;
    }
    if (!contratoId) throw new ApiError(httpStatus.BAD_REQUEST, 'detalhe exige contrato ou unidade');
    const j = janelaCivil(e.periodo);
    const we = whereEscopo({ ...e, contratoId }, ossIdFiltro, 'x');
    const rubricas = await q(
        `SELECT r.rubrica_id, r.codigo, r.nome, r.nivel, r.natureza, r.ativo, rp.codigo AS pai, gf.nome AS grupo_canonico
           FROM tb_rubricas r LEFT JOIN tb_rubricas rp ON rp.rubrica_id = r.rubrica_pai_id
           LEFT JOIN tb_grupo_financeiro gf ON gf.grupo_financeiro_id = COALESCE(r.grupo_financeiro_id, rp.grupo_financeiro_id)
          WHERE r.contrato_id = ? ORDER BY r.natureza DESC, r.codigo`,
        [contratoId],
    );
    const valores = await q(
        `SELECT x.rubrica_id, DATE_FORMAT(x.mes_referencia, '%Y-%m-%d') AS mes, SUM(x.valor_realizado) AS valor
           FROM tb_execucao_financeira x JOIN tb_unidades u ON u.unidade_id = x.unidade_id
           JOIN tb_contratos c ON c.contrato_id = u.contrato_id
          WHERE ${we.sql} AND x.mes_referencia BETWEEN ? AND ?
          GROUP BY x.rubrica_id, x.mes_referencia`,
        [...we.r, j.inicio, j.fim],
    );
    const meses = [];
    for (let m = j.inicio; m <= j.fim; m = (() => {
        const [y, mm] = m.split('-').map(Number);
        return mm === 12 ? `${y + 1}-01-01` : `${y}-${String(mm + 1).padStart(2, '0')}-01`;
    })()) meses.push(m);
    const porRubrica = new Map();
    valores.forEach((v) => {
        if (!porRubrica.has(v.rubrica_id)) porRubrica.set(v.rubrica_id, {});
        porRubrica.get(v.rubrica_id)[v.mes] = cent(v.valor);
    });
    // grupos do plano = soma das categorias filhas
    const filhas = new Map();
    rubricas.forEach((r) => {
        if (r.pai) {
            if (!filhas.has(r.pai)) filhas.set(r.pai, []);
            filhas.get(r.pai).push(r.rubrica_id);
        }
    });
    const linhas = rubricas.map((r) => {
        // grupo = valores lançados nele (histórico por grupo) + categorias filhas
        const ids = r.nivel === 'grupo' ? [r.rubrica_id, ...(filhas.get(r.codigo) || [])] : [r.rubrica_id];
        const vals = meses.map((m) => {
            return reais(ids.reduce((s, id) => {
                return s + ((porRubrica.get(id) || {})[m] || 0);
            }, 0));
        });
        return {
            ...r,
            valores: vals,
            total: Math.round(vals.reduce((s, v) => {
                return s + v;
            }, 0) * 100) / 100,
        };
    });
    const observacoes = await listarObservacoes({ contratoId, ini: j.inicio, fim: j.fim }, ossIdFiltro);
    // plano inativo (histórico) só aparece onde tem valor no período
    const visiveis = linhas.filter((l) => {
        return l.ativo || l.valores.some((v) => {
            return v !== 0;
        });
    });
    return { janela: j, contrato_id: contratoId, meses, linhas: visiveis, observacoes };
}

// ───────────────────────── grade (lançamento manual) ─────────────────────────

async function assertMesAberto(contratoId, meses, transaction) {
    const f = await q(
        `SELECT DATE_FORMAT(mes_referencia, '%Y-%m-%d') AS mes FROM tb_fechamento_financeiro
          WHERE contrato_id = ? AND mes_referencia IN (?)`,
        [contratoId, meses],
        transaction,
    );
    if (f.length) {
        throw new ApiError(httpStatus.CONFLICT, `Mês fechado: ${f.map((x) => {
            return x.mes;
        }).join(', ')}. Reabertura só pelo admin.`);
    }
}

async function unidadeDoContrato(unidadeId, ossIdFiltro) {
    await assertUnidadeNoEscopoOSS(unidadeId, ossIdFiltro);
    const [u] = await q('SELECT unidade_id, contrato_id, sigla FROM tb_unidades WHERE unidade_id = ?', [unidadeId]);
    if (!u) throw new ApiError(httpStatus.NOT_FOUND, 'Unidade não encontrada');
    return u;
}

/** Avisos (não bloqueiam): saldo não reconcilia com anterior + entradas − despesas ± movimentações. */
function avisosGrade({ saldoAnterior, receitas, despesas, movimentos, saldo }) {
    const avisos = [];
    if (saldo == null) {
        avisos.push('Saldo do mês não informado.');
        return avisos;
    }
    if (saldoAnterior == null) {
        avisos.push('Saldo do mês anterior não informado: reconciliação não verificada.');
        return avisos;
    }
    const esperado = cent(saldoAnterior) + cent(receitas) - cent(despesas) + cent(movimentos);
    const dif = cent(saldo) - esperado;
    if (Math.abs(dif) > 10) {
        avisos.push(`Saldo informado ${saldo} ≠ calculado ${reais(esperado)} (diferença ${reais(dif)}).`);
    }
    return avisos;
}

async function grade({ unidadeId, conta, mes }, ossIdFiltro) {
    const u = await unidadeDoContrato(unidadeId, ossIdFiltro);
    const rubricas = await q(
        `SELECT r.rubrica_id, r.codigo, r.nome, r.nivel, r.natureza, rp.codigo AS pai, x.valor_realizado AS valor
           FROM tb_rubricas r LEFT JOIN tb_rubricas rp ON rp.rubrica_id = r.rubrica_pai_id
           LEFT JOIN tb_execucao_financeira x ON x.rubrica_id = r.rubrica_id AND x.unidade_id = ? AND x.conta = ? AND x.mes_referencia = ?
          WHERE r.contrato_id = ? AND r.ativo = 1 ORDER BY r.natureza DESC, r.codigo`,
        [unidadeId, conta, mes, u.contrato_id],
    );
    const movimentos = await q(
        `SELECT mov_id, tipo, contraparte_unidade_id, contraparte_conta, descricao, valor
           FROM tb_movimentacao_conta WHERE unidade_id = ? AND conta = ? AND mes_referencia = ? ORDER BY descricao`,
        [unidadeId, conta, mes],
    );
    const saldos = await q(
        `SELECT DATE_FORMAT(mes_referencia, '%Y-%m-%d') AS mes, saldo FROM tb_saldo_conta
          WHERE unidade_id = ? AND conta = ? AND mes_referencia IN (?, ?)`,
        [unidadeId, conta, mesAnterior(mes), mes],
    );
    const sal = (m) => {
        const s = saldos.find((x) => {
            return x.mes === m;
        });
        return s ? Number(s.saldo) : null;
    };
    const fechado = await q(
        'SELECT 1 FROM tb_fechamento_financeiro WHERE contrato_id = ? AND mes_referencia = ?',
        [u.contrato_id, mes],
    );
    const soma = (nat) => {
        return reais(rubricas.filter((r) => {
            return r.nivel === 'categoria' && r.natureza === nat;
        }).reduce((s, r) => {
            return s + cent(r.valor);
        }, 0));
    };
    const totalMov = reais(movimentos.reduce((s, m) => {
        return s + cent(m.valor);
    }, 0));
    const res = {
        unidade_id: unidadeId,
        sigla: u.sigla,
        contrato_id: u.contrato_id,
        conta,
        mes,
        fechado: fechado.length > 0,
        rubricas: rubricas.map((r) => {
            return { ...r, valor: r.valor == null ? null : Number(r.valor) };
        }),
        movimentos: movimentos.map((m) => {
            return { ...m, valor: Number(m.valor) };
        }),
        saldoAnterior: sal(mesAnterior(mes)),
        saldo: sal(mes),
        totais: { receitas: soma('receita'), despesas: soma('despesa'), movimentos: totalMov },
    };
    res.avisos = avisosGrade({
        saldoAnterior: res.saldoAnterior,
        receitas: res.totais.receitas,
        despesas: res.totais.despesas,
        movimentos: totalMov,
        saldo: res.saldo,
    });
    return res;
}

/**
 * Grava a grade: valores por rubrica (categoria), movimentações e saldo. Recusa mês fechado.
 * Só toca o que mudou — linha inalterada mantém a `fonte` (proveniência da importação).
 */
async function salvarGrade({ unidadeId, conta, mes, valores, movimentos, saldo }, usuarioId, ossIdFiltro) {
    const u = await unidadeDoContrato(unidadeId, ossIdFiltro);
    const fonte = `manual:${usuarioId || '?'}`;
    const onde = [unidadeId, conta, mes];
    await db.sequelize.transaction(async (t) => {
        await assertMesAberto(u.contrato_id, [mes], t);
        const validas = await q(
            "SELECT rubrica_id FROM tb_rubricas WHERE contrato_id = ? AND nivel = 'categoria'",
            [u.contrato_id],
            t,
        );
        const ok = new Set(validas.map((r) => {
            return r.rubrica_id;
        }));
        const atuais = new Map((await q(
            'SELECT rubrica_id, valor_realizado FROM tb_execucao_financeira WHERE unidade_id = ? AND conta = ? AND mes_referencia = ?',
            onde,
            t,
        )).map((r) => {
            return [r.rubrica_id, cent(r.valor_realizado)];
        }));
        for (const { rubrica_id: rid, valor } of valores) {
            if (!ok.has(rid)) throw new ApiError(httpStatus.BAD_REQUEST, `Rubrica ${rid} não é categoria do contrato`);
            const novo = valor == null ? 0 : cent(valor);
            if (novo === (atuais.get(rid) ?? 0)) continue; // eslint-disable-line no-continue
            if (novo === 0) {
                await exec(
                    'DELETE FROM tb_execucao_financeira WHERE rubrica_id = ? AND unidade_id = ? AND conta = ? AND mes_referencia = ?',
                    [rid, ...onde],
                    t,
                );
            } else {
                await exec(
                    `INSERT INTO tb_execucao_financeira (rubrica_id, unidade_id, conta, mes_referencia, valor_realizado, status_aprovacao, fonte)
                     VALUES (?, ?, ?, ?, ?, 'aprovado', ?)
                     ON DUPLICATE KEY UPDATE valor_realizado = VALUES(valor_realizado), fonte = VALUES(fonte)`,
                    [rid, ...onde, valor, fonte],
                    t,
                );
            }
        }
        if (movimentos) {
            const chave = (m) => {
                return [m.tipo, m.contraparte_unidade_id || '', m.contraparte_conta || '', m.descricao, cent(m.valor)].join('|');
            };
            const antes = await q(
                `SELECT tipo, contraparte_unidade_id, contraparte_conta, descricao, valor FROM tb_movimentacao_conta
                  WHERE unidade_id = ? AND conta = ? AND mes_referencia = ?`,
                onde,
                t,
            );
            const novos = movimentos.filter((x) => {
                return cent(x.valor) !== 0;
            });
            const igual = antes.map(chave).sort().join(';') === novos.map(chave).sort().join(';');
            if (!igual) {
                await exec('DELETE FROM tb_movimentacao_conta WHERE unidade_id = ? AND conta = ? AND mes_referencia = ?', onde, t);
                for (const m of novos) {
                    await exec(
                        `INSERT INTO tb_movimentacao_conta (unidade_id, conta, mes_referencia, tipo, contraparte_unidade_id,
                           contraparte_conta, descricao, valor, fonte) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [...onde, m.tipo, m.contraparte_unidade_id || null, m.contraparte_conta || null, m.descricao, m.valor, fonte],
                        t,
                    );
                }
            }
        }
        if (saldo !== undefined) {
            const [atual] = await q(
                'SELECT saldo FROM tb_saldo_conta WHERE unidade_id = ? AND conta = ? AND mes_referencia = ?',
                onde,
                t,
            );
            if (saldo === null) {
                if (atual) await exec('DELETE FROM tb_saldo_conta WHERE unidade_id = ? AND conta = ? AND mes_referencia = ?', onde, t);
            } else if (!atual || cent(atual.saldo) !== cent(saldo)) {
                await exec(
                    `INSERT INTO tb_saldo_conta (unidade_id, conta, mes_referencia, saldo, fonte) VALUES (?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE saldo = VALUES(saldo), fonte = VALUES(fonte)`,
                    [...onde, saldo, fonte],
                    t,
                );
            }
        }
    });
    return grade({ unidadeId, conta, mes }, ossIdFiltro);
}

// ───────────────────────── importação ─────────────────────────

const execFileP = promisify(execFile);

const dirLote = (token) => {
    if (!/^[0-9a-f-]{36}$/.test(String(token))) throw new ApiError(httpStatus.BAD_REQUEST, 'token inválido');
    const dir = path.join(TMP, token);
    if (!fs.existsSync(path.join(dir, 'lote.json'))) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Lote expirado: envie os arquivos de novo');
    }
    return { dir, lote: JSON.parse(fs.readFileSync(path.join(dir, 'lote.json'), 'utf8')) };
};

/** Guarda um arquivo (.xlsx/.pdf) no lote. Sem token = lote novo. Todas as contas do período vão no mesmo lote. */
async function receberArquivo({ contratoId, token, nome, buffer }, ossIdFiltro) {
    let dir;
    let lote;
    if (token) {
        ({ dir, lote } = dirLote(token));
        if (lote.contratoId !== contratoId) throw new ApiError(httpStatus.BAD_REQUEST, 'lote é de outro contrato');
    } else {
        await assertContratoNoEscopoOSS(contratoId, ossIdFiltro);
        const [c] = await q('SELECT numero FROM tb_contratos WHERE contrato_id = ?', [contratoId]);
        if (!c) throw new ApiError(httpStatus.NOT_FOUND, 'Contrato não encontrado');
        token = crypto.randomUUID(); // eslint-disable-line no-param-reassign
        dir = path.join(TMP, token);
        fs.mkdirSync(dir, { recursive: true });
        lote = { contrato: c.numero, contratoId, arquivos: [] };
    }
    const limpo = path.basename(String(nome)).replace(/[^\w.\- ()°ºçãõáéíóúâêôÇÃÕÁÉÍÓÚ]/g, '_');
    if (!/\.(xlsx|pdf)$/i.test(limpo)) throw new ApiError(httpStatus.BAD_REQUEST, `${limpo}: só .xlsx ou .pdf`);
    if (!buffer || !buffer.length) throw new ApiError(httpStatus.BAD_REQUEST, 'arquivo vazio');
    fs.writeFileSync(path.join(dir, limpo), buffer);
    if (!lote.arquivos.includes(limpo)) lote.arquivos.push(limpo);
    fs.writeFileSync(path.join(dir, 'lote.json'), JSON.stringify(lote));
    return { token, contrato: lote.contrato, arquivos: lote.arquivos };
}

async function jsonsDoLote(dir, lote) {
    const jsons = [];
    for (const nome of lote.arquivos) {
        const arq = path.join(dir, nome);
        const saida = arq.replace(/\.(xlsx|pdf)$/i, '.financeiro.json');
        if (!fs.existsSync(saida)) {
            try {
                await execFileP(PYTHON, [EXTRATOR, arq], { timeout: 180000 });
            } catch (e) {
                throw new ApiError(httpStatus.UNPROCESSABLE_ENTITY,
                    `${nome}: extração falhou — ${String(e.stderr || e.message).slice(-400)}`);
            }
        }
        jsons.push(JSON.parse(fs.readFileSync(saida, 'utf8')));
    }
    return jsons;
}

/** Extrai (Python atual) e roda a carga em dry-run: validações + diferenças contra o banco. */
async function previaImportacao({ token }, ossIdFiltro) {
    const { dir, lote } = dirLote(token);
    await assertContratoNoEscopoOSS(lote.contratoId, ossIdFiltro);
    const jsons = await jsonsDoLote(dir, lote);
    try {
        return { token, arquivos: lote.arquivos, ...(await carregar(lote.contrato, jsons, { dryRun: true })) };
    } catch (e) {
        if (e instanceof ApiError) throw e;
        throw new ApiError(httpStatus.UNPROCESSABLE_ENTITY, e.message);
    }
}

async function confirmarImportacao({ token }, ossIdFiltro) {
    const { dir, lote } = dirLote(token);
    await assertContratoNoEscopoOSS(lote.contratoId, ossIdFiltro);
    const jsons = await jsonsDoLote(dir, lote);
    let r;
    try {
        r = await carregar(lote.contrato, jsons);
    } catch (e) {
        throw new ApiError(httpStatus.UNPROCESSABLE_ENTITY, e.message);
    }
    fs.rmSync(dir, { recursive: true, force: true });
    return { arquivos: lote.arquivos, ...r };
}

// ───────────────────────── observações e fechamento ─────────────────────────

async function listarObservacoes(f, ossIdFiltro) {
    const w = ['o.deletado_em IS NULL'];
    const r = [];
    if (ossIdFiltro) {
        w.push('c.oss_id = ?');
        r.push(ossIdFiltro);
    }
    const add = (cond, v) => {
        if (v != null && v !== '') {
            w.push(cond);
            r.push(v);
        }
    };
    add('o.contrato_id = ?', f.contratoId);
    add('o.unidade_id = ?', f.unidadeId);
    add('o.tipo = ?', f.tipo);
    add('o.status = ?', f.status);
    add('o.secao = ?', f.secao);
    if (f.ini && f.fim) {
        w.push(`(o.tipo = 'pendencia' AND o.status = 'aberta'
              OR o.mes_referencia BETWEEN ? AND ?
              OR (o.periodo_ini <= ? AND o.periodo_fim >= ?))`);
        r.push(f.ini, f.fim, f.fim, f.ini);
    }
    return q(
        `SELECT o.obs_id, o.contrato_id, c.numero AS contrato, o.tipo, o.unidade_id, u.sigla, o.conta,
                DATE_FORMAT(o.mes_referencia, '%Y-%m-%d') AS mes_referencia,
                DATE_FORMAT(o.periodo_ini, '%Y-%m-%d') AS periodo_ini, DATE_FORMAT(o.periodo_fim, '%Y-%m-%d') AS periodo_fim,
                o.secao, o.texto, o.status, o.resolvida_em, o.origem, o.fonte, o.criado_em, o.atualizado_em
           FROM tb_observacao_financeira o JOIN tb_contratos c ON c.contrato_id = o.contrato_id
           LEFT JOIN tb_unidades u ON u.unidade_id = o.unidade_id
          WHERE ${w.join(' AND ')}
          ORDER BY o.tipo, COALESCE(o.mes_referencia, o.periodo_ini) DESC, o.criado_em DESC`,
        r,
    );
}

const CAMPOS_OBS = ['contrato_id', 'tipo', 'unidade_id', 'conta', 'mes_referencia', 'periodo_ini', 'periodo_fim',
    'secao', 'texto', 'status'];

async function criarObservacao(v, usuarioId, ossIdFiltro) {
    await assertContratoNoEscopoOSS(v.contrato_id, ossIdFiltro);
    const id = crypto.randomUUID();
    const dados = { ...v, status: v.tipo === 'pendencia' ? v.status || 'aberta' : null };
    await exec(
        `INSERT INTO tb_observacao_financeira (obs_id, ${CAMPOS_OBS.join(', ')}, criado_por)
         VALUES (?, ${CAMPOS_OBS.map(() => {
        return '?';
    }).join(', ')}, ?)`,
        [id, ...CAMPOS_OBS.map((k) => {
            return dados[k] ?? null;
        }), usuarioId || null],
    );
    return id;
}

async function obsNoEscopo(id, ossIdFiltro) {
    const [o] = await q(
        `SELECT o.obs_id, o.contrato_id, o.status FROM tb_observacao_financeira o
          WHERE o.obs_id = ? AND o.deletado_em IS NULL`,
        [id],
    );
    if (!o) throw new ApiError(httpStatus.NOT_FOUND, 'Observação não encontrada');
    await assertContratoNoEscopoOSS(o.contrato_id, ossIdFiltro);
    return o;
}

async function atualizarObservacao(id, v, ossIdFiltro) {
    const o = await obsNoEscopo(id, ossIdFiltro);
    const sets = Object.keys(v).filter((k) => {
        return CAMPOS_OBS.includes(k) && k !== 'contrato_id';
    });
    if (v.status && v.status !== o.status) sets.push('resolvida_em');
    if (!sets.length) return id;
    await exec(
        `UPDATE tb_observacao_financeira SET ${sets.map((k) => {
            return `${k} = ?`;
        }).join(', ')}, atualizado_em = NOW() WHERE obs_id = ?`,
        [...sets.map((k) => {
            if (k === 'resolvida_em') return v.status === 'resolvida' ? new Date() : null;
            return v[k] ?? null;
        }), id],
    );
    return id;
}

async function removerObservacao(id, ossIdFiltro) {
    await obsNoEscopo(id, ossIdFiltro);
    await exec('UPDATE tb_observacao_financeira SET deletado_em = NOW() WHERE obs_id = ?', [id]);
    return id;
}

async function listarFechamentos({ contratoId }, ossIdFiltro) {
    await assertContratoNoEscopoOSS(contratoId, ossIdFiltro);
    return q(
        `SELECT f.fechamento_id, f.contrato_id, DATE_FORMAT(f.mes_referencia, '%Y-%m-%d') AS mes_referencia,
                f.fechado_por, f.fechado_em
           FROM tb_fechamento_financeiro f WHERE f.contrato_id = ? ORDER BY f.mes_referencia`,
        [contratoId],
    );
}

async function fecharMeses({ contrato_id: contratoId, meses }, usuarioId, ossIdFiltro) {
    await assertContratoNoEscopoOSS(contratoId, ossIdFiltro);
    for (const m of meses) {
        await exec(
            `INSERT IGNORE INTO tb_fechamento_financeiro (contrato_id, mes_referencia, fechado_por) VALUES (?, ?, ?)`,
            [contratoId, m, usuarioId || null],
        );
    }
    return listarFechamentos({ contratoId }, ossIdFiltro);
}

/** Reabre um mês. A justificativa vai no corpo da resposta → fica no log de auditoria (auditar grava data). */
async function reabrirMes({ contrato_id: contratoId, mes, justificativa }, ossIdFiltro) {
    await assertContratoNoEscopoOSS(contratoId, ossIdFiltro);
    const [r] = await exec(
        'DELETE FROM tb_fechamento_financeiro WHERE contrato_id = ? AND mes_referencia = ?',
        [contratoId, mes],
    );
    if (!r.affectedRows) throw new ApiError(httpStatus.NOT_FOUND, 'Mês não estava fechado');
    return { contrato_id: contratoId, mes, justificativa, reaberto_em: new Date().toISOString() };
}

/** Listas para os filtros do painel: OSS → contratos → unidades. */
async function opcoes(ossIdFiltro) {
    const we = whereEscopo({}, ossIdFiltro);
    return q(
        `SELECT o.oss_id, o.nome AS oss_nome, c.contrato_id, c.numero, u.unidade_id, u.sigla, u.nome AS unidade_nome
           FROM tb_unidades u JOIN tb_contratos c ON c.contrato_id = u.contrato_id JOIN tb_oss o ON o.oss_id = c.oss_id
          WHERE ${we.sql} AND u.deleted_at IS NULL AND c.deleted_at IS NULL
          ORDER BY o.nome, c.numero, u.sigla`,
        we.r,
    );
}

module.exports = {
    CONTAS,
    fatos,
    kpis,
    serieAgregada,
    bucket,
    delta,
    avisosGrade,
    resumo,
    serie,
    comparativo,
    detalhe,
    grade,
    salvarGrade,
    receberArquivo,
    previaImportacao,
    confirmarImportacao,
    listarObservacoes,
    criarObservacao,
    atualizarObservacao,
    removerObservacao,
    listarFechamentos,
    fecharMeses,
    reabrirMes,
    opcoes,
};

// ── Self-check das funções puras: node src/service/FinanceiroService.js ──
if (require.main === module) {
    const assert = require('assert');
    const f = (mes, conta, o) => {
        return {
            unidade_id: 'u1', sigla: 'U', conta, mes, repasse: 0, rendimento: 0, outrasReceitas: 0, despesa: 0,
            grupos: {}, transferencia: 0, proprios: 0, arredondamento: 0, saldo: null, ...o,
        };
    };
    const lista = [
        f('2025-12-01', 'custeio', { saldo: 1000 }),
        f('2026-01-01', 'custeio', { repasse: 10000, despesa: 8000, grupos: { 'A|Pessoal': 6000, 'B|Mat': 2000 }, transferencia: -500, saldo: 2500 }),
        f('2026-02-01', 'custeio', { repasse: 10000, despesa: 9000, grupos: { 'A|Pessoal': 9000 }, saldo: 3500 }),
        f('2025-12-01', 'provisao', { saldo: 0 }),
        f('2026-01-01', 'provisao', { transferencia: 500, rendimento: 3, saldo: 503 }),
    ];
    const k = kpis(lista, '2026-01-01', '2026-02-01');
    assert.strictEqual(k.saldoInicial, 10);
    assert.strictEqual(k.saldoFinal, 40.03); // provisão sem saldo em fev → usa o último (jan)
    assert.strictEqual(k.repasse, 200);
    assert.strictEqual(k.despesa, 170);
    assert.strictEqual(k.transferencias, 0); // transferência interna se anula
    assert.strictEqual(k.diferencaFluxo, 0);
    assert.strictEqual(k.coberturaMeses, 0.4); // 40,03 / (200/2)
    assert.deepStrictEqual(k.despesaPorGrupo.map((g) => {
        return [g.codigo, g.valor, g.perc];
    }), [['A', 150, 88.2], ['B', 20, 11.8]]);
    assert.strictEqual(bucket('2026-08-01', 'quad'), '2026-Q2');
    assert.strictEqual(bucket('2026-09-01', 'trim'), '2026-T3');
    assert.strictEqual(serieAgregada(lista.filter((x) => {
        return x.mes >= '2026-01-01';
    }), 'ano')[0].saldo, 40.03);
    assert.strictEqual(delta(110, 100), 10);
    assert.strictEqual(delta(5, 0), null);
    assert.deepStrictEqual(avisosGrade({ saldoAnterior: 10, receitas: 100, despesas: 80, movimentos: -5, saldo: 25 }), []);
    assert.strictEqual(avisosGrade({ saldoAnterior: 10, receitas: 100, despesas: 80, movimentos: 0, saldo: 25 }).length, 1);
    console.log('FinanceiroService: OK');
    db.sequelize.close();
}
