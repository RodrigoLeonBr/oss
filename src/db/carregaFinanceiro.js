// Carrega o <stem>.financeiro.json (gerado por extraiFinanceiro.py) em tb_rubricas, tb_execucao_financeira,
// tb_movimentacao_conta e tb_saldo_conta.
// Uso: node src/db/carregaFinanceiro.js <numero-contrato> <arquivo.financeiro.json>...   (ex.: 009/2023)
//      vários JSON = todas as contas do contrato no mesmo período (transferências são casadas entre eles)
//      node src/db/carregaFinanceiro.js <numero-contrato> --dry-run <json>...   (valida e compara com o banco, não grava)
//      node src/db/carregaFinanceiro.js --self-check
// Também usado pela API (FinanceiroService): carregar(numero, [objetoJson | caminho], { dryRun }) devolve o resumo.
// Idempotente: apaga e regrava (unidade, conta, mês) presentes no arquivo. Só grava se tudo fechar:
// subcontas = grupo, grupos = total, receitas = total, saldo do mês reconciliado e transferências casadas.

/* eslint-disable no-restricted-syntax, no-await-in-loop, no-param-reassign -- script CLI: escrita sequencial na transação */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const db = require('../models');

const CONTA = { CUSTEIO: 'custeio', INVESTIMENTO: 'investimento', PROVISAO: 'provisao' };
// receitas vêm sem código na planilha
const RECEITAS = [
    { re: /REPASSE/, grupo: ['R01', 'REPASSE'], codigo: 'R01.01' },
    { re: /RENDIMENTO/, grupo: ['R02', 'FINANCEIRO - RECEITA'], codigo: 'R02.01' },
];

const TOLERANCIA = 10; // centavos de arredondamento aceitos por mês no saldo
const semAcento = (s) => {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
};
const cent = (v) => {
    return Math.round(v * 100);
};
const pad = (n) => {
    return String(Number(n)).padStart(2, '0');
};
// '01.4' -> grupo '01', código '01.04' (ordena como texto)
const codDespesa = (c) => {
    const [g, s] = c.split('.');
    return { grupo: pad(g), codigo: `${pad(g)}.${pad(s)}` };
};

// Rótulo da linha de movimentação -> { tipo, sinal, unidade (token ou null = mesma), conta }.
// Sinal confirmado pela reconciliação de saldo; contraparte pelo casamento das transferências.
function classifica(descricao, contaAtual) {
    const d = semAcento(descricao);
    const destino = (resto) => {
        const [, conta] =
            Object.entries(CONTA).find(([k]) => {
                return resto.includes(k.slice(0, 6));
            }) || [];
        const m = resto.match(/\b(HMA?|UPA|UNACON)\b/);
        if (!conta) {
            throw new Error(`conta de destino não identificada: "${descricao}"`);
        }
        const unidade = m && m[1] === 'HM' ? 'HMA' : m && m[1];
        return { unidade: unidade || null, conta };
    };
    if (d.startsWith('VALOR TRANSFERIDO PARA')) {
        return { tipo: 'transferencia', sinal: -1, ...destino(d.slice(22)) };
    }
    if (d.startsWith('ENTRADA')) {
        return { tipo: 'transferencia', sinal: 1, ...destino(d.slice(7)) };
    }
    // "Resgate Conta Provisão" (na custeio) e "Valor resgate CUSTEIO" (na provisão): ambos entram na conta da aba
    if (d.startsWith('RESGATE CONTA PROVISAO')) {
        return { tipo: 'transferencia', sinal: 1, unidade: null, conta: 'provisao' };
    }
    if (d.startsWith('VALOR RESGATE CUSTEIO')) {
        return { tipo: 'transferencia', sinal: 1, unidade: null, conta: 'custeio' };
    }
    if (d.includes('RECURSOS PROPRIOS')) {
        return { tipo: 'recursos_proprios', sinal: 1, unidade: null, conta: null };
    }
    if (d.includes('ARREDONDAMENTO')) {
        return { tipo: 'arredondamento', sinal: 1, unidade: null, conta: null };
    }
    throw new Error(`movimentação não reconhecida (${contaAtual}): "${descricao}"`);
}

