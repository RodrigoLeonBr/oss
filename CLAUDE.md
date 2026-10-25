# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Memória principal — enxuta. Detalhe mora nas regras modulares e em `docs/`.

## What this is

Plataforma de acompanhamento de contratos de gestão entre a SMS de Americana/SP e Organizações Sociais de Saúde (OSS). Ciclo mensal: coleta de indicadores → avaliação de cumprimento de metas → descontos por descumprimento → repasse financeiro → relatórios (CMS/TCESP). Domínio e código em **português**.

## Commands

Backend `:4001`, frontend Vite `:4000` (proxy `/api` → `:4001`).

```bash
npm run dev                 # concurrently: backend (nodemon) + frontend; web espera a API subir
npm start                   # Express só (prod-like, porta 4001)
npm run build               # build do frontend (tsc && vite build)
npm test                    # mocha (NÃO Jest; chai + sinon) — ver rules/testing.md
npm run db:migrate          # aplica migrações Sequelize pendentes
npm run db:seed             # popula dados reais de Americana/SP
cd frontend && npx tsc --noEmit   # type-check obrigatório (zero erros)
```

Um teste: `npx mocha specs/metas/<arquivo>.spec.js --exit`. Docker: `docker:up`/`docker:prod:up` etc. em `package.json`.

> Em DEV o frontend faz auto-login real contra `tb_usuarios` com `frontend/.env.development` (não commitar). `npm run dev:frontend` usa `wait-on` contra `:4001` — se a API não subir, o web fica esperando.

## Stack

Node 22 + Express 4 · Sequelize 6 + MySQL 8 · Redis · Socket.io · node-cron · Joi · Passport+JWT · Winston. Frontend: React 19 + TypeScript + Vite 8 (Rolldown) + Tailwind v4 + react-router v7 + react-window v2 + chart.js.

## Database

MySQL 8, Sequelize 6. Config via `.sequelizerc` (config `src/config/database.js`, migrações `src/db/migrations/`, seeders `src/db/seeders/`). Convenções: PKs UUID (`DEFAULT (UUID())`), soft-delete (`paranoid: true` / campo `ativo`), tabelas de histórico append-only. Migração nunca editada após merge — crie nova.

## Cron

`src/cronJobs.js` (node-cron): 6º dia útil 08:00 calcula descontos de contratos ativos; diário 07:00 alerta documentos regulatórios vencendo; dias 1–5 úteis 09:00 alerta pendências via Socket.io.

## Palácio de memória — onde está o quê

Regras modulares em `.claude/rules/` (1 tópico por arquivo). As sem `paths:` carregam toda sessão (importadas abaixo); `api.md` é escopada e carrega ao tocar no backend.

- `@.claude/rules/code-style.md` — convenções de código, resposta HTTP, gotchas de React.
- `@.claude/rules/testing.md` — mocha/chai/sinon, rodar um teste, checks.
- `@.claude/rules/security.md` — RBAC `checkPermission`, escopo por OSS, LGPD. **Ler antes de mexer em rotas.**
- `.claude/rules/api.md` — camadas Route→Controller→Service→DAO, mapa de rotas, regra de cumprimento (escopada a `src/route|controllers|service|dao|validator`).

Procedimentos sob demanda em `.claude/skills/` (ex.: `release`). Slash commands em `.claude/commands/` (ex.: `/review`). Notas pessoais em `CLAUDE.local.md` (fora do git).

Detalhe longo (lido sob demanda, sem `@`): `docs/PRD_v2.md`, `docs/ARQUITETURA_v2.md`, `docs/banco_v2.md`, `docs/erd_v2.md`, `docs/avaliacao-cumprimento-e-relatorios.md`, `docs/Manual-Operacao-Dominio-Contratual.md`, `docs/ponte-producao.md` (comparação informado × produção SIA/SIH).

> O cabeçalho "Auto-generated from .context/docs" vem do pipeline `@dotcontext/cli`; este arquivo foi reescrito à mão. Se regenerar, preserve estas seções.
