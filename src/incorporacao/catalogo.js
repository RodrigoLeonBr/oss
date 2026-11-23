#!/usr/bin/env node
// Catálogo do vault e índice de busca (SQLite em prestacao-vault/indice/vault.db, fora do git).
//
// documentos  um registro por .md (frontmatter, hash, ativo), cumulativo: substitui manifest.csv
// pdfs        inventário dos PDFs de origem (2025/, 2026/), para saber o que falta converter
// trechos     índice FTS5 (unicode61, sem acento) por seção e página, usado pela buscar_vault
//
// Incremental: só relê o .md cujo tamanho ou data mudou. Também gera prestacao-vault/ESTADO.md.
// Uso:
//   npm run catalogo:atualizar                          (tudo)
//   npm run catalogo:atualizar -- --unidade=pa_zanaga,upa_dona_rosa --ano=2026
//   npm run catalogo:atualizar -- --banco               (também sincroniza tb_documento no MySQL)
//   npm run catalogo:atualizar -- --estado              (só regenera ESTADO.md)
// Requer Node 22.13+ (node:sqlite com FTS5).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RAIZ = path.resolve(__dirname, '..', '..');
const PV = path.join(RAIZ, 'prestacao-vault');
const VAULT = path.join(PV, 'vault');
const ARQ_DB = path.join(PV, 'indice', 'vault.db');
const ARQ_ESTADO = path.join(PV, 'ESTADO.md');
const ANOS_PDF = ['2025', '2026'];
const MESES = {
    janeiro: '01',
    fevereiro: '02',
    marco: '03',
    abril: '04',
    maio: '05',
    junho: '06',
    julho: '07',
    agosto: '08',
    setembro: '09',
    outubro: '10',
    novembro: '11',
    dezembro: '12',
};
const TAM_TRECHO = 1500;
const VERSAO_INDICE = '2'; // mudar quando trechosDe mudar: força reindexação

let sqlite = null;
function moduloSqlite() {
    if (sqlite === null) {
        try {
            const original = process.emitWarning;
            process.emitWarning = (w, ...r) => {
                return String(w).includes('SQLite') ? undefined : original.call(process, w, ...r);
            };
            // eslint-disable-next-line global-require
            sqlite = require('node:sqlite');
            process.emitWarning = original;
        } catch (e) {
            sqlite = false;
        }
    }
    return sqlite;
}

// O node:sqlite do Node 22.13 (Windows) não traz FTS5; versões mais novas trazem. Sem FTS5 o catálogo
// funciona (documentos, pdfs, ESTADO.md) e a busca volta à varredura; o índice é completado quando o Node tiver FTS5.
let fts5 = null;
function temFts5() {
    if (fts5 === null) {
        try {
            const m = moduloSqlite();
            const t = new m.DatabaseSync(':memory:');
            t.exec('CREATE VIRTUAL TABLE t USING fts5(x)');
            t.close();
            fts5 = true;
        } catch (e) {
            fts5 = false;
        }
    }
    return fts5;
}

