#!/usr/bin/env node
// Reclassifica .md já convertidos que estão no tipo "outros", pelo nome do arquivo
// (prestacao-vault/regras_tipo.json), sem reconverter o PDF. Move o .md junto com os
// arquivos irmãos (<stem>.tables.json, <stem>.escala.tsv, <stem>.escala.json), troca só a
// linha tipo do frontmatter e atualiza md_path do .escala.json.
//
// Uso:
//   npm run reclassificar -- --unidade=pa_zanaga,upa_dona_rosa            (simulação, padrão)
//   npm run reclassificar -- --unidade=pa_zanaga --aplicar                (move de fato)
// Sempre grava o plano em prestacao-vault/reclassificacao/<data>-<modo>.csv.

const fs = require('fs');
const path = require('path');
const { carregarRegras, classificarPorNome } = require('./tipos');

const RAIZ = path.resolve(__dirname, '..', '..');
const VAULT = path.join(RAIZ, 'prestacao-vault', 'vault');
const DIR_PLANOS = path.join(RAIZ, 'prestacao-vault', 'reclassificacao');

function listarMd(dir) {
    const saida = [];
    if (!fs.existsSync(dir)) {
        return saida;
    }
    fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) {
            saida.push(...listarMd(abs));
        } else if (/\.md$/i.test(e.name)) {
            saida.push(abs);
        }
    });
    return saida;
}

function irmaos(mdAbs) {
    const dir = path.dirname(mdAbs);
    const stem = path.basename(mdAbs).replace(/\.md$/i, '');
    return fs.readdirSync(dir).filter((n) => {
        return n !== `${stem}.md` && n.startsWith(`${stem}.`);
    });
}

// Troca a linha tipo só dentro do primeiro bloco de frontmatter.
function trocarTipo(texto, novo) {
    const m = texto.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) {
        return null;
    }
    const bloco = m[1].replace(/^tipo:.*$/m, `tipo: "${novo}"`);
    return texto.slice(0, m.index) + texto.slice(m.index).replace(m[1], bloco);
}

function planejar({ unidades, anos, regras }) {
    const plano = [];
    const anosVault =
        anos ||
        fs.readdirSync(VAULT).filter((a) => {
            return /^20\d\d$/.test(a);
        });
    anosVault.forEach((ano) => {
        const dirAno = path.join(VAULT, ano);
        if (!fs.existsSync(dirAno)) {
            return;
        }
        const us = unidades || fs.readdirSync(dirAno);
        us.forEach((u) => {
            const dirU = path.join(dirAno, u);
            if (!fs.existsSync(dirU)) {
                return;
            }
            fs.readdirSync(dirU).forEach((mes) => {
                const dirOutros = path.join(dirU, mes, 'outros');
                listarMd(dirOutros).forEach((abs) => {
                    // escala já extraída ao lado (<stem>.escala.json) é evidência mais forte que o nome
                    const c = irmaos(abs).some((n) => /\.escala\.json$/i.test(n))
                        ? { tipo: 'escala', regra: 'escala_extraida' }
                        : classificarPorNome(path.basename(abs), regras);
                    const rel = path.relative(dirOutros, abs);
                    const destino = c ? path.join(dirU, mes, c.tipo, rel) : null;
                    let situacao = 'fica';
                    if (c && fs.existsSync(destino)) {
                        situacao = 'colisao';
                    } else if (c) {
                        situacao = 'mover';
                    }
                    plano.push({
                        ano,
                        unidade: u,
                        mes,
                        origem: abs,
                        destino,
                        tipo: c ? c.tipo : 'outros',
                        regra: c ? c.regra : '',
                        situacao,
                    });
                });
            });
        });
    });
    return plano;
}

function aplicar(plano) {
    /* eslint-disable no-param-reassign */
    let movidos = 0;
    plano
        .filter((p) => {
            return p.situacao === 'mover';
        })
        .forEach((p) => {
            const dirDest = path.dirname(p.destino);
            fs.mkdirSync(dirDest, { recursive: true });
            const texto = fs.readFileSync(p.origem, 'utf8');
            const novo = trocarTipo(texto, p.tipo);
            if (novo === null) {
                p.situacao = 'sem_frontmatter';
                return;
            }
            const relNovo = path.relative(VAULT, p.destino).split(path.sep).join('/');
            irmaos(p.origem).forEach((n) => {
                const de = path.join(path.dirname(p.origem), n);
                const para = path.join(dirDest, n);
                if (/\.escala\.json$/i.test(n)) {
                    const j = JSON.parse(fs.readFileSync(de, 'utf8'));
                    if (j.arquivo && j.arquivo.md_path) {
                        j.arquivo.md_path = relNovo;
                    }
                    fs.writeFileSync(de, JSON.stringify(j, null, 2));
                }
                fs.renameSync(de, para);
            });
            fs.writeFileSync(p.origem, novo);
            fs.renameSync(p.origem, p.destino);
            p.situacao = 'movido';
            movidos += 1;
        });
    /* eslint-enable no-param-reassign */
    return movidos;
}

function contagem(plano, campo) {
    const c = {};
    plano.forEach((p) => {
        const chave = `${p.unidade}|${p[campo]}`;
        c[chave] = (c[chave] || 0) + 1;
    });
    return c;
}

function gravarPlano(plano, modo) {
    fs.mkdirSync(DIR_PLANOS, { recursive: true });
    const arq = path.join(
        DIR_PLANOS,
        `${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}-${modo}.csv`,
    );
    const rel = (a) => {
        return a ? path.relative(VAULT, a).split(path.sep).join('/') : '';
    };
    const linhas = ['ano;unidade;mes;tipo_novo;regra;situacao;origem;destino'];
    plano.forEach((p) => {
        return linhas.push(
            [
                p.ano,
                p.unidade,
                p.mes,
                p.tipo,
                p.regra,
                p.situacao,
                rel(p.origem),
                rel(p.destino),
            ].join(';'),
        );
    });
    fs.writeFileSync(arq, `${linhas.join('\n')}\n`);
    return arq;
}

function executar({ unidades, anos, aplicarMudancas = false } = {}) {
    const regras = carregarRegras();
    const plano = planejar({ unidades, anos, regras });
    const movidos = aplicarMudancas ? aplicar(plano) : 0;
    const arq = gravarPlano(plano, aplicarMudancas ? 'aplicado' : 'simulacao');
    const porTipo = contagem(plano, 'tipo');
    const porSituacao = contagem(plano, 'situacao');
    return {
        versao_regras: regras.versao,
        total_outros: plano.length,
        movidos,
        por_tipo: porTipo,
        por_situacao: porSituacao,
        plano: arq,
    };
}

if (require.main === module) {
    const a = {};
    process.argv.slice(2).forEach((s) => {
        const m = s.match(/^--([^=]+)(?:=(.*))?$/);
        if (m) {
            a[m[1]] = m[2] === undefined ? true : m[2];
        }
    });
    const r = executar({
        unidades: a.unidade ? String(a.unidade).split(',') : null,
        anos: a.ano ? String(a.ano).split(',') : null,
        aplicarMudancas: Boolean(a.aplicar),
    });
    process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
}

module.exports = { executar, planejar, trocarTipo };
