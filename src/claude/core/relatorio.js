// Apoio à redação do relatório: compõe as ferramentas de banco e de documentos. Sem regra nova.
const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const { paraMd } = require('./formatos');
const { janela, RAIZ } = require('./limites');
const C = require('./consultas');
const D = require('./documentos');

const ferr = (lista, nome) => {
    return lista.find((f) => {
        return f.nome === nome;
    });
};
const rodar = (lista, nome, params) => {
    const f = ferr(lista, nome);
    return f.executar(z.object(f.schema).parse(params));
};

const PERIODOS_REL = ['1quad', '2quad', '3quad', 'ano'];
const ANTERIOR = {
    '1quad': [-1, '3quad'],
    '2quad': [0, '1quad'],
    '3quad': [0, '2quad'],
    ano: [-1, 'ano'],
};
const ANCORA_ACERVO = { HMA: '001/2023', 'UPA-DR': 'dona_rosa', 'UPA-ZAN': 'zanaga' };
const SIGLA_VAULT = {
    HMA: 'hm',
    UNACON: 'unacon',
    'UPA-CIL': 'upa_cillos',
    'UPA-ZAN': 'pa_zanaga',
    'UPA-DR': 'upa_dona_rosa',
};

/** contrato do banco → chave do acervo (001/2023 | dona_rosa | zanaga), pela sigla âncora */
async function contratoAcervoDe(c) {
    const siglas = (
        await C.q('SELECT sigla FROM tb_unidades WHERE contrato_id = :id AND deleted_at IS NULL', {
            id: c.contrato_id,
        })
    ).map((u) => {
        return u.sigla;
    });
    const s = siglas.find((x) => {
        return ANCORA_ACERVO[x];
    });
    if (!s) {
        throw new Error(`contrato ${c.numero} sem correspondência no acervo de relatórios`);
    }
    return { chave: ANCORA_ACERVO[s], siglas };
}

async function definitivo(ano, periodo, chave, maxPaginas) {
    const [it] = await D.acervoFiltrado({
        ano,
        periodo,
        contrato: chave,
        tipo: 'caf',
        so_definitivos: true,
    });
    if (!it) {
        return { ano, periodo, encontrado: false };
    }
    const texto = maxPaginas > 0 ? await D.pdfTexto(it.caminho_windows, 1, maxPaginas) : null;
    return {
        ano,
        periodo,
        encontrado: true,
        arquivo: it.arquivo,
        caminho: it.caminho,
        data_ref: it.data_ref,
        paginas: it.paginas,
        digitalizado: it.digitalizado,
        texto: it.digitalizado ? null : texto,
    };
}

