// Ferramentas de documentos: prestações (oss/<ano>), vault .md, leitura de PDF/MD, acervo de relatórios da CAF, planilhas.
// Processos externos só por execFile com args em array (sem shell). Caminhos validados por resolverCaminho.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const execFile = promisify(require('child_process').execFile);
const { z } = require('zod');
const { RAIZ, resolverCaminho, acervoDir } = require('./limites');

const PY = path.join(__dirname, 'apoio.py');
const VAULT = path.join(RAIZ, 'prestacao-vault', 'vault');
const pdftotextBin = () => {
    return process.env.PDFTOTEXT_BIN || 'pdftotext';
};
const pythonBin = () => {
    return process.env.PYTHON_BIN || 'python';
};
const chatOss = (abs) => {
    return `~/mnt/oss/${path.relative(RAIZ, abs).replace(/\\/g, '/')}`;
};
const chatAcervo = (rel) => {
    return `~/mnt/relatórios/${rel.replace(/\\/g, '/')}`;
};

/** minúsculas, sem acento, _ . - viram espaço */
const norm = (s) => {
    return String(s || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[_.\-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

async function py(args) {
    const { stdout } = await execFile(pythonBin(), [PY, ...args], {
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        windowsHide: true,
    });
    return JSON.parse(stdout);
}

async function pdfTexto(abs, de = 1, ate = 20) {
    try {
        const { stdout } = await execFile(
            pdftotextBin(),
            ['-enc', 'UTF-8', '-layout', '-f', String(de), '-l', String(ate), abs, '-'],
            {
                maxBuffer: 64 * 1024 * 1024,
                windowsHide: true,
            },
        );
        return stdout;
    } catch (e) {
        if (e.code === 'ENOENT') {
            throw new Error(
                `pdftotext não encontrado (${pdftotextBin()}); defina PDFTOTEXT_BIN no .env`,
            );
        }
        throw new Error(`falha ao extrair texto do PDF: ${e.message.split('\n')[0]}`);
    }
}

// ── Apelidos (vault usa hm/unacon/upa_cillos/pa_zanaga/upa_dona_rosa) ──
const UNIDADE_VAULT = {
    hm: 'hm',
    hma: 'hm',
    hospital: 'hm',
    unacon: 'unacon',
    'upa cil': 'upa_cillos',
    cillos: 'upa_cillos',
    'upa cillos': 'upa_cillos',
    zanaga: 'pa_zanaga',
    'upa zan': 'pa_zanaga',
    'pa zanaga': 'pa_zanaga',
    'dona rosa': 'upa_dona_rosa',
    'upa dr': 'upa_dona_rosa',
    drosa: 'upa_dona_rosa',
    geral: 'geral',
};
const unidadeVault = (u) => {
    return u ? UNIDADE_VAULT[norm(u)] || norm(u).replace(/ /g, '_') : null;
};
const MESES = [
    'janeiro',
    'fevereiro',
    'marco',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
];
const mesVault = (m) => {
    if (m == null || m === '') {
        return null;
    }
    const n = parseInt(m, 10);
    return n >= 1 && n <= 12 ? MESES[n - 1] : norm(m);
};

// ── Prestações de contas ────────────────────────────────────────────────
const cachePrest = new Map(); // ano → { em, lista }   ponytail: cache 10 min em memória
async function prestacoesDoAno(ano) {
    const c = cachePrest.get(ano);
    if (c && Date.now() - c.em < 10 * 60 * 1000) {
        return c.lista;
    }
    const lista = await py(['prestacoes', String(ano)]);
    cachePrest.set(ano, { em: Date.now(), lista });
    return lista;
}

// ── Acervo de relatórios da CAF ─────────────────────────────────────────
// Calibrar aqui. Tipo pelo texto da 1ª página (mais confiável); sem texto (digitalizado), pelo nome.
const TIPO_POR_TEXTO = [
    [/demonstrativo financeiro/, 'planilha'],
    [/resumo financeiro/, 'resumo'],
    [/nucleo tecnico de apoio/, 'nta'],
    [/relatorio contabil|demonstracoes contabeis/, 'contabil'],
    [/comissao de avaliacao e fiscalizacao/, 'caf'],
];
const TIPO_POR_NOME = [
    [/planilha/, 'planilha'],
    [/resumo financeiro/, 'resumo'],
    [/\bnta\b|relatorio de pc|\bpc anual\b/, 'nta'],
    [/contabil/, 'contabil'],
    [/extrato/, 'outro'],
    [/chavantes/, 'outro'], // relatório em nome da consultoria, não é o da CAF
    [/parecer|\bcaf\b|relcarf|conclusivo|relatorio (quad|anual|jan|mai|set)/, 'caf'],
];
const PERIODO_PASTA = {
    '1o quad': '1quad',
    '1º quad': '1quad',
    '2o quad': '2quad',
    '3o quad': '3quad',
    anual: 'anual',
};

function contratoDoCaminho(rel) {
    const s = norm(rel);
    if (/dona rosa|d rosa|drosa/.test(s)) {
        return 'dona_rosa';
    }
    if (/zanaga/.test(s)) {
        return 'zanaga';
    }
    return '001/2023';
}

/** data no nome: AAAAMMDD, DD_MM_AAAA ou AAAA_MM_DD */
function dataDoNome(nome) {
    const v = (y, m, d) => {
        return +m >= 1 && +m <= 12 && +d >= 1 && +d <= 31 ? `${y}-${m}-${d}` : null;
    };
    let mt = nome.match(/(?<!\d)(20\d{2})(\d{2})(\d{2})(?!\d)/);
    if (mt && v(mt[1], mt[2], mt[3])) {
        return v(mt[1], mt[2], mt[3]);
    }
    mt = nome.match(/(?<!\d)(\d{2})[_.\-](\d{2})[_.\-](20\d{2})(?!\d)/);
    if (mt && v(mt[3], mt[2], mt[1])) {
        return v(mt[3], mt[2], mt[1]);
    }
    mt = nome.match(/(?<!\d)(20\d{2})[_.\-](\d{2})[_.\-](\d{2})(?!\d)/);
    if (mt && v(mt[1], mt[2], mt[3])) {
        return v(mt[1], mt[2], mt[3]);
    }
    return null;
}

function dataCriacaoPdf(buf) {
    const mt = buf
        .toString('latin1')
        .match(/\/CreationDate\s*\(D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?/);
    return mt ? `${mt[1]}-${mt[2]}-${mt[3]}T${mt[4] || '00'}:${mt[5] || '00'}` : null;
}

// ponytail: páginas pelo maior /Count do PDF; null quando a árvore está em object stream comprimido
function paginasPdf(buf) {
    const ms = [
        ...buf
            .toString('latin1')
            .matchAll(
                /\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages/g,
            ),
    ];
    const ns = ms
        .map((m) => {
            return parseInt(m[1] || m[2], 10);
        })
        .filter(Number.isFinite);
    return ns.length ? Math.max(...ns) : null;
}

const cacheAcervo = new Map(); // caminho → { chave: mtime+tamanho, item }
async function itemAcervo(abs, rel) {
    const st = fs.statSync(abs);
    const chave = `${st.mtimeMs}:${st.size}`;
    const c = cacheAcervo.get(abs);
    if (c && c.chave === chave) {
        return c.item;
    }
    const buf = fs.readFileSync(abs);
    const partes = rel.split(/[\\/]/);
    const nome = partes[partes.length - 1];
    const texto1 = await pdfTexto(abs, 1, 1).catch(() => {
        return '';
    });
    const t = norm(texto1);
    const digitalizado = t.length < 20;
    const tipo =
        (digitalizado
            ? TIPO_POR_NOME.find(([rx]) => {
                  return rx.test(norm(nome));
              })
            : TIPO_POR_TEXTO.find(([rx]) => {
                  return rx.test(t);
              }) ||
              TIPO_POR_NOME.find(([rx]) => {
                  return rx.test(norm(nome));
              }))?.[1] || 'outro';
    const dn = dataDoNome(nome);
    const dc = dataCriacaoPdf(buf);
    const item = {
        ano: partes[0],
        periodo:
            PERIODO_PASTA[norm(partes[1]).replace(/º/g, 'o')] ||
            PERIODO_PASTA[partes[1]] ||
            norm(partes[1]),
        contrato: contratoDoCaminho(rel),
        tipo,
        arquivo: nome,
        caminho: chatAcervo(rel),
        caminho_windows: abs,
        paginas: paginasPdf(buf),
        digitalizado,
        md5: crypto.createHash('md5').update(buf).digest('hex'),
        data_ref: dn || dc || st.mtime.toISOString().slice(0, 16),
        origem_data: dn ? 'nome' : dc ? 'CreationDate' : 'modificacao',
        criado_em: dc,
        primeira_pagina: texto1.slice(0, 600),
    };
    cacheAcervo.set(abs, { chave, item });
    return item;
}

/** Inventário completo do acervo com dedup MD5 e marca definitivo (mais antigo por ano+período+contrato+tipo). */
async function acervoCompleto() {
    const base = acervoDir();
    if (!base || !fs.existsSync(base)) {
        throw new Error('ACERVO_RELATORIOS_DIR não definido ou inexistente no .env');
    }
    const rels = [];
    (function walk(dir) {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (e.name === '_duplicados') {
                continue;
            }
            const p = path.join(dir, e.name);
            if (e.isDirectory()) {
                walk(p);
            } else if (/\.pdf$/i.test(e.name)) {
                rels.push(path.relative(base, p));
            }
        }
    })(base);
    const itens = [];
    for (const rel of rels) {
        itens.push(await itemAcervo(path.join(base, rel), rel));
    } // eslint-disable-line no-await-in-loop
    // dedup por MD5: fica o mais antigo, os outros viram "copias"
    const porHash = new Map();
    for (const it of itens.sort((a, b) => {
        return a.data_ref.localeCompare(b.data_ref);
    })) {
        if (porHash.has(it.md5)) {
            porHash.get(it.md5).copias.push(it.caminho);
        } else {
            porHash.set(it.md5, { ...it, copias: [] });
        }
    }
    const unicos = [...porHash.values()];
    const grupos = new Map();
    for (const it of unicos) {
        const k = [it.ano, it.periodo, it.contrato, it.tipo].join('|');
        if (!grupos.has(k)) {
            grupos.set(k, it);
        } // já ordenado: o primeiro é o mais antigo
        it.versoes = 0;
    }
    // versoes: total de versões distintas no grupo (calculado abaixo)
    const chave = (it) => {
        return [it.ano, it.periodo, it.contrato, it.tipo].join('|');
    };
    for (const it of unicos) {
        it.definitivo = grupos.get(chave(it)) === it;
        grupos.get(chave(it)).versoes += 1;
    }
    for (const it of unicos) {
        it.versoes = grupos.get(chave(it)).versoes;
    }
    return unicos;
}

const CONTRATO_ACERVO = {
    '001/2023': '001/2023',
    '009/2023': '001/2023',
    '004/2025': '001/2023',
    hma: '001/2023',
    scmc: '001/2023',
    geral: '001/2023',
    dona_rosa: 'dona_rosa',
    'dona rosa': 'dona_rosa',
    '066/2024': 'dona_rosa',
    '025/2025': 'dona_rosa',
    drosa: 'dona_rosa',
    zanaga: 'zanaga',
    '517/2025': 'zanaga',
    '002/2025': 'zanaga',
};
const contratoAcervo = (c) => {
    return c
        ? CONTRATO_ACERVO[String(c).toLowerCase()] ||
              (() => {
                  throw new Error(
                      `contrato inválido para o acervo: ${c} (use 001/2023, dona_rosa ou zanaga)`,
                  );
              })()
        : null;
};
const periodoAcervo = (p) => {
    return p === 'ano' ? 'anual' : p;
};

async function acervoFiltrado({ ano, periodo, contrato, tipo, so_definitivos: soDef }) {
    const c = contratoAcervo(contrato);
    const p = periodo ? periodoAcervo(periodo) : null;
    return (await acervoCompleto())
        .filter((it) => {
            return (
                (!ano || it.ano === String(ano)) &&
                (!p || it.periodo === p) &&
                (!c || it.contrato === c) &&
                (!tipo || it.tipo === tipo) &&
                (!soDef || it.definitivo)
            );
        })
        .sort((a, b) => {
            return [a.ano, a.periodo, a.contrato, a.tipo, a.data_ref]
                .join('|')
                .localeCompare([b.ano, b.periodo, b.contrato, b.tipo, b.data_ref].join('|'));
        });
}

const PLANILHAS = {
    gerais: 'indicadores_gerais_hm_unacon_upa_2026.xlsx',
    dona_rosa: 'indicadores_upa_drosa_2026.xlsx',
    zanaga: 'pa_zanaga_2026.xlsx',
};

const COLS_ACERVO = [
    ['ano', 'Ano'],
    ['periodo', 'Período'],
    ['contrato', 'Contrato'],
    ['tipo', 'Tipo'],
    ['arquivo', 'Arquivo'],
    ['data_ref', 'Data'],
    ['origem_data', 'Origem da data'],
    ['paginas', 'Págs', 'num'],
    ['digitalizado', 'Digitalizado'],
    ['definitivo', 'Definitivo'],
    ['versoes', 'Versões', 'num'],
];

const ferramentas = [
    {
        nome: 'listar_prestacoes',
        descricao:
            'Lista os PDFs da prestação de contas das OSS (pastas oss/<ano>), com unidade, mês, tipo, tamanho e se já existe a versão .md no vault.',
        schema: {
            ano: z.coerce.number().int(),
            mes: z.union([z.coerce.number().int().min(1).max(12), z.string()]).optional(),
            unidade: z
                .string()
                .optional()
                .describe('hm, unacon, upa_cillos, pa_zanaga, upa_dona_rosa (ou HMA, UPA-ZAN...)'),
            tipo: z
                .string()
                .optional()
                .describe(
                    'oficio, relatorio_assistencial, book, recorte, financeiro, escala, rh, outros...',
                ),
        },
        async executar(p) {
            const u = unidadeVault(p.unidade);
            const m = mesVault(p.mes);
            const linhas = (await prestacoesDoAno(p.ano))
                .filter((x) => {
                    return (
                        (!u || x.unidade === u) &&
                        (!m || x.mes === m) &&
                        (!p.tipo || x.tipo === p.tipo)
                    );
                })
                .map((x) => {
                    return {
                        ...x,
                        caminho: `~/mnt/oss/${x.origem}`,
                        md: x.md ? `~/mnt/oss/${x.md}` : null,
                        tem_md: Boolean(x.md),
                    };
                });
            return {
                titulo: `Prestações de contas ${p.ano}${m ? ` / ${m}` : ''}${u ? ` / ${u}` : ''}${
                    p.tipo ? ` / ${p.tipo}` : ''
                }`,
                fonte: 'pastas de prestação de contas (oss/<ano>) e prestacao-vault',
                dados: linhas,
                tabelas: [
                    {
                        colunas: [
                            ['unidade', 'Unidade'],
                            ['mes', 'Mês'],
                            ['tipo', 'Tipo'],
                            ['caminho', 'Arquivo'],
                            ['paginas', 'Págs', 'num'],
                            ['mb', 'MB', 'num'],
                            ['md', 'Versão .md'],
                        ],
                        linhas,
                    },
                ],
            };
        },
    },
    {
        nome: 'buscar_vault',
        descricao:
            'Busca textual (sem acento e sem caixa) nos .md do prestacao-vault (prestações convertidas). Devolve caminho, linha e trecho.',
        schema: {
            texto: z.string().min(2),
            ano: z.coerce.number().int().optional(),
            unidade: z.string().optional(),
            mes: z.union([z.coerce.number().int().min(1).max(12), z.string()]).optional(),
            limite: z.coerce.number().int().min(1).max(500).default(50),
        },
        async executar(p) {
            const alvo = norm(p.texto);
            const u = unidadeVault(p.unidade);
            const m = mesVault(p.mes);
            const linhas = [];
            let arquivos = 0;
            // ponytail: varredura de ~3.700 .md (~200 MB); índice FTS5 se passar de ~3 s
            const visitar = (dir, nivel) => {
                if (linhas.length >= p.limite || !fs.existsSync(dir)) {
                    return;
                }
                for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                    if (linhas.length >= p.limite) {
                        return;
                    }
                    const abs = path.join(dir, e.name);
                    if (e.isDirectory()) {
                        if (nivel === 0 && p.ano && e.name !== String(p.ano)) {
                            continue;
                        }
                        if (nivel === 1 && u && e.name !== u) {
                            continue;
                        }
                        if (nivel === 2 && m && norm(e.name) !== m) {
                            continue;
                        }
                        visitar(abs, nivel + 1);
                    } else if (/\.md$/i.test(e.name)) {
                        arquivos += 1;
                        const lns = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
                        for (let i = 0; i < lns.length && linhas.length < p.limite; i += 1) {
                            if (norm(lns[i]).includes(alvo)) {
                                linhas.push({
                                    caminho: chatOss(abs),
                                    linha: i + 1,
                                    trecho: lns[i].trim().slice(0, 300),
                                });
                            }
                        }
                    }
                }
            };
            visitar(VAULT, 0);
            return {
                titulo: `Busca no vault: "${p.texto}"`,
                fonte: 'prestacao-vault/vault (PDFs da prestação convertidos para .md)',
                dados: linhas,
                tabelas: [
                    {
                        colunas: [
                            ['caminho', 'Arquivo'],
                            ['linha', 'Linha', 'num'],
                            ['trecho', 'Trecho'],
                        ],
                        linhas,
                    },
                ],
                notas: [
                    `${arquivos} arquivos lidos${
                        linhas.length >= p.limite ? `; parou no limite de ${p.limite} trechos` : ''
                    }.`,
                ],
            };
        },
    },
    {
        nome: 'ler_documento',
        descricao:
            'Texto de um PDF ou .md das prestações, do vault ou do acervo de relatórios. Aceita o caminho como o chat vê (~/mnt/oss/..., ~/mnt/relatórios/...). PDF paginado (padrão 1-20); .md por linhas.',
        schema: {
            caminho: z.string(),
            paginas: z
                .string()
                .regex(/^\d+(-\d+)?$/)
                .optional()
                .describe('PDF: ex. 1-20 ou 5'),
            linhas: z
                .string()
                .regex(/^\d+(-\d+)?$/)
                .optional()
                .describe('.md/.txt: ex. 1-1000'),
        },
        async executar(p) {
            const abs = resolverCaminho(p.caminho);
            const faixa = (s, padrao) => {
                const [a, b] = (s || padrao).split('-').map(Number);
                return [a, b || a];
            };
            let texto;
            let info;
            if (/\.pdf$/i.test(abs)) {
                const [de, ate] = faixa(p.paginas, '1-20');
                if (ate - de > 99) {
                    throw new Error('máximo de 100 páginas por chamada');
                }
                texto = await pdfTexto(abs, de, ate);
                const paginas = paginasPdf(fs.readFileSync(abs));
                info = `páginas ${de} a ${Math.min(ate, paginas || ate)}${
                    paginas ? ` de ${paginas}` : ''
                }`;
                if (!texto.replace(/\s|\f/g, '')) {
                    texto = '_(sem camada de texto: PDF digitalizado; OCR não disponível aqui)_';
                } else {
                    texto = texto
                        .split('\f')
                        .map((t, i) => {
                            return `--- página ${de + i} ---\n${t}`;
                        })
                        .join('\n');
                }
            } else if (/\.(md|txt|csv)$/i.test(abs)) {
                const lns = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
                const [de, ate] = faixa(p.linhas, '1-1000');
                texto = lns.slice(de - 1, ate).join('\n');
                info = `linhas ${de} a ${Math.min(ate, lns.length)} de ${lns.length}`;
            } else if (/\.xlsx$/i.test(abs)) {
                throw new Error('planilha: use planilha_indicadores');
            } else {
                throw new Error('formato não suportado (use .pdf, .md, .txt ou .csv)');
            }
            return {
                titulo: `${path.basename(abs)} (${info})`,
                fonte: p.caminho,
                dados: { caminho: p.caminho, info, texto },
                texto,
            };
        },
    },
    {
        nome: 'acervo_relatorios',
        descricao:
            'Inventário dos relatórios da CAF (pasta relatórios: <ano>/<1º quad|2º quad|3º quad|anual>), só PDF, sem _duplicados, com data, páginas, se é digitalizado e a marca definitivo (versão mais antiga do mesmo ano+período+contrato+tipo; cópias de mesmo MD5 contam como uma).',
        schema: {
            ano: z.coerce.number().int().optional(),
            periodo: z.enum(['1quad', '2quad', '3quad', 'anual', 'ano']).optional(),
            contrato: z.string().optional().describe('001/2023, dona_rosa ou zanaga'),
            tipo: z.enum(['caf', 'nta', 'planilha', 'resumo', 'contabil', 'outro']).optional(),
            so_definitivos: z.boolean().default(false),
        },
        async executar(p) {
            const linhas = await acervoFiltrado(p);
            return {
                titulo: 'Acervo de relatórios',
                fonte: 'pasta de relatórios da CAF (ACERVO_RELATORIOS_DIR)',
                dados: linhas.map(({ primeira_pagina: _, ...x }) => {
                    return x;
                }),
                tabelas: [{ colunas: COLS_ACERVO, linhas }],
                notas: [
                    'Tipo pelo texto da 1ª página; nos digitalizados, pelo nome do arquivo. Data: nome do arquivo > CreationDate do PDF > modificação.',
                ],
            };
        },
    },
    {
        nome: 'planilha_indicadores',
        descricao:
            'Conteúdo das planilhas de indicadores 2026 da raiz do projeto (gerais = HM/UNACON/UPA Cillos, dona_rosa, zanaga). Sem aba: lista as abas.',
        schema: { arquivo: z.enum(['gerais', 'dona_rosa', 'zanaga']), aba: z.string().optional() },
        async executar(p) {
            const abs = path.join(RAIZ, PLANILHAS[p.arquivo]);
            if (!fs.existsSync(abs)) {
                throw new Error(`planilha não encontrada: ${PLANILHAS[p.arquivo]}`);
            }
            if (!p.aba) {
                const abas = await py(['xlsx', abs]);
                return {
                    titulo: `Abas de ${PLANILHAS[p.arquivo]}`,
                    fonte: PLANILHAS[p.arquivo],
                    dados: abas,
                    tabelas: [
                        {
                            colunas: [
                                ['aba', 'Aba'],
                                ['dimensao', 'Dimensão'],
                            ],
                            linhas: abas,
                        },
                    ],
                };
            }
            const grade = await py(['xlsx', abs, p.aba]).catch((e) => {
                throw new Error((e.stderr || e.message).trim().split('\n').pop());
            });
            const largura = Math.max(
                0,
                ...grade.map((r) => {
                    return r.length;
                }),
            );
            const colunas = Array.from({ length: largura }, (_, i) => {
                return [`c${i}`, String.fromCharCode(65 + (i % 26)).repeat(1 + Math.floor(i / 26))];
            });
            const linhas = grade.map((r) => {
                return Object.fromEntries(
                    r.map((v, i) => {
                        return [`c${i}`, v];
                    }),
                );
            });
            return {
                titulo: `${PLANILHAS[p.arquivo]}: ${p.aba}`,
                fonte: `planilha ${PLANILHAS[p.arquivo]}`,
                dados: grade,
                tabelas: [{ colunas, linhas }],
            };
        },
    },
];

module.exports = {
    ferramentas,
    acervoFiltrado,
    prestacoesDoAno,
    pdfTexto,
    py,
    PLANILHAS,
    contratoAcervo,
    unidadeVault,
    mesVault,
    dataDoNome,
    norm,
};

if (require.main === module) {
    const assert = require('assert');
    assert.strictEqual(dataDoNome('relatório quad jan abr 2024 20240725.pdf'), '2024-07-25');
    assert.strictEqual(dataDoNome('parecer anual upa dona rosa 2024 07_05_2025.pdf'), '2025-05-07');
    assert.strictEqual(dataDoNome('relatório quad set dez 2024 2025_02_27.pdf'), '2025-02-27');
    assert.strictEqual(dataDoNome('relatório anual 2024.pdf'), null);
    assert.strictEqual(
        contratoDoCaminho('2024/anual/relatorio_de_pc_anual_upa_d_rosa__2024.pdf'),
        'dona_rosa',
    );
    assert.strictEqual(contratoDoCaminho('2025/anual/HMAUNACONUPA/x.pdf'), '001/2023');
    console.error('OK');
}