// Valida e normaliza uma aba. Lança com a lista de divergências.
function processaAba(aba, siglaDe) {
    const erros = [];
    const n = aba.meses.length;
    const unidade = siglaDe(aba.unidade);
    const conta = CONTA[aba.conta];
    if (!conta) {
        throw new Error(`${aba.aba}: conta "${aba.conta}" desconhecida`);
    }
    const soma = (linhas, i) => {
        return linhas.reduce((s, l) => {
            return s + cent(l.valores[i]);
        }, 0);
    };

    const receitas = aba.receitas.map((r) => {
        const def = RECEITAS.find((x) => {
            return x.re.test(semAcento(r.nome));
        });
        if (!def) {
            throw new Error(`${aba.aba}: receita desconhecida "${r.nome}"`);
        }
        return { ...r, codigo: def.codigo, grupo: def.grupo };
    });
    const despesas = aba.despesas.map((d) => {
        return {
            ...d,
            nome: d.nome.trim(),
            ...codDespesa(d.codigo),
        };
    });
    const grupos = aba.grupos.map((g) => {
        return {
            ...g,
            nome: g.nome.trim(),
            codigo: codDespesa(g.codigo).grupo,
        };
    });
    const movimentos = aba.movimentos.map((m) => {
        const c = classifica(m.descricao, aba.aba);
        let cpUnidade = null;
        if (c.tipo === 'transferencia') {
            cpUnidade = c.unidade ? siglaDe(c.unidade) : unidade;
        }
        return {
            ...m,
            ...c,
            cpUnidade,
            valores: m.valores.map((v) => {
                return v * c.sinal;
            }),
        };
    });

    // Arredondamento é ajuste de centavos que a planilha soma ou subtrai conforme a fórmula do mês (inconsistente).
    // Fora da conta: o resíduo de até TOLERANCIA vira o arredondamento efetivo (banco fecha exato) e é avisado.
    const arred = movimentos.find((m) => {
        return m.tipo === 'arredondamento';
    }) || {
        descricao: 'Arredondamento',
        tipo: 'arredondamento',
        cpUnidade: null,
        conta: null,
        valores: aba.meses.map(() => {
            return 0;
        }),
    };
    const fluxos = movimentos.filter((m) => {
        return m !== arred;
    });
    const avisos = [];
    let anterior = aba.saldo_anterior == null ? null : cent(aba.saldo_anterior);
    for (let i = 0; i < n; i += 1) {
        const mes = aba.meses[i];
        grupos.forEach((g) => {
            const s = soma(
                despesas.filter((d) => {
                    return d.grupo === g.codigo;
                }),
                i,
            );
            if (s !== cent(g.valores[i])) {
                erros.push(`${mes} grupo ${g.codigo}: subcontas ${s / 100} ≠ ${g.valores[i]}`);
            }
        });
        if (soma(grupos, i) !== cent(aba.total_despesas[i])) {
            erros.push(`${mes} total despesas ${soma(grupos, i) / 100} ≠ ${aba.total_despesas[i]}`);
        }
        if (soma(receitas, i) !== cent(aba.total_receitas[i])) {
            erros.push(
                `${mes} total receitas ${soma(receitas, i) / 100} ≠ ${aba.total_receitas[i]}`,
            );
        }
        const fluxo = soma(receitas, i) - soma(despesas, i) + soma(fluxos, i);
        // sem "Saldo mês anterior" na aba: deriva do 1º mês com o arredondamento informado (vira o saldo inicial gravado)
        if (anterior == null) {
            anterior = cent(aba.saldo[0]) - fluxo - cent(arred.valores[0]);
        }
        const residuo = cent(aba.saldo[i]) - (anterior + fluxo);
        if (Math.abs(residuo) > TOLERANCIA) {
            erros.push(
                `${mes} saldo ${(anterior + fluxo) / 100} ≠ ${aba.saldo[i]} (dif ${residuo / 100})`,
            );
        }
        if (residuo !== cent(arred.valores[i])) {
            avisos.push(
                `${mes} arredondamento informado ${arred.valores[i]}, efetivo ${residuo / 100}`,
            );
        }
        arred.valores[i] = residuo / 100;
        anterior = cent(aba.saldo[i]);
    }
    if (erros.length) {
        throw new Error(`${aba.aba}:\n  ${erros.join('\n  ')}`);
    }

    const saldoInicial =
        cent(aba.saldo[0]) -
        (soma(receitas, 0) - soma(despesas, 0) + soma(fluxos, 0) + cent(arred.valores[0]));
    return {
        aba: aba.aba,
        unidade,
        conta,
        meses: aba.meses,
        receitas,
        despesas,
        grupos,
        movimentos: [...fluxos, arred],
        saldo: aba.saldo,
        saldoInicial,
        avisos,
    };
}

