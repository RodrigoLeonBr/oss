// Reconhece comandos que incorporam ou alteram dados da prestação de contas e infere
// unidade e competência a partir do texto do comando. Usado pelo hook do Claude Code
// (.claude/hooks/pos-incorporacao.js) e pela rotina pos-incorporacao.

const PADROES = [
    { re: /convert_prestacao\.py/, tipo: 'conversao' },
    { re: /divide_grandes\.py/, tipo: 'conversao' },
    { re: /importa_origem\.py/, tipo: 'conversao' },
    { re: /extrai_escalas\.py|pegaplantao_tsv\.py/, tipo: 'escalas' },
    { re: /carregaEscalas/, tipo: 'escalas' },
    {
        re: /financeiro_historico\.py|carregaFinanceiro|carregaHistorico|carregaRepasseFonte|extraiFinanceiro/,
        tipo: 'financeiro',
    },
    { re: /extracoes:importar/, tipo: 'extracao' },
    { re: /reclassificar\.js|catalogar\.js/, tipo: 'catalogo' },
    { re: /npm run incorporar(\s|$)/, tipo: 'orquestrador' },
];

// Execuções que não mudam dado nenhum, e a própria rotina (evita laço).
const IGNORAR = /pos-incorporacao|posIncorporacao|--dry-run|--help|\s-h(\s|$)/;

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

const UNIDADES = [
    { re: /pa[\s_-]*zanaga|\bzanaga\b|upa-zan/, unidade: 'pa_zanaga' },
    { re: /dona[\s_.-]*rosa|\bd\.?\s*rosa\b|drosa|upa-dr\b/, unidade: 'upa_dona_rosa' },
    { re: /\bunacon\b/, unidade: 'unacon' },
    {
        re: /upa[\s_-]*(de\s+|av\.?\s+)?cillos?|s[aã]o[\s_-]*jos[eé]|upa-cil/,
        unidade: 'upa_cillos',
    },
    { re: /(^|[\s/\\"'=_-])hma?([\s/\\"'_-]|$)/, unidade: 'hm' },
];

const semAcento = (s) => {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
};

function detectar(comando) {
    if (!comando || IGNORAR.test(comando)) {
        return null;
    }
    const achado = PADROES.find((p) => {
        return p.re.test(comando);
    });
    return achado ? { tipo: achado.tipo, padrao: String(achado.re) } : null;
}

function inferirParametros(comando) {
    const txt = semAcento(String(comando || '')).toLowerCase();
    const arg = (nome) => {
        const m = txt.match(new RegExp(`--${nome}[=\\s]+["']?([^"'\\s]+)`));
        return m ? m[1] : null;
    };

    let unidade = arg('unidade');
    if (!unidade) {
        const u = UNIDADES.find((x) => {
            return x.re.test(txt);
        });
        unidade = u ? u.unidade : null;
    }

    let competencia = arg('competencia');
    if (!competencia) {
        const iso = txt.match(/\b(20\d\d)-(0[1-9]|1[0-2])\b/);
        if (iso) {
            competencia = `${iso[1]}-${iso[2]}`;
        }
    }
    if (!competencia) {
        const ano = arg('ano') || (txt.match(/\b(20\d\d)\b/) || [])[1] || null;
        const mesArg = arg('mes');
        const mesNome =
            mesArg ||
            Object.keys(MESES).find((m) => {
                return new RegExp(`\\b${m}\\b`).test(txt);
            });
        let mes = null;
        if (mesNome) {
            mes = MESES[mesNome] || (/^\d{1,2}$/.test(mesNome) ? mesNome.padStart(2, '0') : null);
        }
        if (ano && mes) {
            competencia = `${ano}-${mes}`;
        } else if (ano) {
            competencia = ano;
        }
    }

    return { unidade, competencia };
}

module.exports = { detectar, inferirParametros, PADROES };