function abrir({ somenteLeitura = false } = {}) {
    const m = moduloSqlite();
    if (!m) {
        throw new Error('node:sqlite indisponível (Node 22.13+ necessário)');
    }
    if (somenteLeitura && !fs.existsSync(ARQ_DB)) {
        return null;
    }
    fs.mkdirSync(path.dirname(ARQ_DB), { recursive: true });
    const db = new m.DatabaseSync(ARQ_DB, somenteLeitura ? { readOnly: true } : {});
    if (!somenteLeitura) {
        db.exec(`
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS documentos (
                caminho_md TEXT PRIMARY KEY, origem TEXT, ano INTEGER, unidade TEXT, mes TEXT, competencia TEXT,
                tipo TEXT, subpath TEXT, assunto TEXT, paginas INTEGER, scanned INTEGER, ocr TEXT, convertido_em TEXT,
                bytes INTEGER, mtime INTEGER, hash TEXT, ativo INTEGER NOT NULL DEFAULT 1, catalogado_em TEXT);
            CREATE INDEX IF NOT EXISTS idx_doc_unid ON documentos (unidade, ano, mes, tipo);
            CREATE INDEX IF NOT EXISTS idx_doc_origem ON documentos (origem);
            CREATE TABLE IF NOT EXISTS pdfs (
                origem TEXT PRIMARY KEY, ano INTEGER, unidade TEXT, mes TEXT, bytes INTEGER, mtime INTEGER,
                ativo INTEGER NOT NULL DEFAULT 1, visto_em TEXT);
            CREATE TABLE IF NOT EXISTS meta (chave TEXT PRIMARY KEY, valor TEXT);
        `);
        if (temFts5()) {
            db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS trechos USING fts5(
                texto, caminho_md UNINDEXED, ano UNINDEXED, unidade UNINDEXED, mes UNINDEXED, tipo UNINDEXED,
                pagina UNINDEXED, secao UNINDEXED, linha UNINDEXED, tokenize = 'unicode61 remove_diacritics 2')`);
        }
        const cols = db.prepare('PRAGMA table_info(documentos)').all().map((c) => c.name);
        if (!cols.includes('indexado_fts')) {
            db.exec('ALTER TABLE documentos ADD COLUMN indexado_fts INTEGER NOT NULL DEFAULT 1');
        }
    }
    return db;
}

const rel = (abs, base = RAIZ) => {
    return path.relative(base, abs).split(path.sep).join('/');
};
const semAcento = (s) => {
    return String(s || '')
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();
};

function lerFrontmatter(texto) {
    const m = texto.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const fm = {};
    if (!m) {
        return { fm, corpoInicio: 0 };
    }
    m[1].split(/\r?\n/).forEach((l) => {
        const k = l.match(/^([a-z_]+):\s*(.*)$/);
        if (!k) {
            return;
        }
        let v = k[2].trim();
        if (v === 'null' || v === '') {
            v = null;
        } else if (/^".*"$/.test(v)) {
            v = v.slice(1, -1).replace(/\\"/g, '"');
        } else if (v === 'true' || v === 'false') {
            v = v === 'true';
        } else if (/^\d+$/.test(v)) {
            v = Number(v);
        }
        fm[k[1]] = v;
    });
    return { fm, corpoInicio: texto.slice(0, m.index + m[0].length).split('\n').length };
}

const competenciaDe = (ano, mes) => {
    return ano && MESES[semAcento(mes)] ? `${ano}-${MESES[semAcento(mes)]}` : null;
};

// Divide o corpo em trechos por título e por marcador de página, com a linha inicial.
// Dois formatos de página: título ("## Página 3", OCR do INDSH: o texto seguinte é da página 3)
// e rodapé ("Página 16" em linha solta, SCMC: o texto anterior é da página 16).
const RE_PAG_TITULO = /^\s*#+\s*(?:\*\*)?P[aá]gina\s+(\d+)\b/i;
const RE_PAG_RODAPE = /^\s*(?:\*\*)?P[aá]gina\s+(\d+)(?:\s+de\s+\d+)?(?:\*\*)?\s*$/i;
const RE_TITULO = /^\s*#{1,6}\s+(.*\S)/;
function trechosDe(texto, linhaInicial = 1) {
    const linhas = texto.split(/\r?\n/);
    const saida = [];
    let pagina = null;
    let provisoria = false; // página deduzida do rodapé anterior (N + 1), confirmada no próximo rodapé
    let desde = 0; // primeiro trecho desde o último marcador de página
    let secao = null;
    let buf = [];
    let inicio = linhaInicial;
    const fechar = () => {
        const t = buf.join('\n').trim();
        if (t) {
            saida.push({ texto: t, pagina, secao, linha: inicio });
        }
        buf = [];
    };
    linhas.forEach((l, i) => {
        const n = linhaInicial + i;
        const pgT = l.match(RE_PAG_TITULO);
        const pgR = !pgT && l.match(RE_PAG_RODAPE);
        if (pgR) {
            fechar();
            const num = Number(pgR[1]);
            for (let k = desde; k < saida.length; k += 1) {
                saida[k].pagina = num;
            }
            desde = saida.length;
            pagina = num + 1;
            provisoria = true;
            inicio = n + 1;
            return;
        }
        const ti = l.match(RE_TITULO);
        if (pgT || ti || buf.join('\n').length > TAM_TRECHO) {
            fechar();
            inicio = n;
            if (pgT) {
                pagina = Number(pgT[1]);
                provisoria = false;
                desde = saida.length;
            } else if (ti) {
                secao = ti[1].replace(/\*+/g, '').trim().slice(0, 200);
            }
        }
        buf.push(l);
    });
    fechar();
    if (provisoria) {
        for (let k = desde; k < saida.length; k += 1) {
            saida[k].pagina = pagina;
        }
    }
    return saida;
}

function listar(dir, filtro, saida = []) {
    if (!fs.existsSync(dir)) {
        return saida;
    }
    fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) {
            listar(abs, filtro, saida);
        } else if (filtro(e.name)) {
            saida.push(abs);
        }
    });
    return saida;
}

function escopoDirs(base, anos, unidades) {
    const as =
        anos ||
        (fs.existsSync(base)
            ? fs.readdirSync(base).filter((a) => {
                  return /^20\d\d$/.test(a);
              })
            : []);
    const dirs = [];
    as.forEach((a) => {
        const dA = path.join(base, String(a));
        if (!fs.existsSync(dA)) {
            return;
        }
        (unidades || fs.readdirSync(dA)).forEach((u) => {
            if (fs.existsSync(path.join(dA, u))) {
                dirs.push({ ano: Number(a), unidade: u, dir: path.join(dA, u) });
            }
        });
    });
    return dirs;
}

function carregarUnidades() {
    const d = JSON.parse(fs.readFileSync(path.join(PV, 'units.json'), 'utf8'));
    const mapa = Object.entries(d.map).map(([k, v]) => {
        return [semAcento(k).replace(/\s+/g, ' '), v];
    });
    mapa.sort((a, b) => {
        return b[0].length - a[0].length;
    });
    return (nome) => {
        const n = semAcento(nome).replace(/\s+/g, ' ');
        const e = mapa.find(([k]) => {
            return n === k;
        });
        return e ? e[1] : null;
    };
}

// PDFs de origem: 2026/<mes>/<unidade>/... e 2025/<unidade>/<mes>/...
function inventariarPdfs(db, { anos, unidades }) {
    const unidadeDe = carregarUnidades();
    const agora = new Date().toISOString();
    const up =
        db.prepare(`INSERT INTO pdfs (origem, ano, unidade, mes, bytes, mtime, ativo, visto_em) VALUES (?,?,?,?,?,?,1,?)
        ON CONFLICT(origem) DO UPDATE SET ano=excluded.ano, unidade=excluded.unidade, mes=excluded.mes, bytes=excluded.bytes,
        mtime=excluded.mtime, ativo=1, visto_em=excluded.visto_em`);
    let n = 0;
    (anos || ANOS_PDF).forEach((ano) => {
        const dA = path.join(RAIZ, String(ano));
        if (!fs.existsSync(dA)) {
            return;
        }
        listar(dA, (f) => {
            return /\.pdf$/i.test(f);
        }).forEach((abs) => {
            const partes = rel(abs, dA).split('/');
            const [p1, p2] = partes;
            let mes;
            let unidade;
            if (MESES[semAcento(p1)] || semAcento(p1) === 'quadrimestral') {
                mes = semAcento(p1);
                unidade = unidadeDe(p2 || '');
            } else {
                unidade = unidadeDe(p1);
                mes = semAcento(p2 || '');
            }
            if (unidades && !unidades.includes(unidade)) {
                return;
            }
            const st = fs.statSync(abs);
            up.run(rel(abs), Number(ano), unidade, mes, st.size, Math.round(st.mtimeMs), agora);
            n += 1;
        });
    });
    db.prepare('UPDATE pdfs SET ativo = 0 WHERE visto_em < ?').run(agora.slice(0, 10));
    return n;
}

function catalogar({ anos = null, unidades = null, pdfs = true, tempoMaxMs = 0 } = {}) {
    const db = abrir();
    const t0 = Date.now();
    const agora = new Date().toISOString();
    const sel = db.prepare('SELECT bytes, mtime, ativo, indexado_fts FROM documentos WHERE caminho_md = ?');
    const comFts = temFts5();
    const up =
        db.prepare(`INSERT INTO documentos (caminho_md, origem, ano, unidade, mes, competencia, tipo, subpath, assunto,
        paginas, scanned, ocr, convertido_em, bytes, mtime, hash, ativo, catalogado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)
        ON CONFLICT(caminho_md) DO UPDATE SET origem=excluded.origem, ano=excluded.ano, unidade=excluded.unidade, mes=excluded.mes,
        competencia=excluded.competencia, tipo=excluded.tipo, subpath=excluded.subpath, assunto=excluded.assunto,
        paginas=excluded.paginas, scanned=excluded.scanned, ocr=excluded.ocr, convertido_em=excluded.convertido_em,
        bytes=excluded.bytes, mtime=excluded.mtime, hash=excluded.hash, ativo=1, catalogado_em=excluded.catalogado_em`);
    const toca = db.prepare('UPDATE documentos SET catalogado_em = ? WHERE caminho_md = ?');
    const apagaTrechos = comFts ? db.prepare('DELETE FROM trechos WHERE caminho_md = ?') : null;
    const insTrecho = comFts
        ? db.prepare(
        'INSERT INTO trechos (texto, caminho_md, ano, unidade, mes, tipo, pagina, secao, linha) VALUES (?,?,?,?,?,?,?,?,?)',
    )
        : null;
    const marcaIndexado = db.prepare('UPDATE documentos SET indexado_fts = ? WHERE caminho_md = ?');
    const r = {
        lidos: 0,
        inalterados: 0,
        novos_ou_alterados: 0,
        removidos: 0,
        trechos: 0,
        pdfs: 0,
        incompleto: false,
        indice_busca: temFts5() ? 'fts5' : 'indisponivel: Node sem FTS5; busca por varredura até atualizar o Node',
    };
    const versaoGravada = (
        db.prepare("SELECT valor FROM meta WHERE chave = 'versao_indice'").get() || {}
    ).valor;
    if (versaoGravada !== VERSAO_INDICE) {
        db.prepare('UPDATE documentos SET mtime = -1').run();
        db.prepare(
            "INSERT INTO meta (chave, valor) VALUES ('versao_indice', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor",
        ).run(VERSAO_INDICE);
    }
    const esgotou = () => {
        return tempoMaxMs > 0 && Date.now() - t0 > tempoMaxMs;
    };

    escopoDirs(VAULT, anos, unidades).forEach(({ ano, unidade, dir }) => {
        if (r.incompleto) {
            return;
        }
        const arquivos = listar(dir, (f) => {
            return /\.md$/i.test(f);
        });
        db.exec('BEGIN');
        try {
            let pendentesNoLote = 0;
            arquivos.forEach((abs) => {
                if (r.incompleto) {
                    return;
                }
                if (esgotou()) {
                    r.incompleto = true;
                    return;
                }
                if (pendentesNoLote >= 200) {
                    db.exec('COMMIT');
                    db.exec('BEGIN');
                    pendentesNoLote = 0;
                }
                const caminho = rel(abs, VAULT);
                const st = fs.statSync(abs);
                const atual = sel.get(caminho);
                r.lidos += 1;
                if (
                    atual &&
                    atual.ativo === 1 &&
                    atual.bytes === st.size &&
                    atual.mtime === Math.round(st.mtimeMs) &&
                    (atual.indexado_fts === 1 || !comFts)
                ) {
                    toca.run(agora, caminho);
                    r.inalterados += 1;
                    return;
                }
                const texto = fs.readFileSync(abs, 'utf8');
                const { fm, corpoInicio } = lerFrontmatter(texto);
                const hash = crypto.createHash('sha1').update(texto).digest('hex');
                const mes = fm.mes || caminho.split('/')[2] || null;
                const tipo = fm.tipo || caminho.split('/')[3] || null;
                up.run(
                    caminho,
                    fm.origem || null,
                    ano,
                    fm.unidade || unidade,
                    mes,
                    competenciaDe(ano, mes),
                    tipo,
                    fm.subpath || null,
                    fm.assunto || path.basename(abs, '.md'),
                    fm.paginas ?? null,
                    fm.scanned ? 1 : 0,
                    fm.ocr || null,
                    fm.convertido_em || null,
                    st.size,
                    Math.round(st.mtimeMs),
                    hash,
                    agora,
                );
                if (comFts) {
                    apagaTrechos.run(caminho);
                    const corpo = texto.split('\n').slice(corpoInicio).join('\n');
                    trechosDe(corpo, corpoInicio + 1).forEach((t) => {
                    insTrecho.run(
                        t.texto,
                        caminho,
                        ano,
                        fm.unidade || unidade,
                        mes,
                        tipo,
                        t.pagina,
                        t.secao,
                        t.linha,
                    );
                    r.trechos += 1;
                    });
                }
                marcaIndexado.run(comFts ? 1 : 0, caminho);
                r.novos_ou_alterados += 1;
                pendentesNoLote += 1;
            });
            if (r.incompleto) {
                db.exec('COMMIT');
                return;
            }
            // o que estava ativo neste escopo e não foi visto agora saiu do disco (ou foi movido)
            const sumidos = db
                .prepare(
                    'SELECT caminho_md FROM documentos WHERE ano = ? AND unidade = ? AND ativo = 1 AND catalogado_em < ?',
                )
                .all(ano, unidade, agora);
            sumidos.forEach(({ caminho_md: c }) => {
                db.prepare('UPDATE documentos SET ativo = 0 WHERE caminho_md = ?').run(c);
                if (comFts) {
                    apagaTrechos.run(c);
                }
                r.removidos += 1;
            });
            db.exec('COMMIT');
        } catch (e) {
            db.exec('ROLLBACK');
            throw e;
        }
    });
    if (pdfs && !r.incompleto) {
        r.pdfs = inventariarPdfs(db, { anos: anos ? anos.map(String) : null, unidades });
    }
    db.prepare(
        'INSERT INTO meta (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor',
    ).run('catalogado_em', agora);
    db.close();
    return { ...r, ms: Date.now() - t0 };
}

// Erros de conversão ainda sem .md, pelo convert.log (última ocorrência de cada arquivo).
function errosConversao(origensComMd) {
    const arq = path.join(PV, 'convert.log');
    if (!fs.existsSync(arq)) {
        return [];
    }
    const ult = new Map();
    fs.readFileSync(arq, 'utf8')
        .split(/\r?\n/)
        .forEach((l) => {
            const m = l.match(/^(\S+ \S+) ERROR ERRO(?: rede)? (.+?\.pdf)(?: \(|:)\s*(.*)$/i);
            if (m) {
                ult.set(m[2].trim(), {
                    em: m[1].slice(0, 16),
                    origem: m[2].trim(),
                    erro: m[3].slice(0, 120),
                });
            }
        });
    return [...ult.values()].filter((e) => {
        return !origensComMd.has(e.origem);
    });
}

function gerarEstado() {
    const db = abrir();
    const ordemMes = (m) => {
        return MESES[m] ? Number(MESES[m]) : 13;
    };
    const docs = db
        .prepare(
            `SELECT ano, unidade, mes, COUNT(*) md, SUM(tipo = 'outros') outros, SUM(scanned) digitalizados
        FROM documentos WHERE ativo = 1 GROUP BY ano, unidade, mes`,
        )
        .all();
    const tipos = db
        .prepare(
            `SELECT ano, unidade, tipo, COUNT(*) n FROM documentos WHERE ativo = 1 GROUP BY ano, unidade, tipo`,
        )
        .all();
    const pdfs = db
        .prepare(
            `SELECT ano, unidade, mes, COUNT(*) n FROM pdfs WHERE ativo = 1 GROUP BY ano, unidade, mes`,
        )
        .all();
    const origens = new Set(
        db
            .prepare('SELECT origem FROM documentos WHERE ativo = 1 AND origem IS NOT NULL')
            .all()
            .map((x) => {
                return x.origem;
            }),
    );
    const semMd = db
        .prepare('SELECT origem, ano, unidade, mes FROM pdfs WHERE ativo = 1')
        .all()
        .filter((p) => {
            return !origens.has(p.origem);
        });
    const mdSemPdf = db
        .prepare(
            `SELECT d.ano, d.unidade, d.mes, COUNT(*) n FROM documentos d LEFT JOIN pdfs p ON p.origem = d.origem AND p.ativo = 1
        WHERE d.ativo = 1 AND p.origem IS NULL GROUP BY d.ano, d.unidade, d.mes`,
        )
        .all();
    const quando = (db.prepare("SELECT valor FROM meta WHERE chave = 'catalogado_em'").get() || {})
        .valor;
    db.close();

    const chave = (o) => {
        return `${o.ano}|${o.unidade}|${o.mes}`;
    };
    const mapa = new Map();
    docs.forEach((d) => {
        return mapa.set(chave(d), { ...d, pdfs: 0, sem_md: 0, sem_pdf: 0 });
    });
    pdfs.forEach((p) => {
        const k = chave(p);
        if (!mapa.has(k)) {
            mapa.set(k, {
                ano: p.ano,
                unidade: p.unidade,
                mes: p.mes,
                md: 0,
                outros: 0,
                digitalizados: 0,
                pdfs: 0,
                sem_md: 0,
                sem_pdf: 0,
            });
        }
        mapa.get(k).pdfs = p.n;
    });
    semMd.forEach((p) => {
        const k = chave(p);
        if (mapa.has(k)) {
            mapa.get(k).sem_md += 1;
        }
    });
    mdSemPdf.forEach((x) => {
        const k = chave(x);
        if (mapa.has(k)) {
            mapa.get(k).sem_pdf = x.n;
        }
    });
    const semMdSet = new Set(
        semMd.map((p) => {
            return p.origem;
        }),
    );
    const erros = errosConversao(origens).filter((e) => {
        return semMdSet.has(e.origem);
    });

    const linhas = [
        '# Estado do acervo da prestação de contas',
        '',
        `Gerado por \`npm run catalogo:atualizar\` a partir do catálogo (prestacao-vault/indice/vault.db), catalogado em ${
            quando || '?'
        }. Não editar à mão.`,
        '',
        'PDFs: arquivos hoje em 2025/ e 2026/. PDFs sem .md: ainda não convertidos (ou divididos em partes, quando a origem do .md é a parte); a lista está ao final. .md sem PDF local: convertidos de PDFs que não estão mais nas pastas 2025/ e 2026/ (por exemplo, importados da pasta original da prestação); o texto continua válido.',
        '',
    ];
    const grupos = [
        ...new Set(
            [...mapa.values()].map((v) => {
                return `${v.ano}|${v.unidade}`;
            }),
        ),
    ].sort();
    grupos.forEach((g) => {
        const [ano, unidade] = g.split('|');
        const regs = [...mapa.values()]
            .filter((v) => {
                return `${v.ano}|${v.unidade}` === g;
            })
            .sort((a, b) => {
                return ordemMes(a.mes) - ordemMes(b.mes);
            });
        const tot = regs.reduce(
            (t, v) => {
                return {
                    pdfs: t.pdfs + v.pdfs,
                    md: t.md + v.md,
                    sem: t.sem + v.sem_md,
                    semPdf: t.semPdf + v.sem_pdf,
                    out: t.out + (v.outros || 0),
                };
            },
            { pdfs: 0, md: 0, sem: 0, semPdf: 0, out: 0 },
        );
        linhas.push(`## ${ano} | ${unidade === 'null' ? 'unidade não identificada' : unidade}`, '');
        linhas.push(
            '| Mês | PDFs | .md | PDFs sem .md | .md sem PDF local | em outros | digitalizados |',
            '|---|---|---|---|---|---|---|',
        );
        regs.forEach((v) => {
            return linhas.push(
                `| ${v.mes} | ${v.pdfs} | ${v.md} | ${v.sem_md} | ${v.sem_pdf} | ${
                    v.outros || 0
                } | ${v.digitalizados || 0} |`,
            );
        });
        linhas.push(
            `| **total** | **${tot.pdfs}** | **${tot.md}** | **${tot.sem}** | **${tot.semPdf}** | **${tot.out}** | |`,
            '',
        );
        const ts = tipos
            .filter((t) => {
                return `${t.ano}|${t.unidade}` === g;
            })
            .sort((a, b) => {
                return b.n - a.n;
            });
        linhas.push(
            `Tipos: ${ts
                .map((t) => {
                    return `${t.tipo} ${t.n}`;
                })
                .join(', ')}.`,
            '',
        );
    });
    linhas.push('## Erros de conversão sem .md', '');
    if (!erros.length) {
        linhas.push('Nenhum.', '');
    } else {
        linhas.push('| Último erro | Arquivo | Mensagem |', '|---|---|---|');
        erros.forEach((e) => {
            return linhas.push(`| ${e.em} | ${e.origem} | ${e.erro.replace(/\|/g, '/')} |`);
        });
        linhas.push('');
    }
    linhas.push('## PDFs sem .md', '');
    if (!semMd.length) {
        linhas.push('Nenhum.');
    } else {
        semMd
            .sort((a, b) => {
                return a.origem.localeCompare(b.origem);
            })
            .forEach((p) => {
                return linhas.push(`- ${p.origem}`);
            });
    }
    fs.writeFileSync(ARQ_ESTADO, `${linhas.join('\n')}\n`);
    return {
        arquivo: rel(ARQ_ESTADO),
        grupos: grupos.length,
        pdfs_sem_md: semMd.length,
        erros: erros.length,
    };
}

// Busca no índice. Frase exata por padrão; com operadores (AND, OR, NOT, *) passa como consulta FTS5.
function buscar({ texto, ano, unidade, mes, tipo, limite = 50 }) {
    if (!temFts5()) {
        return null;
    }
    const db = abrir({ somenteLeitura: true });
    if (!db) {
        return null;
    }
    const operadores = /\b(AND|OR|NOT|NEAR)\b|\*|"/.test(texto);
    const consulta = operadores ? texto : `"${String(texto).replace(/"/g, ' ')}"`;
    const conds = ['trechos MATCH ?'];
    const vals = [consulta];
    if (ano) {
        conds.push('ano = ?');
        vals.push(Number(ano));
    }
    if (unidade) {
        conds.push('unidade = ?');
        vals.push(unidade);
    }
    if (mes) {
        conds.push('mes = ?');
        vals.push(mes);
    }
    if (tipo) {
        conds.push('tipo = ?');
        vals.push(tipo);
    }
    const linhas = db
        .prepare(
            `SELECT caminho_md, pagina, linha, secao, tipo,
            snippet(trechos, 0, '**', '**', ' ... ', 24) AS trecho
        FROM trechos WHERE ${conds.join(' AND ')} ORDER BY bm25(trechos) LIMIT ?`,
        )
        .all(...vals, limite);
    const quando = (db.prepare("SELECT valor FROM meta WHERE chave = 'catalogado_em'").get() || {})
        .valor;
    db.close();
    return {
        linhas: linhas.map((l) => {
            return { ...l };
        }),
        catalogado_em: quando,
    };
}

function listarDocumentos({ ano, unidade, mes, tipo, limite = 500 }) {
    const db = abrir({ somenteLeitura: true });
    if (!db) {
        return null;
    }
    const conds = ['ativo = 1'];
    const vals = [];
    [
        ['ano', ano && Number(ano)],
        ['unidade', unidade],
        ['mes', mes],
        ['tipo', tipo],
    ].forEach(([c, v]) => {
        if (v) {
            conds.push(`${c} = ?`);
            vals.push(v);
        }
    });
    const w = conds.join(' AND ');
    const resumo = db
        .prepare(
            `SELECT unidade, mes, tipo, COUNT(*) n FROM documentos WHERE ${w} GROUP BY unidade, mes, tipo ORDER BY unidade, mes, tipo`,
        )
        .all(...vals);
    const docs = db
        .prepare(
            `SELECT caminho_md, origem, unidade, mes, competencia, tipo, assunto, paginas, scanned FROM documentos WHERE ${w}
        ORDER BY unidade, mes, tipo, caminho_md LIMIT ?`,
        )
        .all(...vals, limite);
    const quando = (db.prepare("SELECT valor FROM meta WHERE chave = 'catalogado_em'").get() || {})
        .valor;
    db.close();
    return {
        resumo: resumo.map((x) => {
            return { ...x };
        }),
        documentos: docs.map((x) => {
            return { ...x };
        }),
        catalogado_em: quando,
    };
}

module.exports = {
    temFts5,
    catalogar,
    gerarEstado,
    buscar,
    listarDocumentos,
    trechosDe,
    lerFrontmatter,
    abrir,
    ARQ_DB,
    moduloSqlite,
};

if (require.main === module) {
    const a = {};
    process.argv.slice(2).forEach((s) => {
        const m = s.match(/^--([^=]+)(?:=(.*))?$/);
        if (m) {
            a[m[1]] = m[2] === undefined ? true : m[2];
        }
    });
    (async () => {
        const saida = {};
        if (!a.estado) {
            saida.catalogo = catalogar({
                anos: a.ano ? String(a.ano).split(',').map(Number) : null,
                unidades: a.unidade ? String(a.unidade).split(',') : null,
                pdfs: !a['sem-pdfs'],
                tempoMaxMs: a['tempo-max'] ? Number(a['tempo-max']) * 1000 : 0,
            });
        }
        saida.estado = gerarEstado();
        if (a.banco) {
            // eslint-disable-next-line global-require
            saida.banco = await require('./sincronizarBanco').sincronizar();
        }
        process.stdout.write(`${JSON.stringify(saida, null, 2)}\n`);
    })().catch((e) => {
        process.stderr.write(`${e.stack || e}\n`);
        process.exitCode = 1;
    });
}