// Toda transferência precisa do lançamento espelho na outra conta (mesmo mês, valor oposto).
function casaTransferencias(abas) {
    const erros = [];
    const chave = (u, c, cu, cc, mes) => {
        return `${u}|${c}|${cu}|${cc}|${mes}`;
    };
    const lado = new Map();
    abas.forEach((a) => {
        return a.movimentos
            .filter((m) => {
                return m.tipo === 'transferencia';
            })
            .forEach((m) => {
                return m.valores.forEach((v, i) => {
                    if (!cent(v)) {
                        return;
                    }
                    const k = chave(a.unidade, a.conta, m.cpUnidade, m.conta, a.meses[i]);
                    lado.set(k, (lado.get(k) || 0) + cent(v));
                });
            });
    });
    lado.forEach((v, k) => {
        const [u, c, cu, cc, mes] = k.split('|');
        const espelho = lado.get(chave(cu, cc, u, c, mes)) || 0;
        if (v + espelho !== 0) {
            erros.push(`${mes} ${u}/${c} ↔ ${cu}/${cc}: ${v / 100} vs ${espelho / 100}`);
        }
    });
    if (erros.length) {
        throw new Error(`Transferências sem espelho:\n  ${[...new Set(erros)].join('\n  ')}`);
    }
}

function selfCheck() {
    assert.deepStrictEqual(classifica('Valor transferido para Conta HM CUSTEIO', 'x'), {
        tipo: 'transferencia',
        sinal: -1,
        unidade: 'HMA',
        conta: 'custeio',
    });
    assert.deepStrictEqual(classifica('Valor transferido para PROVISÃO TRABALHISTA', 'x'), {
        tipo: 'transferencia',
        sinal: -1,
        unidade: null,
        conta: 'provisao',
    });
    assert.deepStrictEqual(classifica('Entrada - Conta UNACON CUSTEIO', 'x'), {
        tipo: 'transferencia',
        sinal: 1,
        unidade: 'UNACON',
        conta: 'custeio',
    });
    assert.strictEqual(classifica('Valor resgate CUSTEIO', 'x').sinal, 1);
    assert.strictEqual(
        classifica('Recursos próprios da Organização Social/Devoluções', 'x').tipo,
        'recursos_proprios',
    );
    assert.throws(() => {
        return classifica('Linha nova qualquer', 'x');
    });
    assert.deepStrictEqual(codDespesa('01.17'), { grupo: '01', codigo: '01.17' });
    assert.deepStrictEqual(codDespesa('3.0').grupo, '03');
    const aba = {
        aba: 'T',
        unidade: 'HMA',
        conta: 'CUSTEIO',
        meses: ['2026-01-01'],
        saldo_anterior: 10,
        receitas: [{ nome: 'Repasse Secretaria de Saúde', valores: [100] }],
        total_receitas: [100],
        grupos: [{ codigo: '1.0', nome: 'RH', valores: [30] }],
        despesas: [{ codigo: '01.4', nome: 'X', valores: [30] }],
        total_despesas: [30],
        movimentos: [{ descricao: 'Valor transferido para Conta PROVISÃO', valores: [50] }],
        saldo: [30],
    };
    assert.strictEqual(
        processaAba(aba, (s) => {
            return s;
        }).saldoInicial,
        1000,
    );
    const plug = processaAba({ ...aba, saldo: [30.03] }, (s) => {
        return s;
    }); // 3 centavos: vira arredondamento
    assert.strictEqual(
        plug.movimentos.find((m) => {
            return m.tipo === 'arredondamento';
        }).valores[0],
        0.03,
    );
    assert.throws(() => {
        return processaAba({ ...aba, saldo: [31] }, (s) => {
            return s;
        });
    }, /saldo/);
    console.log('OK');
}

