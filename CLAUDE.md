# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Memória principal, enxuta. O conteúdo comum a todos os agentes (o que é, comandos, stack, banco, cron, dados sensíveis, incorporação) mora em `AGENTS.md`, importado abaixo. Aqui fica só o que é próprio do Claude Code.

@AGENTS.md

## Palácio de memória do Claude Code

Regras modulares em `.claude/rules/` (um tópico por arquivo). As sem `paths:` carregam toda sessão (importadas abaixo); as escopadas carregam ao tocar nos caminhos delas.

- `@.claude/rules/code-style.md`: convenções de código, resposta HTTP, gotchas de React.
- `@.claude/rules/testing.md`: mocha/chai/sinon, rodar um teste, checks.
- `@.claude/rules/security.md`: RBAC `checkPermission`, escopo por OSS, LGPD. **Ler antes de mexer em rotas.**
- `.claude/rules/api.md`: camadas Route, Controller, Service, DAO; mapa de rotas; regra de cumprimento (escopada ao backend).
- `.claude/rules/vault.md`: vault da prestação, unidades, tipos, escalas e proibições (escopada a `prestacao-vault/`, `2025/`, `2026/`, `src/db/carrega*.js`, `src/incorporacao/`).
- `.claude/rules/extracao.md`: extração assistida por LLM (escopada a `src/extracao/` e `prestacao-vault/extracoes/`).

Procedimentos sob demanda em `.claude/skills/` (ex.: `release`, `incorporacao`). Slash commands em `.claude/commands/` (`/review`, `/incorporar`). Notas pessoais em `CLAUDE.local.md` (fora do git).

## Incorporação: hook e etapa de memória

- `.claude/settings.json` registra um hook `PostToolUse` (`.claude/hooks/pos-incorporacao.js`). Quando um comando Bash converte, carrega ou importa dados da prestação (padrões em `src/incorporacao/gatilhos.js`), o hook roda `npm run pos-incorporacao` e devolve um aviso com o registro e as pendências de memória.
- Recebido o aviso, cumpra a etapa de memória da skill `incorporacao` antes de dar a tarefa por encerrada e feche a pendência com `npm run pos-incorporacao -- --concluir=<id>`.
- Comando que o hook não reconhece mas altera dado da prestação: rode a rotina à mão, como descrito em `AGENTS.md`.

## MCP e ponte do chat

MCP `oss-relatorios` (somente leitura, `src/claude/`, usuários `claude_ro` e `claude_sql`, roda no host): `docs/api-claude-chat.md`. Ferramenta ou tabela nova exige GRANT em `scripts/claude_ro.sql` e entrada na documentação.

> O cabeçalho "Auto-generated from .context/docs" vinha do pipeline `@dotcontext/cli`; este arquivo e o `AGENTS.md` são mantidos à mão. Se regenerar, preserve estas seções e o import de `AGENTS.md`.
