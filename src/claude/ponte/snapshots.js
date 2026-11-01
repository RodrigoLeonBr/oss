// Instantâneos para o chat ler sem MCP: claude-bridge/snapshots/*.json e *.md + LEIAME.md.
// Uso: npm run snapshots   (o vigia também roda isto todo dia às 06:00)
require('../core/bootstrap');
const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const { registro } = require('../core/ferramentas');
const { paraMd } = require('../core/formatos');
const { PONTE, RAIZ, escreverAtomico, mascarar } = require('../core/limites');
const { q } = require('../core/consultas');

const DIR = path.join(PONTE, 'snapshots');

async function snapshot(nome, ferramenta, params) {
    const f = registro.get(ferramenta);
    const r = await f.executar(z.object(f.schema).parse(params)); // direto, sem paginação: snapshot é completo
    const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    escreverAtomico(
        path.join(DIR, `${nome}.json`),
        mascarar(
            JSON.stringify(
                { titulo: r.titulo, ferramenta, params, gerado_em: geradoEm, dados: r.dados },
                null,
                2,
            ),
        ),
    );
    escreverAtomico(path.join(DIR, `${nome}.md`), mascarar(paraMd(r, geradoEm)));
    return nome;
}

/** Quadrimestres (e ano) que já têm algum lançamento. */
async function periodosComLancamento() {
    const anos = await q(
        'SELECT YEAR(mes_referencia) AS ano, MAX(MONTH(mes_referencia)) AS ultimo FROM tb_acompanhamento_mensal GROUP BY YEAR(mes_referencia)',
    );
    const lista = [];
    for (const { ano, ultimo } of anos) {
        for (const [p, ini] of [
            ['1quad', 1],
            ['2quad', 5],
            ['3quad', 9],
        ]) {
            if (Number(ultimo) >= ini) {
                lista.push([Number(ano), p]);
            }
        }
        lista.push([Number(ano), 'ano']);
    }
    return lista;
}

async function gerar() {
    fs.mkdirSync(DIR, { recursive: true });
    const feitos = [];
    const falhas = [];
    const tentar = async (nome, ferramenta, params) => {
        try {
            feitos.push(await snapshot(nome, ferramenta, params));
        } catch (e) {
            falhas.push(`${nome}: ${e.message}`);
        }
    };
    await tentar('contratos', 'listar_contratos', {});
    await tentar('indicadores', 'listar_indicadores', {});
    for (const [ano, p] of await periodosComLancamento()) {
        // eslint-disable-next-line no-await-in-loop
        await tentar(`cumprimento_${ano}_${p}`, 'cumprimento_metas', {
            ano,
            periodo: p,
            escopo: 'todos',
        });
    }
    await tentar('acervo_relatorios', 'acervo_relatorios', {});
    for (const ano of fs.readdirSync(RAIZ).filter((d) => {
        return /^\d{4}$/.test(d);
    })) {
        // eslint-disable-next-line no-await-in-loop
        await tentar(`prestacoes_${ano}`, 'listar_prestacoes', { ano: Number(ano) });
    }
    const em = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    escreverAtomico(
        path.join(DIR, 'LEIAME.md'),
        [
            '# Instantâneos do sistema OSS',
            '',
            `Última geração: **${em}**. Gerado por \`npm run snapshots\` e diariamente às 06:00 pelo vigia da ponte.`,
            '',
            'Cada item tem `.json` (dados crus) e `.md` (tabelas prontas). Para dados mais novos ou outros filtros, use o MCP `oss-relatorios` ou a ponte (`claude-bridge/inbox`).',
            '',
            ...feitos.map((n) => {
                return `- \`${n}.json\` / \`${n}.md\``;
            }),
            ...(falhas.length
                ? [
                      '',
                      '## Falhas',
                      '',
                      ...falhas.map((f) => {
                          return `- ${f}`;
                      }),
                  ]
                : []),
        ].join('\n'),
    );
    return { feitos, falhas };
}

module.exports = { gerar };

if (require.main === module) {
    const { db } = require('../core/bootstrap');
    gerar()
        .then((r) => {
            return console.error(
                `snapshots: ${r.feitos.length} gerados, ${r.falhas.length} falhas${
                    r.falhas.length ? `\n${r.falhas.join('\n')}` : ''
                }`,
            );
        })
        .catch((e) => {
            console.error(e.message);
            process.exitCode = 1;
        })
        .finally(() => {
            return Promise.all([db.sequelize.close(), require('../core/consultas').fecharSql()]);
        });
}