const DRY_RUN = Symbol('dry-run');

async function carregar(numeroContrato, arquivos, { dryRun = false } = {}) {
    const q = (sql, replacements, transaction) => {
        return db.sequelize.query(sql, { replacements, transaction, logging: false });
    };
    const [[contrato]] = await q('SELECT contrato_id FROM tb_contratos WHERE numero = ?', [
        numeroContrato,
    ]);
    if (!contrato) {
        throw new Error(`contrato ${numeroContrato} não encontrado`);
    }
    const [unidades] = await q(
        'SELECT unidade_id, sigla, nome FROM tb_unidades WHERE contrato_id = ?',
        [contrato.contrato_id],
    );
    // token da aba ("HMA", "HM", "UPA", "HOSPITAL MUNICIPAL", "UPA DONA ROSA") -> sigla exata,
    // única sigla do contrato que começa com ele, ou unidade cujo nome contém todas as palavras
    const siglaDe = (token) => {
        const t = token === 'HM' ? 'HMA' : token;
        let achou = unidades.filter((u) => {
            return u.sigla === t || u.sigla.startsWith(`${t}-`);
        });
        if (!achou.length) {
            achou = unidades.filter((u) => {
                const nome = semAcento(u.nome).split(/\s+/);
                return t.split(/\s+/).every((w) => {
                    return nome.includes(w);
                });
            });
        }
        if (achou.length !== 1) {
            throw new Error(`unidade "${t}" não identificada no contrato ${numeroContrato}`);
        }
        return achou[0].sigla;
    };
    const idDe = Object.fromEntries(
        unidades.map((u) => {
            return [u.sigla, u.unidade_id];
        }),
    );

    const abas = arquivos.flatMap((arq) => {
        const json = typeof arq === 'string' ? JSON.parse(fs.readFileSync(arq, 'utf8')) : arq;
        return json.abas.map((a) => {
            return { ...processaAba(a, siglaDe), arquivo: json.arquivo };
        });
    });
    const vistas = new Set();
    abas.forEach((a) => {
        const k = `${a.unidade}/${a.conta}`;
        if (vistas.has(k)) {
            throw new Error(`${k} aparece em mais de um arquivo: carregue um período por vez`);
        }
        vistas.add(k);
    });
    casaTransferencias(abas);

    const meses = [...new Set(abas.flatMap((a) => {
        return a.meses;
    }))];
    const [fechados] = await q(
        `SELECT DATE_FORMAT(mes_referencia, '%Y-%m-%d') AS mes FROM tb_fechamento_financeiro
          WHERE contrato_id = ? AND mes_referencia IN (?)`,
        [contrato.contrato_id, meses],
    );
    if (fechados.length) {
        throw new Error(`mês fechado: ${fechados.map((f) => {
            return f.mes;
        }).join(', ')} — reabra antes de importar`);
    }

    // situação atual no banco, para a prévia mostrar o que muda (receita, despesa e saldo por unidade/conta/mês)
    const atual = new Map();
    const [linhasAtuais] = await q(
        `SELECT u.sigla, x.conta, DATE_FORMAT(x.mes_referencia, '%Y-%m-%d') AS mes, x.campo, x.valor FROM (
           SELECT e.unidade_id, e.conta, e.mes_referencia, r.natureza AS campo, SUM(e.valor_realizado) AS valor
             FROM tb_execucao_financeira e JOIN tb_rubricas r ON r.rubrica_id = e.rubrica_id
            GROUP BY e.unidade_id, e.conta, e.mes_referencia, r.natureza
           UNION ALL
           SELECT unidade_id, conta, mes_referencia, 'saldo', saldo FROM tb_saldo_conta
         ) x JOIN tb_unidades u ON u.unidade_id = x.unidade_id
        WHERE u.contrato_id = ? AND x.mes_referencia IN (?)`,
        [contrato.contrato_id, meses],
    );
    linhasAtuais.forEach((l) => {
        atual.set(`${l.sigla}|${l.conta}|${l.mes}|${l.campo}`, cent(Number(l.valor)));
    });
    const diferencas = [];
    abas.forEach((a) => {
        a.meses.forEach((m, i) => {
            const novo = {
                receita: a.receitas.reduce((s, l) => {
                    return s + cent(l.valores[i]);
                }, 0),
                despesa: a.despesas.reduce((s, l) => {
                    return s + cent(l.valores[i]);
                }, 0),
                saldo: cent(a.saldo[i]),
            };
            Object.entries(novo).forEach(([campo, v]) => {
                const antes = atual.get(`${a.unidade}|${a.conta}|${m}|${campo}`);
                if ((antes ?? 0) !== v) {
                    diferencas.push({
                        unidade: a.unidade,
                        conta: a.conta,
                        mes: m,
                        campo,
                        atual: antes == null ? null : antes / 100,
                        novo: v / 100,
                    });
                }
            });
        });
    });

    const resumo = {
        contrato: numeroContrato,
        dryRun,
        abas: abas.map((a) => {
            return {
                unidade: a.unidade,
                conta: a.conta,
                meses: a.meses,
                saldoInicial: a.saldoInicial / 100,
                saldoFinal: a.saldo[a.saldo.length - 1],
                avisos: a.avisos,
            };
        }),
        diferencas,
    };

    await db.sequelize.transaction(async (t) => {
        // plano de contas: grupos e depois categorias (pai), nomes da primeira aba que trouxer o código
        const rubricas = new Map();
        abas.forEach((a) => {
            a.receitas.forEach((r) => {
                rubricas.set(
                    r.grupo[0],
                    rubricas.get(r.grupo[0]) || {
                        nome: r.grupo[1],
                        nivel: 'grupo',
                        natureza: 'receita',
                    },
                );
                rubricas.set(
                    r.codigo,
                    rubricas.get(r.codigo) || {
                        nome: r.nome,
                        nivel: 'categoria',
                        natureza: 'receita',
                        pai: r.grupo[0],
                    },
                );
            });
            a.grupos.forEach((g) => {
                return rubricas.set(
                    g.codigo,
                    rubricas.get(g.codigo) || { nome: g.nome, nivel: 'grupo', natureza: 'despesa' },
                );
            });
            a.despesas.forEach((d) => {
                return rubricas.set(
                    d.codigo,
                    rubricas.get(d.codigo) || {
                        nome: d.nome,
                        nivel: 'categoria',
                        natureza: 'despesa',
                        pai: d.grupo,
                    },
                );
            });
        });
        const ordenadas = [...rubricas]
            .sort(([, a], [, b]) => {
                return (a.nivel === 'grupo') - (b.nivel === 'grupo');
            })
            .reverse();
        const idRubrica = {};
        for (const [codigo, r] of ordenadas) {
            await q(
                `INSERT INTO tb_rubricas (contrato_id, rubrica_pai_id, codigo, nome, nivel, natureza) VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE nome = VALUES(nome), rubrica_pai_id = VALUES(rubrica_pai_id), natureza = VALUES(natureza)`,
                [
                    contrato.contrato_id,
                    r.pai ? idRubrica[r.pai] : null,
                    codigo,
                    r.nome,
                    r.nivel,
                    r.natureza,
                ],
                t,
            );
            const [[{ rubrica_id: id }]] = await q(
                'SELECT rubrica_id FROM tb_rubricas WHERE contrato_id = ? AND codigo = ?',
                [contrato.contrato_id, codigo],
                t,
            );
            idRubrica[codigo] = id;
        }

        const exec = [];
        const movs = [];
        const saldos = [];
        abas.forEach((a) => {
            const u = idDe[a.unidade];
            const fonte = `${a.arquivo} [${a.aba}]`.slice(0, 255);
            const [ano, mes] = a.meses[0].split('-').map(Number);
            a.mesAnterior = mes === 1 ? `${ano - 1}-12-01` : `${ano}-${pad(mes - 1)}-01`;
            saldos.push([
                u,
                a.conta,
                a.mesAnterior,
                a.saldoInicial / 100,
                `${fonte} saldo inicial`,
            ]);
            a.meses.forEach((m, i) => {
                [...a.receitas, ...a.despesas].forEach((l) => {
                    if (cent(l.valores[i])) {
                        exec.push([
                            idRubrica[l.codigo],
                            u,
                            a.conta,
                            m,
                            l.valores[i],
                            'aprovado',
                            fonte,
                        ]);
                    }
                });
                a.movimentos.forEach((mv) => {
                    if (cent(mv.valores[i])) {
                        movs.push([
                            u,
                            a.conta,
                            m,
                            mv.tipo,
                            mv.cpUnidade ? idDe[mv.cpUnidade] : null,
                            mv.tipo === 'transferencia' ? mv.conta : null,
                            mv.descricao,
                            mv.valores[i],
                            fonte,
                        ]);
                    }
                });
                saldos.push([u, a.conta, m, a.saldo[i], fonte]);
            });
        });

        for (const a of abas) {
            for (const tb of [
                'tb_execucao_financeira',
                'tb_movimentacao_conta',
                'tb_saldo_conta',
            ]) {
                await q(
                    `DELETE FROM ${tb} WHERE unidade_id = ? AND conta = ? AND mes_referencia IN (?)`,
                    [idDe[a.unidade], a.conta, [a.mesAnterior, ...a.meses]],
                    t,
                );
            }
        }
        const inserir = async (sql, linhas) => {
            if (linhas.length) {
                await q(`${sql} VALUES ?`, [linhas], t);
            }
        };
        await inserir(
            'INSERT INTO tb_execucao_financeira (rubrica_id, unidade_id, conta, mes_referencia, valor_realizado, status_aprovacao, fonte)',
            exec,
        );
        await inserir(
            `INSERT INTO tb_movimentacao_conta (unidade_id, conta, mes_referencia, tipo, contraparte_unidade_id, contraparte_conta,
      descricao, valor, fonte)`,
            movs,
        );
        await inserir(
            'INSERT INTO tb_saldo_conta (unidade_id, conta, mes_referencia, saldo, fonte)',
            saldos,
        );
        resumo.totais = {
            rubricas: rubricas.size,
            lancamentos: exec.length,
            movimentacoes: movs.length,
            saldos: saldos.length,
        };
        if (dryRun) {
            throw DRY_RUN; // desfaz a transação: a prévia exercita o mesmo caminho da gravação
        }
    }).catch((e) => {
        if (e !== DRY_RUN) {
            throw e;
        }
    });
    return resumo;
}

