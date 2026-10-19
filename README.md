# Sistema OSS Saúde Americana

> Plataforma de acompanhamento de contratos de gestão entre a Secretaria Municipal de Saúde (SMS) de Americana/SP e Organizações Sociais de Saúde (OSS).

Automatiza o ciclo mensal de coleta de indicadores, cálculo de descontos por descumprimento de metas, geração de repasses financeiros e produção de relatórios para o Conselho Municipal de Saúde (CMS) e Tribunal de Contas (TCESP). Conformidade com LGPD e transparência pública.

---

## Sumário

- [Stack Tecnológica](#stack-tecnológica)
- [Pré-requisitos](#pré-requisitos)
- [Configuração Local (XAMPP)](#configuração-local-xampp)
- [Configuração com Docker](#configuração-com-docker)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Comandos Disponíveis](#comandos-disponíveis)
- [API — Endpoints](#api--endpoints)
- [Controle de Acesso (RBAC)](#controle-de-acesso-rbac)
- [Arquitetura e Estrutura](#arquitetura-e-estrutura)
- [Banco de Dados](#banco-de-dados)
- [Cron Jobs](#cron-jobs)
- [Deploy com PM2](#deploy-com-pm2)
- [Testes](#testes)

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| **Backend** | Node.js 22 + Express 4 |
| **ORM** | Sequelize 6 + MySQL 8 |
| **Frontend** | React 19 + TypeScript + Vite 8 (Rolldown) |
| **Estilização** | Tailwind CSS com design tokens CSS customizados |
| **Autenticação** | Passport.js + JWT (`tb_usuarios` / `senha_hash`) |
| **Cache** | Redis |
| **Tempo Real** | Socket.io |
| **Agendamento** | node-cron |
| **Validação** | Joi |
| **Logging** | Winston + daily-rotate-file |
| **Testes** | Mocha + Chai + Sinon |
| **Deploy** | Docker / PM2 |

---

## Pré-requisitos

- Node.js 22 LTS
- MySQL 8+
- Redis 7+ (opcional em DEV, necessário em PROD)
- npm >= 9

---

## Configuração Local (XAMPP)

```bash
# 1. Instalar dependências backend
npm install

# 2. Instalar dependências frontend
cd frontend && npm install && cd ..

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Edite .env com as credenciais do MySQL local e um JWT_SECRET seguro

# 4. Criar o banco de dados no MySQL
# mysql -u root -p
# CREATE DATABASE oss CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 5. Executar migrações (36 migrações Sequelize)
npm run db:migrate

# 6. Popular dados iniciais (ver src/db/seeders/)
# Perfis + permissões, OSS, contratos, unidades, blocos de produção,
# indicadores e metas 2026 — dados reais de Americana/SP + usuário admin.
npm run db:seed

# 7. Criar credenciais de auto-login DEV (não commitar)
cat > frontend/.env.development << EOF
VITE_DEV_EMAIL=<email-do-admin-de-dev>
VITE_DEV_PASSWORD=<defina-uma-senha-dev>
VITE_API_URL=http://localhost:4001
EOF
# Use as credenciais que você definiu no seed/seu banco local.
# NUNCA comite credenciais reais; gere uma senha por máquina.

# 8. Iniciar o backend
npm start
# API em http://localhost:4001

# 9. Em outro terminal, iniciar o frontend
cd frontend && npm run dev
# Frontend em http://localhost:4000
```

> O frontend faz **auto-login automático** em DEV com as credenciais de `frontend/.env.development`, usando autenticação real contra `tb_usuarios`.

---

## Configuração com Docker

### Modo desenvolvimento (padrão): Vite + API separados

O `docker-compose.yml` sobe **Redis**, o **backend** em `NODE_ENV=development` (porta **4001**) e o **Vite** (porta **4000**). O navegador deve usar **http://localhost:4000**; o proxy do Vite encaminha `/api` para o serviço `api`.

**1. Pré-requisito:** [Docker](https://docs.docker.com/get-docker/) com Compose.

**2. Variáveis (obrigatório: `JWT_SECRET`):**

```bash
cp env.docker.example .env
# Edite JWT_SECRET e credenciais do MySQL no host
```

**3. Build e subida:**

```bash
docker compose build
docker compose up -d
```

Atalhos: `npm run docker:build`, `npm run docker:up`.

**4. Migrações / seed** (com o serviço `api` saudável):

```bash
docker compose exec api npm run db:migrate
docker compose exec api npm run db:seed
```

**5. URLs:** app **http://localhost:4000** · API direta (opcional) **http://localhost:4001** · Portas ajustáveis via `WEB_PORT` e `API_PORT` no `.env`.

| Comando | Descrição |
|--------|------------|
| `docker compose build` | Imagens `api` + `web` (+ Redis usa imagem oficial) |
| `docker compose up -d` | Sobe `redis`, `api`, `web` |
| `docker compose logs -f api web` | Logs backend e Vite |
| `npm run docker:prod:up` | Stack **produção** (uma imagem, porta 4001) — ver abaixo |

### Modo produção: uma imagem (API + estático)

Build multi-stage no `Dockerfile`: gera `frontend/dist` e o Express serve a SPA e `/api` na **mesma porta** (padrão **4001**).

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
# ou: npm run docker:prod:build && npm run docker:prod:up
```

Acesse **http://localhost:4001**. Migrações: `npm run docker:prod:migrate` / `docker:prod:seed`.

> O compose usa o `.env` na raiz. MySQL no host: `DOCKER_DB_HOST` (padrão `host.docker.internal`). Detalhes em `env.docker.example`.

---

## Variáveis de Ambiente

Copie `.env.example` para `.env` e ajuste os valores:

```dotenv
# Servidor
NODE_ENV=development
PORT=4001

# MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=
DB_NAME=oss

# JWT
JWT_SECRET=substitua-por-uma-chave-segura-aleatoria
JWT_ACCESS_EXPIRATION_MINUTES=60
JWT_REFRESH_EXPIRATION_DAYS=30

# Logging
LOG_FOLDER=logs/
LOG_FILE=%DATE%-app-log.log
LOG_LEVEL=error

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_USE_PASSWORD=no
REDIS_PASSWORD=
```

**Frontend DEV** (`frontend/.env.development` — não commitar):

```dotenv
VITE_DEV_EMAIL=<email-do-admin-de-dev>
VITE_DEV_PASSWORD=<defina-uma-senha-dev>
VITE_API_URL=http://localhost:4001
```

> **Segurança:** não use senhas padrão/conhecidas. O seed deve gerar a senha do admin por ambiente (ex.: via variável de ambiente) e nunca versioná-la. Troque qualquer credencial que já tenha sido comitada.

---

## Comandos Disponíveis

### Backend (raiz)

```bash
npm start                   # Servidor Express (porta 4001)
npm test                    # Testes Mocha (--watch; use `npx mocha <arquivo> --exit` p/ um só)
npm run db:migrate          # Aplica migrações pendentes
npm run db:migrate:undo     # Desfaz última migração
npm run db:seed             # Popula dados iniciais
npm run db:seed:undo        # Remove dados de seed
```

### Frontend (`cd frontend`)

```bash
npm run dev                 # Dev server Vite (porta 4000, proxy /api → :4001)
npm run build               # Build produção (tsc + vite build com Rolldown)
npm run preview             # Preview do build de produção
npx tsc --noEmit            # Verificação TypeScript (zero erros obrigatório)
```

### Docker (raiz, após `cp env.docker.example .env`)

```bash
npm run docker:build         # docker compose build
npm run docker:up            # sobe app + db + redis
npm run docker:down
npm run docker:logs          # logs -f do serviço app
npm run docker:migrate
npm run docker:seed
```

---

## API — Endpoints

Base URL: `http://localhost:4001/api`

> **Operações / Docker:** `GET /api/health` responde `200` com `{"status":"ok"}` (usado no healthcheck do contêiner).

### Autenticação (`/api/auth`)

| Método | Rota | Descrição | Acesso |
|---|---|---|---|
| `POST` | `/auth/login` | Login — retorna access + refresh token | Público |
| `POST` | `/auth/register` | Cadastro de usuário | `usuarios:insert` (admin) |
| `POST` | `/auth/email-exists` | Verifica se e-mail já existe | ⚠️ Público — ver nota |
| `POST` | `/auth/refresh-token` | Renova access token | Público |
| `POST` | `/auth/logout` | Encerra sessão (invalida token) | Público |
| `PUT` | `/auth/change-password` | Altera senha | Autenticado |
| `GET` | `/auth/me/permissions` | Permissões do usuário logado | Autenticado |

> **`POST /auth/register` é gateado por admin** (`auth()` + `checkPermission('usuarios', 'insert')` + `auditar`), equivalente a `POST /api/usuarios`. ⚠️ **`POST /auth/email-exists` segue público** e permite enumeração de e-mails — sob LGPD, considere gateá-lo ou removê-lo se o fluxo de cadastro não depender mais dele.

**Body de login:**
```json
{ "email": "<email-do-usuario>", "password": "<senha>" }
```

**Resposta:**
```json
{
  "data": { "usuario_id": "...", "nome": "...", "email": "...", "perfil": "admin" },
  "tokens": { "access": { "token": "eyJ..." }, "refresh": { "token": "eyJ..." } }
}
```

### Acompanhamentos / Entrada Mensal

Existem **dois** módulos montados em `src/route/index.js` (autorização via `checkPermission`, módulos `entrada_mensal` e `aprovacao`):

**`/api/acompanhamentos`** — CRUD de entrada mensal (`acompanhamentosRoute.js`)

| Método | Rota | Descrição | Permissão |
|---|---|---|---|
| `GET` | `/` | Lista acompanhamentos | `entrada_mensal:view` |
| `GET` | `/:id` | Detalhe | `entrada_mensal:view` |
| `POST` | `/` | Registra valor realizado | `entrada_mensal:insert` |
| `PUT` | `/:id` | Atualiza acompanhamento | `entrada_mensal:update` |

**`/api/acompanhamento-mensal`** — ciclo de aprovação + cálculo (`acompanhamentoRoute.js`)

| Método | Rota | Descrição | Permissão |
|---|---|---|---|
| `GET` | `/` | Lista acompanhamentos | `entrada_mensal:view` |
| `POST` | `/` | Registra valor realizado | `entrada_mensal:insert` |
| `PUT` | `/:id/aprovar` | Aprova | `aprovacao:update` |
| `PUT` | `/:id/rejeitar` | Rejeita | `aprovacao:update` |
| `PUT` | `/:id/revogar` | Revoga aprovação | `aprovacao:update` |
| `POST` | `/calcular-descontos` | Recalcula descontos | `entrada_mensal:update` |
| `GET` | `/repasse` | Repasse com descontos | `relatorios:view` |

### Metas (`/api/metas`)

| Método | Rota | Descrição | Perfis |
|---|---|---|---|
| `GET` | `/` | Lista metas | Todos |
| `POST` | `/` | Cria meta | Admin, Gestor_SMS |
| `PUT` | `/:id` | Atualiza meta | Admin, Gestor_SMS |
| `DELETE` | `/:id` | Remove meta | Admin |

### Indicadores (`/api/indicadores`)

| Método | Rota | Descrição | Perfis |
|---|---|---|---|
| `GET` | `/` | Lista indicadores | Todos |
| `GET` | `/:id` | Detalhe de um indicador | Todos |
| `POST` | `/` | Cria indicador | Admin |
| `PUT` | `/:id` | Atualiza indicador | Admin |
| `DELETE` | `/:id` | Desativa (soft-delete) | Admin |

### OSS (`/api/oss`)

| Método | Rota | Descrição | Perfis |
|---|---|---|---|
| `GET` | `/` | Lista OSS | Todos |
| `GET` | `/:id` | Detalhe de OSS | Todos |
| `POST` | `/` | Cria OSS | Admin |
| `PUT` | `/:id` | Atualiza OSS | Admin |
| `DELETE` | `/:id` | Remove OSS (soft-delete) | Admin |

### Unidades de Saúde (`/api/unidades`)

| Método | Rota | Descrição | Perfis |
|---|---|---|---|
| `GET` | `/?ativo=1` | Lista unidades | Todos |
| `GET` | `/:id` | Detalhe de unidade | Todos |
| `POST` | `/` | Cria unidade | Admin |
| `PUT` | `/:id` | Atualiza unidade | Admin |
| `DELETE` | `/:id` | Remove unidade | Admin |

### Contratos (`/api/contratos`)

| Método | Rota | Descrição | Perfis |
|---|---|---|---|
| `GET` | `/` | Lista contratos | Todos |
| `GET` | `/:id` | Detalhe de um contrato | Todos |
| `POST` | `/` | Cria contrato | Admin |
| `PUT` | `/:id` | Atualiza contrato | Admin |
| `DELETE` | `/:id` | Remove contrato | Admin |

### Descontos (`/api/descontos`)

| Método | Rota | Descrição | Perfis |
|---|---|---|---|
| `GET` | `/blocos` | Descontos por bloco de produção | Todos |
| `GET` | `/indicadores` | Descontos por indicador | Todos |
| `GET` | `/repasse?mes=` | Repasse com breakdown de descontos | Admin, Gestor_SMS |
| `PUT` | `/blocos/:id/auditar` | Audita desconto de bloco | Auditora, Admin |

---

## Controle de Acesso (RBAC)

O sistema possui 8 perfis (`PERFIS` em `src/middlewares/rbac.js`):

| Perfil | Descrição |
|---|---|
| `admin` | Acesso total ao sistema |
| `gestor_sms` | Gestão de contratos e indicadores da SMS |
| `auditora` | Aprovação e auditoria de acompanhamentos |
| `conselheiro_cms` | Visualização para o Conselho Municipal de Saúde |
| `contratada_scmc` | Entrada de dados pela OSS contratada (SCMC) |
| `contratada_indsh` | Entrada de dados pela OSS contratada (INDSH) |
| `central_regulacao` | Central de regulação |
| `visualizador` | Somente leitura |

**Autorização é data-driven.** O middleware usado nas rotas é `checkPermission(modulo, action)`, que consulta a tabela `tb_permissoes_perfil` pela coluna `can_<action>` (`view`/`insert`/`update`/`delete`) e guarda a linha em `req.permissaoAtual`. O `authorize([...perfis])` é **legado** e não deve ser usado em rotas novas.

Quando a permissão do módulo tem `escopo = 'proprio'` (perfis contratada), o backend restringe os dados à OSS do usuário via `getOssIdSeEscopoProprio(req)` + helpers `assert*NoEscopoOSS` (`src/helper/ossScopeHelper.js`), que lançam **404** em acesso cruzado. Escritas passam por `auditar(tabela, acao)` (log LGPD). O frontend usa `ProtectedRoute` com `allowedPerfis`.

> As colunas "Perfis/Permissão" nas tabelas de endpoint acima são indicativas; a autorização efetiva é a configurada em `tb_permissoes_perfil` (seed `seed-permissoes-defaults`).

---

## Arquitetura e Estrutura

O backend segue a arquitetura em camadas **Route → Controller → Service → DAO → Model**:

```
oss/
├── src/
│   ├── config/              # JWT, DB, Passport.js (estratégia JWT via tb_usuarios)
│   ├── controllers/         # Auth, Acompanhamentos, Meta, Indicador, Oss, Unidade, Contrato
│   ├── dao/                 # Data Access Objects — SuperDao base + especializados
│   ├── db/
│   │   ├── migrations/      # 36 migrações Sequelize
│   │   └── seeders/         # Dados iniciais reais de Americana/SP
│   ├── helper/              # ApiError, EmailHelper, RedisHelper, responseHandler
│   ├── middlewares/         # auth() JWT, authorize() RBAC, auditoria LGPD
│   ├── models/              # modelos Sequelize (Usuario, Oss, Contrato, Indicador...)
│   ├── route/               # Rotas Express
│   ├── service/             # AuthService, TokenService, AcompanhamentosService, MetaService...
│   ├── validator/           # Schemas Joi (Acompanhamentos, Meta, Indicador)
│   └── app.js               # Express app
├── frontend/
│   └── src/
│       ├── components/      # SidebarMenu, Header, CardMetrica, TabelaIndicadores...
│       ├── contexts/        # AuthContext (login real JWT, auto-login DEV, RBAC, dark mode)
│       ├── hooks/           # useApi (fetch wrapper com ApiError)
│       ├── lib/             # formatters (moeda, percentual, datas, status)
│       ├── pages/
│       │   ├── Oss/         # CRUD Organizações Sociais
│       │   ├── Contratos/   # CRUD Contratos de Gestão
│       │   ├── Unidades/    # CRUD Unidades de Saúde
│       │   ├── Indicadores/ # CRUD Indicadores (Hub + List)
│       │   ├── Metas/       # CRUD Metas (Hub + List)
│       │   └── EntradaMensal/ # Acompanhamento mensal (Hub + List + Modal)
│       ├── types/           # 12 interfaces TypeScript do domínio
│       └── data/            # Mock data (fallback DEV em catches de API)
├── docs/                    # PRD_v2, ARQUITETURA_v2, banco_v2, erd_v2
├── specs/                   # Testes Mocha (acompanhamentos, metas) + specs OpenAPI
├── Dockerfile
├── docker-compose.yml
├── ecosystem.config.js      # PM2 config
└── .env.example
```

---

## Banco de Dados

O banco utiliza MySQL 8+ com as seguintes convenções:
- UUIDs como PKs (`DEFAULT (UUID())`), com nomes próprios (`contrato_id`, `acomp_id`, `meta_id`) — não `id` genérico
- Soft-delete (campo `ativo` / `paranoid: true`)
- Tabelas de histórico imutáveis (append-only)

> No registro de models (`src/models/index.js`) as chaves ficam em **snake_case singular** (`db.contrato`, `db.acompanhamento_mensal`, `db.desconto_bloco`), embora os arquivos sejam PascalCase. Há um `User.js` legado (boilerplate) além do `Usuario.js` real do domínio.

**Principais entidades:**

| Grupo | Modelos |
|---|---|
| Auth | `Usuario` (tb_usuarios), `Token` |
| Contratual | `Oss`, `Contrato`, `Unidade`, `Aditivo` |
| Indicadores | `BlocoProducao`, `Indicador`, `Meta` (com `meta_tipo`) |
| Acompanhamento | `AcompanhamentoMensal` (com snapshot fields), `NotaExplicativa` |
| Financeiro | `RepasseMensal`, `ExecucaoFinanceira`, `Rubrica`, `DescontoBloco`, `DescontoIndicador` |
| Consolidação | `Consolidacao`, `ConsolidacaoItem` |
| Regulatório | `DocumentoRegulatorio`, `Comissao` |
| Auditoria | `AuditoriaLog`, `HistoricoContrato`, `HistoricoIndicador`, `HistoricoBloco` |

---

## Cron Jobs

Três tarefas agendadas rodam automaticamente (`src/cronJobs.js`):

| Gatilho | Ação |
|---|---|
| **6º dia útil do mês, 08:00** | Calcula descontos de todos os contratos ativos |
| **Diariamente, 07:00** | Alerta documentos regulatórios vencendo em 30 dias |
| **Dias 1–5 úteis, 09:00** | Verifica pendências de dados e emite alertas via Socket.io |

---

## Deploy com PM2

```bash
# Build do frontend
cd frontend && npm run build && cd ..

# Iniciar com PM2
pm2 start ecosystem.config.js

# Comandos úteis
pm2 status
pm2 logs saudecontrol-oss
pm2 restart saudecontrol-oss
pm2 save          # Persiste a lista de processos
pm2 startup       # Configura auto-start no boot
```

---

## Testes

```bash
# Todos os testes (Mocha + Chai + Sinon) — o script já roda em --watch
npm test

# Um único arquivo (sem watch)
npx mocha specs/metas/<arquivo>.spec.js --exit

# TypeScript check (frontend — zero erros obrigatório)
cd frontend && npx tsc --noEmit

# Self-check da regra de cumprimento
node src/helper/avaliacaoCumprimento.js
```

Os testes ficam em `specs/` organizados por feature (`*.spec.js`). **Não há Jest** neste projeto; `--coverage` não está configurado.

---

## Licença

[MIT](LICENSE)
