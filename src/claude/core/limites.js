// Períodos, paginação, teto de tamanho, log de auditoria, mascaramento e raízes de arquivo permitidas.
const fs = require('fs');
const path = require('path');
const { janelaDoPeriodo } = require('../../helper/periodoRelatorio');

const RAIZ = path.join(__dirname, '../../..');
const PONTE = path.join(RAIZ, 'claude-bridge');
const TETO_LINHAS = 500;
const TETO_BYTES = 200 * 1024;

const pad2 = (n) => {
    return String(n).padStart(2, '0');
};
const PERIODOS = ['mes', '1quad', '2quad', '3quad', 'trimestre', 'ano', 'acumulado'];
const FIM_QUAD = { '1quad': 4, '2quad': 8, '3quad': 12 };

/**
 * Converte ano + período do relatório para a janela do periodoRelatorio.js.
 * Quadrimestres fixos (jan–abr, mai–ago, set–dez); mes/trimestre/acumulado exigem `mes` (mês final).
 * @returns {{ mes: string, periodo: string, inicio: string, fim: string, meses: number, anual: boolean, rotulo: string }}
 */
function janela(ano, periodo, mes) {
    const a = parseInt(ano, 10);
    if (!(a >= 2000 && a <= 2100)) {
        throw new Error(`ano inválido: ${ano}`);
    }
    if (!PERIODOS.includes(periodo)) {
        throw new Error(`período inválido: ${periodo}. Use ${PERIODOS.join(', ')}`);
    }
    let m;
    let p;
    if (FIM_QUAD[periodo]) {
        m = FIM_QUAD[periodo];
        p = 'quadrimestre';
    } else if (periodo === 'ano') {
        m = 12;
        p = 'ano';
    } else {
        m = parseInt(mes, 10);
        if (!(m >= 1 && m <= 12)) {
            throw new Error(`período '${periodo}' exige mes (1 a 12)`);
        }
        p = periodo;
    }
    const mesRef = `${a}-${pad2(m)}-01`;
    const j = janelaDoPeriodo(mesRef, p);
    const rotulo =
        periodo === 'mes'
            ? `${pad2(m)}/${a}`
            : `${periodo} ${a} (${j.inicio.slice(0, 7)} a ${j.fim.slice(0, 7)})`;
    return { mes: mesRef, periodo: p, ...j, rotulo };
}

/** 'AAAA-MM' ou 'AAAAMM' → 'AAAA-MM-01' */
function mesYmd(v) {
    const mt = String(v || '').match(/^(\d{4})-?(\d{2})/);
    if (!mt) {
        throw new Error(`mês inválido: ${v} (use AAAA-MM)`);
    }
    return `${mt[1]}-${mt[2]}-01`;
}

function paginar(linhas, pagina = 1, porPagina = TETO_LINHAS) {
    const pp = Math.min(Math.max(parseInt(porPagina, 10) || TETO_LINHAS, 1), TETO_LINHAS);
    const pg = Math.max(parseInt(pagina, 10) || 1, 1);
    const total = linhas.length;
    return {
        linhas: linhas.slice((pg - 1) * pp, pg * pp),
        total,
        pagina: pg,
        paginas: Math.max(1, Math.ceil(total / pp)),
    };
}

// Qualquer valor de variável sensível do .env é trocado por *** antes de sair ou ir para o log.
const segredos = () => {
    return Object.entries(process.env)
        .filter(([k, v]) => {
            return /PASS|SECRET|TOKEN|KEY/i.test(k) && v && v.length >= 4;
        })
        .map(([, v]) => {
            return v;
        });
};

function mascarar(texto) {
    let s = String(texto);
    for (const v of segredos()) {
        s = s.split(v).join('***');
    }
    return s;
}

function escreverAtomico(arquivo, conteudo) {
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    const tmp = `${arquivo}.tmp`;
    fs.writeFileSync(tmp, conteudo);
    fs.renameSync(tmp, arquivo);
}

const idSeguro = (id) => {
    return String(id || Date.now())
        .replace(/[^\w-]/g, '_')
        .slice(0, 80);
};