function imprime(r) {
    const t = r.totais;
    console.log(`${r.dryRun ? '[dry-run] ' : ''}${t.rubricas} rubricas, ${t.lancamentos} lançamentos, `
        + `${t.movimentacoes} movimentações, ${t.saldos} saldos; ${r.diferencas.length} diferenças contra o banco`);
    r.abas.forEach((a) => {
        console.log(`  ${a.unidade} ${a.conta}: saldo inicial ${a.saldoInicial}, final ${a.saldoFinal}`);
        a.avisos.forEach((x) => {
            return console.log(`    aviso: ${x}`);
        });
    });
    r.diferencas.slice(0, 30).forEach((d) => {
        console.log(`  ≠ ${d.mes} ${d.unidade}/${d.conta} ${d.campo}: ${d.atual} → ${d.novo}`);
    });
}

if (require.main === module) {
    const [contrato, ...resto] = process.argv.slice(2);
    const dryRun = resto.includes('--dry-run');
    const arqs = resto.filter((a) => {
        return a !== '--dry-run';
    });
    if (contrato === '--self-check') {
        selfCheck();
    } else if (!arqs.length) {
        console.error(
            'uso: node src/db/carregaFinanceiro.js <numero-contrato> <arquivo.financeiro.json>...',
        );
    } else {
        carregar(
            contrato,
            arqs.map((a) => {
                return path.resolve(a);
            }),
            { dryRun },
        )
            .then(imprime)
            .catch((e) => {
                console.error(e.message);
                process.exitCode = 1;
            })
            .finally(() => {
                return db.sequelize.close();
            });
    }
}

module.exports = { carregar, processaAba, classifica };
