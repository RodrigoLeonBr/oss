// Etapas da rotina pós-incorporação, na ordem do plano (Whiteboard "Plano de incorporação").
// Cada fase do plano preenche o `executar` da sua etapa; até lá ela é registrada como
// nao_implementada, para que o log mostre o que ainda depende de ação manual.

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');
const LOGS = path.join(RAIZ, 'logs');
const MEMORIA_PENDENTE = path.join(LOGS, 'memoria-pendente.jsonl');
const LOG_CONHECIMENTO = path.join(RAIZ, 'prestacao-vault', 'conhecimento', 'log.md');

const hoje = () => {
    return new Date().toISOString().slice(0, 10);
};

function registrarPendenciaMemoria(ctx) {
    const itens = [
        'prestacao-vault/ESTADO.md (contagem por unidade e mês; gerado do catálogo a partir da fase 1)',
        'prestacao-vault/conhecimento/log.md e notas da unidade (fase 6)',
        'AGENTS.md, units.json ou rules/vault.md se mudou convenção, tipo, unidade ou contrato',
        'doc de memória do Project no claude.ai (via snapshot estado-projeto, fase 6)',
    ];
    fs.mkdirSync(LOGS, { recursive: true });
    fs.appendFileSync(
        MEMORIA_PENDENTE,
        `${JSON.stringify({
            id: ctx.id,
            em: ctx.em,
            status: 'pendente',
            unidade: ctx.unidade,
            competencia: ctx.competencia,
            gatilho: ctx.gatilho,
            comando: ctx.comando,
            itens,
        })}\n`,
    );

    let detalhe = 'pendência de memória registrada';
    if (fs.existsSync(LOG_CONHECIMENTO)) {
        const linha = `\n## [${hoje()}] incorporacao | ${ctx.unidade || '?'} ${
            ctx.competencia || '?'
        } | ${ctx.tipo || ctx.gatilho}: ${ctx.comando || ''}\n`;
        fs.appendFileSync(LOG_CONHECIMENTO, linha);
        detalhe += '; entrada acrescentada ao conhecimento/log.md';
    }
    return { status: 'ok', detalhe };
}

const unidadesDe = (ctx) => {
    return ctx.unidade ? [ctx.unidade] : null;
};
const anosDe = (ctx) => {
    return ctx.competencia ? [Number(String(ctx.competencia).slice(0, 4))] : null;
};

// F1: reclassificação só em simulação na rotina; mover arquivos é decisão explícita (npm run reclassificar -- --aplicar).
function simularReclassificacao(ctx) {
    // eslint-disable-next-line global-require
    const r = require('./reclassificar').executar({
        unidades: unidadesDe(ctx),
        anos: anosDe(ctx) && anosDe(ctx).map(String),
    });
    const mover = Object.entries(r.por_situacao)
        .filter(([k]) => {
            return k.endsWith('|mover');
        })
        .reduce((t, [, n]) => {
            return t + n;
        }, 0);
    return {
        status: mover ? 'atencao' : 'ok',
        detalhe: mover
            ? `${mover} arquivo(s) em outros têm tipo pelas regras; aplicar com npm run reclassificar -- --unidade=${
                  ctx.unidade || '<u>'
              } --aplicar antes de nova conversão (plano: ${path.basename(r.plano)})`
            : 'nada a reclassificar',
    };
}

function catalogarEIndexar(ctx) {
    // eslint-disable-next-line global-require
    const cat = require('./catalogo');
    const r = cat.catalogar({ unidades: unidadesDe(ctx), anos: anosDe(ctx), tempoMaxMs: 100000 });
    const e = cat.gerarEstado();
    return {
        status: r.incompleto ? 'atencao' : 'ok',
        detalhe: `${r.novos_ou_alterados} novos ou alterados, ${r.removidos} removidos, ${
            r.trechos
        } trechos indexados, ${e.pdfs_sem_md} PDF(s) sem .md${
            r.incompleto ? '; parou pelo tempo, rode npm run catalogo:atualizar para completar' : ''
        }`,
    };
}

async function sincronizarBanco() {
    // eslint-disable-next-line global-require
    const r = await require('./sincronizarBanco').sincronizar();
    return { status: 'ok', detalhe: `${r.gravados} documento(s) gravados em tb_documento` };
}

const ETAPAS = [
    {
        id: 'reclassificar',
        fase: 'F1',
        descricao: 'simula o tipo por regras_tipo.json; aplicar é manual',
        executar: simularReclassificacao,
    },
    {
        id: 'catalogar',
        fase: 'F1',
        descricao: 'catálogo e índice FTS5 (prestacao-vault/indice/vault.db) e ESTADO.md',
        executar: catalogarEIndexar,
    },
    {
        id: 'sincronizar_banco',
        fase: 'F1',
        descricao: 'espelha o catálogo em tb_documento (MySQL, só no host)',
        executar: sincronizarBanco,
    },
    {
        id: 'validar_escalas',
        fase: 'F2',
        descricao: 'nome, período, duplicata, setor e vazio (V1 a V6)',
        executar: null,
    },
    {
        id: 'importar_extracoes',
        fase: 'F3',
        descricao: 'JSON de extracoes/ para o banco como pendente',
        executar: null,
    },
    {
        id: 'recalcular',
        fase: 'F3',
        descricao: 'cumprimento e percentual de recebimento afetados',
        executar: null,
    },
    {
        id: 'conhecimento_dados',
        fase: 'F6',
        descricao: 'blocos de dados da wiki e snapshot estado-projeto',
        executar: null,
    },
    {
        id: 'memoria',
        fase: 'F0',
        descricao: 'registra o que precisa ser atualizado nas memórias',
        executar: registrarPendenciaMemoria,
    },
];

module.exports = { ETAPAS, MEMORIA_PENDENTE, LOGS, RAIZ };
