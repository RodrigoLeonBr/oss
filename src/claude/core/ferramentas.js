// Registro único de ferramentas + executor comum ao MCP e à ponte por arquivos.
const { z } = require('zod');
const { paraMd } = require('./formatos');
const {
    paginar,
    mascarar,
    gravarOutbox,
    registrar,
    TETO_BYTES,
    TETO_LINHAS,
} = require('./limites');

const lista = [
    ...require('./consultas').ferramentas,
    ...require('./documentos').ferramentas,
    ...require('./relatorio').ferramentas,
];

// Parâmetros comuns a toda ferramenta
const comuns = {
    formato: z
        .enum(['json', 'md'])
        .default('md')
        .describe('md = tabelas prontas para o relatório; json = dados crus'),
    pagina: z.coerce.number().int().min(1).optional(),
    por_pagina: z.coerce.number().int().min(1).max(TETO_LINHAS).optional(),
};

const registro = new Map(
    lista.map((f) => {
        return [f.nome, { ...f, schema: { ...f.schema, ...comuns } }];
    }),
);

function mensagemErro(e) {
    if (e instanceof z.ZodError) {
        return `parâmetros inválidos: ${e.issues
            .map((i) => {
                return `${i.path.join('.') || '(raiz)'}: ${i.message}`;
            })
            .join('; ')}`;
    }
    const msg = e.original?.sqlMessage || e.parent?.sqlMessage || e.message || String(e);
    if (
        /ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|connect/i.test(msg) &&
        e.name &&
        /Connection/i.test(e.name)
    ) {
        return `banco fora do ar: ${msg}`;
    }
    return msg;
}

/**
 * Executa uma ferramenta pelo nome. Nunca lança: devolve { ok, texto, dados?, erro?, arquivo? }.
 * @param {string} nome
 * @param {object} params
 * @param {{ canal?: string, id?: string }} ctx
 */
async function executar(nome, params = {}, ctx = {}) {
    const t0 = Date.now();
    const f = registro.get(nome);
    if (!f) {
        const erro = `ferramenta inexistente: ${nome}. Disponíveis: ${[...registro.keys()].join(
            ', ',
        )}`;
        registrar({
            em: new Date().toISOString(),
            canal: ctx.canal,
            ferramenta: nome,
            params,
            ok: false,
            erro,
        });
        return { ok: false, erro, texto: erro };
    }
    try {
        const p = z.object(f.schema).parse(params || {});
        const r = await f.executar(p);
        let linhas = 0;
        for (const t of r.tabelas || []) {
            const pg = paginar(t.linhas, p.pagina, p.por_pagina);
            linhas += pg.total;
            if (pg.paginas > 1) {
                (r.notas ||= []).push(
                    `${t.titulo || 'Tabela'}: página ${pg.pagina} de ${pg.paginas} (${
                        pg.total
                    } linhas). Use pagina/por_pagina.`,
                );
            }
            t.linhas = pg.linhas;
        }
        if (Array.isArray(r.dados)) {
            const pg = paginar(r.dados, p.pagina, p.por_pagina);
            r.dados = pg.linhas;
            linhas = Math.max(linhas, pg.total);
        }
        const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        let texto = mascarar(
            p.formato === 'json'
                ? JSON.stringify(
                      {
                          titulo: r.titulo,
                          fonte: r.fonte,
                          notas: r.notas,
                          gerado_em: geradoEm,
                          dados: r.dados,
                      },
                      null,
                      2,
                  )
                : paraMd(r, geradoEm),
        );
        let arquivo = null;
        if (Buffer.byteLength(texto) > TETO_BYTES) {
            arquivo = gravarOutbox(
                ctx.id || `${nome}-${Date.now()}`,
                p.formato === 'json' ? 'json' : 'md',
                texto,
            );
            texto = `Resposta maior que 200 KB, gravada em arquivo.\nNo chat: ${arquivo.chat}\nNo Windows: ${arquivo.local}`;
        }
        registrar({
            em: new Date().toISOString(),
            canal: ctx.canal,
            ferramenta: nome,
            params,
            ok: true,
            linhas,
            ms: Date.now() - t0,
            arquivo: arquivo && arquivo.local,
        });
        return { ok: true, texto, dados: r.dados, arquivo };
    } catch (e) {
        const erro = mascarar(mensagemErro(e));
        registrar({
            em: new Date().toISOString(),
            canal: ctx.canal,
            ferramenta: nome,
            params,
            ok: false,
            erro,
            ms: Date.now() - t0,
        });
        return { ok: false, erro, texto: `Erro: ${erro}` };
    }
}

module.exports = { registro, executar };
