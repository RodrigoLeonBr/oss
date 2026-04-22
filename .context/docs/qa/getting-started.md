---
slug: getting-started
category: getting-started
generatedAt: 2026-04-21T00:00:00.000Z
---

# Como configurar e rodar o projeto?

## Pré-requisitos

- Node.js 22 LTS
- MySQL 8+
- Redis (opcional em DEV, necessário em PROD para cache de tokens)
- Git

## Setup Completo

### 1. Instalar dependências

```bash
# Backend (raiz do projeto)
npm install

# Frontend
cd frontend && npm install
```

### 2. Configurar banco de dados

```sql
-- No MySQL:
CREATE DATABASE oss;
```

```bash
# Copiar e editar variáveis de ambiente
cp .env.example .env
```

Editar `.env`:
```
DB_HOST=localhost
DB_PORT=3306
DB_NAME=oss
DB_USER=root
DB_PASS=sua_senha
JWT_SECRET=seu_segredo_jwt
```

### 3. Executar migrações e seeds

```bash
npm run db:migrate    # Cria as 22+ tabelas
npm run db:seed       # Popula dados iniciais (2 OSS, 3 contratos, 5 unidades, 28 indicadores)
```

### 4. Configurar autenticação DEV

```bash
# Criar arquivo de credenciais DEV (NÃO commitar)
# frontend/.env.development
VITE_DEV_EMAIL=admin@americana.sp.gov.br
VITE_DEV_PASSWORD=Oss@2026
VITE_API_URL=http://localhost:5000
```

O frontend fará login automático com essas credenciais ao iniciar em modo DEV.

### 5. Iniciar os servidores

```bash
# Terminal 1 — Backend
npm start
# Rodando em http://localhost:5000

# Terminal 2 — Frontend
cd frontend
npm run dev
# Rodando em http://localhost:3000 (ou 5173)
```

### 6. Verificar

Acesse `http://localhost:3000`. O login automático deve autenticar como `Administrador Geral` em ~1 segundo.

Se aparecer `[DEV] Auto-login failed` no console, verifique:
1. O backend está rodando em `:5000`?
2. `frontend/.env.development` tem as credenciais corretas?
3. As seeds foram aplicadas? (`npm run db:seed`)

## Scripts Disponíveis

### Backend (raiz)

```bash
npm start              # Servidor Express (porta 5000)
npm test               # Testes Jest
npm run db:migrate     # Aplicar migrações pendentes
npm run db:migrate:undo # Desfazer última migração
npm run db:seed        # Executar todos os seeders
npm run db:seed:undo   # Desfazer todos os seeds
```

### Frontend (`cd frontend`)

```bash
npm run dev            # Dev server Vite (porta 3000/5173, proxy /api → :5000)
npm run build          # Build produção (tsc + vite build com Rolldown)
npm run preview        # Preview do build
npx tsc --noEmit       # Verificação TypeScript (deve ter zero erros)
```

## Troubleshooting

| Problema | Causa | Solução |
|----------|-------|---------|
| `[DEV] Auto-login failed: 401` | Backend não encontrou usuário | Verificar seeds: `npm run db:seed` |
| `[DEV] Auto-login failed: fetch failed` | Backend não está rodando | `npm start` na raiz |
| `ECONNREFUSED :3306` | MySQL não está rodando | Iniciar MySQL (XAMPP ou serviço) |
| `npm run build` com erros TS | Tipos desatualizados | `cd frontend && npx tsc --noEmit` para diagnóstico |
| Tela branca no frontend | Erro de runtime React | Abrir Console do browser e verificar stack trace |
