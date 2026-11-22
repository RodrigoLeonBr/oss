# AGENTS.md

Fonte única de instruções para qualquer agente de IA neste repositório (Claude Code, Codex, Gemini, Cursor, Cline, Windsurf, Continue, Trae, Zed, Aider). `GEMINI.md`, `CONVENTIONS.md`, `.cursorrules` e as pastas `.*/rules/` apenas apontam para cá. O Claude Code lê este arquivo pelo `@AGENTS.md` do `CLAUDE.md`.

> Até 21/11/2026 este arquivo era gerado pelo `@dotcontext/cli` a partir de `.context/docs` e estava desatualizado. Foi reescrito à mão em 22/11/2026. Se o pipeline do dotcontext for executado de novo, restaure este conteúdo e os ponteiros (`git checkout -- AGENTS.md GEMINI.md CONVENTIONS.md .cursorrules '.*/rules/*'`).

## O que é

Plataforma de acompanhamento de contratos de gestão entre a SMS de Americana/SP e Organizações Sociais de Saúde (OSS). Ciclo mensal: coleta de indicadores, avaliação de cumprimento de metas, descontos por descumprimento, repasse financeiro e relatórios (CMS/TCESP). Domínio e código em **português**.

## Comandos

Backend `:4001`, frontend Vite `:4000` (proxy `/api` para `:4001`).

```bash
npm run dev                 # concurrently: backend (nodemon) + frontend; web espera a API subir
npm start                   # Express só (prod-like, porta 4001)
npm run build               # build do frontend (tsc && vite build)
npm test                    # mocha (NÃO Jest; chai + sinon)
npm run db:migrate          # aplica migrações Sequelize pendentes
npm run db:seed             # popula dados reais de Americana/SP
npm run pos-incorporacao    # rotina após qualquer incorporação de dados da prestação (ver abaixo)
npm run catalogo:atualizar  # catálogo e índice de busca do vault (+ --banco: tb_documento) e ESTADO.md
npm run reclassificar       # tipo por nome de arquivo (regras_tipo.json); simulação, --aplicar move
cd frontend && npx tsc --noEmit   # type-check obrigatório (zero erros)
```

Um teste: `npx mocha specs/metas/<arquivo>.spec.js --exit`. Docker: `docker:up`, `docker:prod:up` etc. em `package.json`.

Em DEV o frontend faz auto-login real contra `tb_usuarios` com `frontend/.env.development` (não commitar). `npm run dev:frontend` usa `wait-on` contra `:4001`: se a API não subir, o web fica esperando.

## Stack

Node 22 + Express 4, Sequelize 6 + MySQL 8 (MariaDB no Docker), Redis, Socket.io, node-cron, Joi, Passport + JWT, Winston. Frontend: React 19 + TypeScript + Vite 8 (Rolldown) + Tailwind v4 + react-router v7 + react-window v2 + chart.js.

## Banco

Config via `.sequelizerc` (config `src/config/database.js`, migrações `src/db/migrations/`, seeders `src/db/seeders/`). Convenções: PKs UUID (`DEFAULT (UUID())`), soft-delete (`paranoid: true` ou campo `ativo`), tabelas de histórico append-only. Migração nunca é editada após merge: crie outra. Tabela nova que o chat precisa ler entra em `scripts/claude_ro.sql`.

## Cron

`src/cronJobs.js` (node-cron): 6º dia útil 08:00 calcula descontos de contratos ativos; diário 07:00 alerta documentos regulatórios vencendo; dias 1 a 5 úteis 09:00 alerta pendências via Socket.io.

## Regras detalhadas (valem para qualquer agente)

| Arquivo | Quando vale | Conteúdo |
|---|---|---|
| `.claude/rules/code-style.md` | sempre | convenções de código, resposta HTTP, gotchas de React |
| `.claude/rules/testing.md` | sempre | mocha/chai/sinon, rodar um teste, checks |
| `.claude/rules/security.md` | sempre; ler antes de mexer em rotas | RBAC `checkPermission`, escopo por OSS, LGPD |
| `.claude/rules/api.md` | ao tocar em `src/route`, `controllers`, `service`, `dao`, `validator` | camadas, mapa de rotas, regra de cumprimento |
| `.claude/rules/vault.md` | ao tocar em `prestacao-vault/`, `2025/`, `2026/`, `src/db/carrega*.js`, `src/incorporacao/` | layout do vault, unidades, tipos, escalas, proibições |
| `.claude/rules/extracao.md` | ao tocar em `src/extracao/` ou `prestacao-vault/extracoes/` | extração assistida por LLM, rastreabilidade, LGPD |

Documentação longa, lida sob demanda: `docs/PRD_v2.md`, `docs/ARQUITETURA_v2.md`, `docs/banco_v2.md`, `docs/erd_v2.md`, `docs/avaliacao-cumprimento-e-relatorios.md`, `docs/Manual-Operacao-Dominio-Contratual.md`, `docs/ponte-producao.md`, `docs/api-claude-chat.md` (MCP do chat) e `docs/conhecimento/` (esquema da wiki da CAF).

## Dados sensíveis

A prestação de contas das OSS nunca é versionada: `/2025/`, `/2026/`, `/prestacao-vault/`, `/claude-bridge/` e as planilhas `.xlsx` da raiz estão no `.gitignore`. Não copie conteúdo desses lugares para `docs/`, `specs/`, código, mensagens de commit ou PR. `.env` e `frontend/.env.development` não são lidos nem copiados.

## Incorporação de documentos

Toda ação que incorpora ou altera dados da prestação (conversão de PDF, carga de escala ou financeiro, importação de extração, reclassificação, correção manual) termina com a rotina pós-incorporação e a atualização das memórias:

```bash
npm run pos-incorporacao -- --unidade=<hm|unacon|upa_cillos|upa_dona_rosa|pa_zanaga> --competencia=<AAAA-MM> --gatilho=manual --comando="<o que foi feito>"
```

No Claude Code um hook faz isso sozinho para os comandos reconhecidos; outros agentes rodam à mão. O roteiro completo, inclusive a etapa de memória, está em `.claude/skills/incorporacao/SKILL.md`. Registro em `logs/incorporacao.jsonl`; pendências de memória em `logs/memoria-pendente.jsonl`.

## MCP do chat

O chat do Claude Project "Relatório OSS" lê banco, prestações, vault e acervo pelo MCP `oss-relatorios` (`src/claude/`, somente leitura, usuários `claude_ro` e `claude_sql`). Detalhes em `docs/api-claude-chat.md`.