/** Grava em claude-bridge/outbox e devolve o caminho local e o caminho visto pelo chat. */
function gravarOutbox(id, ext, conteudo) {
    const nome = `${idSeguro(id)}.${ext}`;
    escreverAtomico(path.join(PONTE, 'outbox', nome), conteudo);
    return {
        local: path.join(PONTE, 'outbox', nome),
        chat: `~/mnt/oss/claude-bridge/outbox/${nome}`,
    };
}

function registrar(entrada) {
    try {
        const dia = new Date().toISOString().slice(0, 10);
        fs.mkdirSync(path.join(PONTE, 'logs'), { recursive: true });
        fs.appendFileSync(
            path.join(PONTE, 'logs', `${dia}.jsonl`),
            `${mascarar(JSON.stringify(entrada))}\n`,
        );
    } catch (e) {
        /* log de auditoria nunca derruba a consulta */
    }
}

// ── Arquivos: só dentro das raízes permitidas ──────────────────────────────
const acervoDir = () => {
    return process.env.ACERVO_RELATORIOS_DIR || '';
};

function raizesPermitidas() {
    const anos = fs
        .readdirSync(RAIZ)
        .filter((d) => {
            return /^\d{4}$/.test(d);
        })
        .map((d) => {
            return path.join(RAIZ, d);
        });
    return [...anos, path.join(RAIZ, 'prestacao-vault', 'vault'), acervoDir()].filter(Boolean);
}

const norm = (p) => {
    return path.resolve(p).toLowerCase();
};

/** Aceita caminho absoluto, relativo à raiz do repo, ou como o chat vê (~/mnt/oss/..., ~/mnt/relatórios/...). */
function resolverCaminho(caminho) {
    let p = String(caminho || '')
        .trim()
        .replace(/\\/g, '/');
    if (!p) {
        throw new Error('caminho vazio');
    }
    if (/^~\/mnt\/oss\//.test(p)) {
        p = path.join(RAIZ, p.replace(/^~\/mnt\/oss\//, ''));
    } else if (/^~\/mnt\/relat[oó]rios\//i.test(p)) {
        p = path.join(acervoDir(), p.replace(/^~\/mnt\/relat[oó]rios\//i, ''));
    } else if (!path.isAbsolute(p)) {
        p = path.join(RAIZ, p);
    }
    const abs = path.resolve(p);
    const ok =
        raizesPermitidas().some((r) => {
            return norm(abs).startsWith(norm(r) + path.sep);
        }) ||
        (path.dirname(norm(abs)) === norm(RAIZ) && /\.xlsx$/i.test(abs));
    if (!ok) {
        throw new Error(`caminho fora das pastas permitidas: ${caminho}`);
    }
    if (!fs.existsSync(abs)) {
        throw new Error(`arquivo não encontrado: ${caminho}`);
    }
    return abs;
}

module.exports = {
    RAIZ,
    PONTE,
    TETO_LINHAS,
    TETO_BYTES,
    PERIODOS,
    janela,
    mesYmd,
    paginar,
    mascarar,
    escreverAtomico,
    gravarOutbox,
    registrar,
    idSeguro,
    resolverCaminho,
    acervoDir,
};

if (require.main === module) {
    const assert = require('assert');
    const j = janela(2026, '2quad');
    assert.deepStrictEqual([j.inicio, j.fim, j.meses], ['2026-05-01', '2026-08-01', 4]);
    assert.deepStrictEqual(
        [janela(2026, '1quad').inicio, janela(2026, '3quad').fim],
        ['2026-01-01', '2026-12-01'],
    );
    assert.strictEqual(janela(2025, 'ano').anual, true);
    assert.throws(() => {
        return janela(2026, 'mes');
    }, /exige mes/);
    assert.strictEqual(janela(2026, 'mes', 3).inicio, '2026-03-01');
    assert.strictEqual(paginar([1, 2, 3], 2, 2).linhas[0], 3);
    assert.throws(() => {
        return resolverCaminho('../../.env');
    }, /fora das pastas/);
    assert.throws(() => {
        return resolverCaminho('.env');
    }, /fora das pastas/);
    console.error('OK');
}
