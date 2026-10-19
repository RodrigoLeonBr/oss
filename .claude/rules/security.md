# Security — RBAC, multi-tenant, LGPD

Sensível. Carregada em toda sessão. Ler antes de mexer em rotas ou em qualquer coisa com dados de OSS.

## Autorização é data-driven

Pipeline de rota: `auth()` → `checkPermission(modulo, action)` → `auditar(tabela, acao)` → controller.

- `auth()` (`middlewares/auth.js`): valida JWT via Passport, popula `req.user`.
- `checkPermission(modulo, action)` (`middlewares/rbac.js`): consulta `tb_permissoes_perfil` pela coluna `can_<action>` (`view`/`insert`/`update`/`delete`) e guarda a linha em `req.permissaoAtual`. **Não** usar o `authorize([perfis])` legado em rotas novas.
- `auditar(tabela, acao)` (`middlewares/auditoria.js`): grava log LGPD em toda escrita. Writes sem `auditar` são bug.

## Escopo por OSS (isolamento de inquilino)

Quando `req.permissaoAtual.escopo === 'proprio'` (perfis contratada), o recurso é restrito à OSS do usuário.

- `getOssIdSeEscopoProprio(req)` (`helper/ossScopeHelper.js`) → `oss_id` do usuário (ou `null` = visão global). Propague esse `ossIdFiltro` ao Service sempre.
- Antes de operar sobre um recurso, valide posse com `assert*NoEscopoOSS(id, ossIdFiltro)` do mesmo helper. Eles atravessam FKs até `contrato.oss_id` e lançam **404** (não 403) em acesso cruzado — vazar existência é vazar dado.

Perfis (8, em `PERFIS` de `rbac.js`): `admin`, `gestor_sms`, `auditora`, `conselheiro_cms`, `contratada_scmc`, `contratada_indsh`, `central_regulacao`, `visualizador`.

## Dados sensíveis

Prestação de contas (SMS) nunca é versionada: `/2025/`, `/2026/`, `/prestacao-vault/` no `.gitignore`. `.env`, `JWT_SECRET` e credenciais DEV (`frontend/.env.development`) também fora do git.
