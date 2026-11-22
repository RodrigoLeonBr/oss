// Tipo do documento pelo nome do arquivo (prestacao-vault/regras_tipo.json). Mesma regra que
// convert_prestacao.py aplica na conversão, para reclassificar o que já foi convertido sem
// reconverter e para o catálogo.

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');
const ARQ_REGRAS = path.join(RAIZ, 'prestacao-vault', 'regras_tipo.json');

const slug = (s) => {
    return String(s || '')
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
};

function carregarRegras(arq = ARQ_REGRAS) {
    const d = JSON.parse(fs.readFileSync(arq, 'utf8'));
    return {
        versao: d.versao,
        tipos: d.tipos || {},
        regras: d.regras.map((r) => {
            return { ...r, re: new RegExp(r.padrao) };
        }),
    };
}

function classificarPorNome(nome, regras) {
    const s = slug(String(nome).replace(/\.(md|pdf)$/i, ''));
    const r = regras.regras.find((x) => {
        return x.re.test(s);
    });
    return r ? { tipo: r.tipo, regra: r.id } : null;
}

module.exports = { carregarRegras, classificarPorNome, slug, ARQ_REGRAS };
