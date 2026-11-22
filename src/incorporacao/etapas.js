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

const ETAPAS = [
    {
        id: 'catalogar',
        fase: 'F1',
        descricao: 'tb_documento a partir do frontmatter, hash e ativo',
        executar: null,
    },
    {
        id: 'reclassificar',
        fase: 'F1',
        descricao: 'tipo por regras_tipo.json, sem reconverter',
        executar: null,
    },
    {
        id: 'indexar',
        fase: 'F1',
        descricao: 'índice SQLite FTS5 usado pela buscar_vault',
        executar: null,
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