const ferramentas = [
    {
        nome: 'relatorio_anterior',
        descricao:
            'Relatório definitivo da CAF do período anterior e do mesmo período do ano anterior (caminho e texto), para comparar e retomar ressalvas.',
        schema: {
            contrato: z.string(),
            ano: z.coerce.number().int(),
            periodo: z.enum(PERIODOS_REL),
            max_paginas: z.coerce
                .number()
                .int()
                .min(0)
                .max(100)
                .default(30)
                .describe('0 = só caminhos, sem texto'),
        },
        async executar(p) {
            const c = await C.contratoPor(p.contrato);
            const { chave } = await contratoAcervoDe(c);
            const [dAno, perAnt] = ANTERIOR[p.periodo];
            const anterior = await definitivo(
                p.ano + dAno,
                perAnt === 'ano' ? 'anual' : perAnt,
                chave,
                p.max_paginas,
            );
            const anoPassado = await definitivo(
                p.ano - 1,
                p.periodo === 'ano' ? 'anual' : p.periodo,
                chave,
                p.max_paginas,
            );
            const linhas = [
                { referencia: 'período anterior', ...anterior },
                { referencia: 'mesmo período do ano anterior', ...anoPassado },
            ];
            const texto = linhas
                .filter((l) => {
                    return l.texto;
                })
                .map((l) => {
                    return `### ${l.referencia}: ${l.arquivo}\n\n${l.texto}`;
                })
                .join('\n\n');
            return {
                titulo: `Relatórios anteriores: contrato ${c.numero}, ${p.periodo} ${p.ano}`,
                fonte: 'acervo de relatórios da CAF',
                dados: linhas,
                tabelas: [
                    {
                        colunas: [
                            ['referencia', 'Referência'],
                            ['ano', 'Ano'],
                            ['periodo', 'Período'],
                            ['encontrado', 'Encontrado'],
                            ['arquivo', 'Arquivo'],
                            ['caminho', 'Caminho'],
                            ['data_ref', 'Data'],
                            ['digitalizado', 'Digitalizado'],
                        ],
                        linhas: linhas.map(({ texto: _, ...l }) => {
                            return l;
                        }),
                    },
                ],
                texto: texto || undefined,
                notas: linhas.some((l) => {
                    return l.digitalizado;
                })
                    ? ['Há relatório digitalizado (sem texto): leia o PDF pelo caminho.']
                    : [],
            };
        },
    },
    {
        nome: 'checar_numeracao',
        descricao:
            'Divergências de numeração de contrato (ex. 001/2023 × 009/2023 × 004/2025; 066/2024 × 025/2025) entre banco, planilhas 2026 e nomes/1ª página dos relatórios do acervo.',
        schema: { contrato: z.string().optional() },
        async executar(p) {
            const alvo = p.contrato ? await C.contratoPor(p.contrato) : null;
            const contratos = await C.q(
                'SELECT c.contrato_id, c.numero, GROUP_CONCAT(u.sigla) siglas FROM tb_contratos c JOIN tb_unidades u USING (contrato_id) WHERE c.deleted_at IS NULL GROUP BY c.contrato_id',
            );
            // número → contrato do banco, pelos apelidos calibrados em consultas.js
            const numeroBanco = {};
            for (const [apelido, sigla] of Object.entries(C.ALIAS_CONTRATO)) {
                if (!/^\d{3}\/\d{4}$/.test(apelido)) {
                    continue;
                }
                const c = contratos.find((x) => {
                    return x.siglas.split(',').includes(sigla);
                });
                if (c) {
                    numeroBanco[apelido] = c.numero;
                }
            }
            const ocorrencias = [];
            const anotar = (numero, onde, trecho) => {
                return ocorrencias.push({
                    numero,
                    onde,
                    trecho: String(trecho).replace(/\s+/g, ' ').slice(0, 200),
                });
            };
            const RX = /(?<!\d)(\d{3})\s*[/_]\s*(20\d{2})(?!\d)/g;
            for (const c of contratos) {
                anotar(c.numero, 'banco: tb_contratos', `${c.numero} (${c.siglas})`);
            }
            for (const [chave, arquivo] of Object.entries(D.PLANILHAS)) {
                const abs = path.join(RAIZ, arquivo);
                if (!fs.existsSync(abs)) {
                    continue;
                }
                // eslint-disable-next-line no-await-in-loop
                for (const a of await D.py(['xlsx_busca', abs, '\\d{3}\\s*/\\s*20\\d{2}'])) {
                    for (const m of a.valor.matchAll(RX)) {
                        anotar(
                            `${m[1]}/${m[2]}`,
                            `planilha ${chave}: ${a.aba}!${a.celula}`,
                            a.valor,
                        );
                    }
                }
            }
            // ponytail: só nome + 1ª página dos relatórios (já em cache); texto completo se precisar achar mais
            for (const it of await D.acervoFiltrado({})) {
                for (const m of `${it.arquivo}\n${it.primeira_pagina || ''}`.matchAll(RX)) {
                    anotar(
                        `${m[1]}/${m[2]}`,
                        `relatório ${it.ano} ${it.periodo}: ${it.arquivo}`,
                        m.input.slice(Math.max(0, m.index - 60), m.index + 60),
                    );
                }
            }
            const resumo = new Map();
            for (const o of ocorrencias) {
                const banco =
                    numeroBanco[o.numero] ||
                    (contratos.some((c) => {
                        return c.numero === o.numero;
                    })
                        ? o.numero
                        : null);
                if (alvo && banco !== alvo.numero) {
                    continue;
                }
                const k = o.numero;
                if (!resumo.has(k)) {
                    resumo.set(k, {
                        numero: k,
                        contrato_banco: banco || '(não reconhecido)',
                        divergente: banco !== k,
                        fontes: new Set(),
                        ocorrencias: 0,
                    });
                }
                const r = resumo.get(k);
                r.ocorrencias += 1;
                r.fontes.add(o.onde.split(':')[0]);
            }
            const linhas = [...resumo.values()]
                .map((r) => {
                    return { ...r, fontes: [...r.fontes].join(', ') };
                })
                .sort((a, b) => {
                    return a.contrato_banco.localeCompare(b.contrato_banco);
                });
            return {
                titulo: `Numeração de contratos${alvo ? `: ${alvo.numero}` : ''}`,
                fonte: 'banco oss, planilhas 2026 e acervo de relatórios (nome e 1ª página)',
                dados: {
                    resumo: linhas,
                    ocorrencias: ocorrencias.filter((o) => {
                        return (
                            !alvo ||
                            linhas.some((l) => {
                                return l.numero === o.numero;
                            })
                        );
                    }),
                },
                tabelas: [
                    {
                        colunas: [
                            ['numero', 'Número citado'],
                            ['contrato_banco', 'Contrato no banco'],
                            ['divergente', 'Diverge do banco'],
                            ['fontes', 'Onde aparece'],
                            ['ocorrencias', 'Ocorrências', 'num'],
                        ],
                        linhas,
                    },
                ],
                notas: [
                    '"Não reconhecido" = número que não está nos apelidos (ALIAS_CONTRATO em consultas.js); pode ser processo, chamamento ou outro documento.',
                ],
            };
        },
    },
    {
        nome: 'pacote_relatorio',
        descricao:
            'PRINCIPAL. Tudo que o relatório quadrimestral/anual usa num único documento: dados da parceria, cumprimento de metas, não cumpridos, ponte de produção por unidade, repasse e descontos, percentual de recebimento, efetivo das escalas, documentos da prestação e o relatório definitivo do mesmo período do ano anterior.',
        schema: {
            contrato: z.string(),
            ano: z.coerce.number().int(),
            periodo: z.enum(PERIODOS_REL),
        },
        async executar(p) {
            const c = await C.contratoPor(p.contrato);
            const j = janela(p.ano, p.periodo);
            const { siglas } = await contratoAcervoDe(c).catch(() => {
                return { siglas: [] };
            });
            const secoes = [];
            const avisos = [];
            const secao = async (rotulo, fn) => {
                try {
                    const r = await fn();
                    for (const x of Array.isArray(r) ? r : [r]) {
                        secoes.push({ rotulo, r: x });
                    }
                } catch (e) {
                    avisos.push(`${rotulo}: ${e.message}`);
                }
            };
            const ultimoDia = (ymd) => {
                const d = new Date(`${ymd}T00:00:00Z`);
                d.setUTCMonth(d.getUTCMonth() + 1, 0);
                return d.toISOString().slice(0, 10);
            };
            await secao('Dados da parceria', () => {
                return rodar(C.ferramentas, 'detalhar_contrato', { contrato: c.contrato_id });
            });
            await secao('Cumprimento de metas', () => {
                return rodar(C.ferramentas, 'cumprimento_metas', {
                    ano: p.ano,
                    periodo: p.periodo,
                    escopo: 'contrato',
                    id: c.contrato_id,
                });
            });
            await secao('Não cumpridos', () => {
                return rodar(C.ferramentas, 'nao_cumpridos', {
                    ano: p.ano,
                    periodo: p.periodo,
                    escopo: 'contrato',
                    id: c.contrato_id,
                });
            });
            for (const s of siglas) {
                // eslint-disable-next-line no-await-in-loop
                await secao(`Ponte de produção ${s}`, () => {
                    return rodar(C.ferramentas, 'ponte_producao', {
                        unidade: s,
                        ano: p.ano,
                        periodo: p.periodo,
                    });
                });
            }
            await secao('Repasse e descontos', () => {
                return rodar(C.ferramentas, 'repasse_descontos', {
                    contrato: c.contrato_id,
                    ano: p.ano,
                    periodo: p.periodo,
                });
            });
            await secao('Percentual de recebimento', () => {
                return rodar(C.ferramentas, 'percentual_recebimento', {
                    contrato: c.contrato_id,
                    ano: p.ano,
                    periodo: p.periodo,
                });
            });
            for (const s of siglas) {
                // eslint-disable-next-line no-await-in-loop
                await secao(`Efetivo ${s}`, () => {
                    return rodar(C.ferramentas, 'efetivo_escalas', {
                        unidade: s,
                        de: j.inicio,
                        ate: ultimoDia(j.fim),
                        agrupar: 'categoria',
                    });
                });
            }
            await secao('Documentos da prestação', async () => {
                const meses = new Set();
                for (
                    let d = new Date(`${j.inicio}T00:00:00Z`);
                    d.toISOString().slice(0, 10) <= j.fim;
                    d.setUTCMonth(d.getUTCMonth() + 1)
                ) {
                    meses.add(D.mesVault(d.getUTCMonth() + 1));
                }
                const unidades = new Set(
                    siglas
                        .map((s) => {
                            return SIGLA_VAULT[s];
                        })
                        .filter(Boolean),
                );
                const todas = await D.prestacoesDoAno(p.ano);
                const linhas = todas.filter((x) => {
                    return (
                        unidades.has(x.unidade) && (meses.has(x.mes) || x.mes === 'quadrimestral')
                    );
                });
                const porTipo = new Map();
                for (const x of linhas) {
                    const k = `${x.unidade}|${x.mes}|${x.tipo}`;
                    if (!porTipo.has(k)) {
                        porTipo.set(k, {
                            unidade: x.unidade,
                            mes: x.mes,
                            tipo: x.tipo,
                            arquivos: 0,
                            com_md: 0,
                        });
                    }
                    porTipo.get(k).arquivos += 1;
                    if (x.md) {
                        porTipo.get(k).com_md += 1;
                    }
                }
                return {
                    titulo: 'Documentos da prestação de contas',
                    dados: [...porTipo.values()],
                    tabelas: [
                        {
                            colunas: [
                                ['unidade', 'Unidade'],
                                ['mes', 'Mês'],
                                ['tipo', 'Tipo'],
                                ['arquivos', 'Arquivos', 'num'],
                                ['com_md', 'Com .md', 'num'],
                            ],
                            linhas: [...porTipo.values()],
                        },
                    ],
                    notas: ['Lista completa: listar_prestacoes. Busca no conteúdo: buscar_vault.'],
                };
            });
            await secao('Relatório do ano anterior', () => {
                return rodar(ferramentas, 'relatorio_anterior', {
                    contrato: c.contrato_id,
                    ano: p.ano,
                    periodo: p.periodo,
                    max_paginas: 0,
                });
            });

            const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            const texto = [
                `Contrato ${c.numero}, ${j.rotulo}. Unidades: ${siglas.join(', ') || '—'}.`,
                avisos.length
                    ? `\n> Seções indisponíveis:\n${avisos
                          .map((a) => {
                              return `> - ${a}`;
                          })
                          .join('\n')}`
                    : '',
                ...secoes.map(({ r }) => {
                    return paraMd(r, geradoEm).replace(/^## /, '## ');
                }),
            ].join('\n\n');
            return {
                titulo: `Pacote do relatório: contrato ${c.numero}, ${j.rotulo}`,
                fonte: 'banco oss, banco producao, escalas, prestações e acervo de relatórios',
                dados: {
                    contrato: c.numero,
                    janela: j,
                    avisos,
                    secoes: Object.fromEntries(
                        secoes.map(({ rotulo, r }) => {
                            return [rotulo, r.dados];
                        }),
                    ),
                },
                texto,
            };
        },
    },
];

module.exports = { ferramentas };
