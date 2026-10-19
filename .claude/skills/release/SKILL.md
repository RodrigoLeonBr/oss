---
name: release
description: Procedimento de release do sistema OSS (build, migração, deploy). Use ao preparar ou publicar uma versão.
---

# Release

Passos sob demanda para publicar uma versão. Confirme com o usuário antes de qualquer passo irreversível (migração em prod, deploy).

## 1. Pré-voo

- `git status` limpo na branch de release.
- `cd frontend && npx tsc --noEmit` → zero erros.
- `npm test` (mocha) verde.
- `node src/helper/avaliacaoCumprimento.js` → `OK`.

## 2. Build

- `npm run build` (gera `frontend/dist`, servido pelo Express em prod).

## 3. Migração (confirmar antes)

- Revisar migrações pendentes em `src/db/migrations/`.
- Backup do banco antes de aplicar em produção.
- `npm run docker:prod:migrate` (ou `npm run db:migrate` no host alvo).

## 4. Deploy

Docker prod (uma imagem, API + estático na porta 4001):

```bash
npm run docker:prod:build
npm run docker:prod:up
```

Ou PM2: `pm2 restart saudecontrol-oss` (ver `ecosystem.config.js`).

## 5. Pós-deploy

- `GET /api/health` → `{"status":"ok"}`.
- Smoke test: login + uma leitura com escopo `proprio`.
- Tag e changelog da versão.
