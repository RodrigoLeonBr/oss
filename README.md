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
| **Frontend** | React 18 + TypeScript + Vite 8 (Rolldown) |
| **Estilização** | Tailwind CSS com design tokens CSS customizados |
| **Autenticação** | Passport.js + JWT (`tb_usuarios` / `senha_hash`) |
| **Cache** | Redis |
| **Tempo Real** | Socket.io |
| **Agendamento** | node-cron |
| **Validação** | Joi |
| **Logging** | Winston + daily-rotate-file |
| **Testes** | Jest |
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

# 5. Executar migrações (cria as 27+ tabelas)
npm run db:migrate

# 6. Popular dados iniciais
# (2 OSS, 3 contratos, 5 unidades, 28 indicadores, metas 2026, usuário admin)
npm run db:seed

# 7. Criar credenciais de auto-login DEV (não commitar)
cat > frontend/.env.development << EOF
VITE_DEV_EMAIL=admin@americana.sp.gov.br
VITE_DEV_PASSWORD=Oss@2026
VITE_API_URL=http://localhost:5000
EOF

# 8. Iniciar o backend
npm start
# API em http://localhost:5000

# 9. Em outro terminal, iniciar o frontend
cd frontend && npm run dev
# Frontend em http://localhost:3000
```

> O frontend faz **auto-login automático** em DEV com as credenciais de `frontend/.env.development`, usando autenticação real contra `tb_usuarios`.

---

## Configuração com Docker

```bash
# Subir todos os serviços (MySQL, Redis, backend, frontend)
docker compose up -d

# Executar migrações e seeds no container
docker compose exec app npm run db:migrate
docker compose exec app npm run db:seed

# Acompanhar logs
docker compose logs -f app
```

> O arquivo `docker-compose.yml` na raiz do projeto configura automaticamente MySQL, Redis e a aplicação.

---

## Variáveis de Ambiente

Copie `.env.example` para `.env` e ajuste os valores:

```dotenv
# Servidor
NODE_ENV=development
PORT=5000

# MySQL
DB_HOST=localhost
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
VITE_DEV_EMAIL=admin@americana.sp.gov.br
VITE_DEV_PASSWORD=Oss@2026
VITE_API_URL=http://localhost:5000
```

---

## Comandos Disponíveis

### Backend (raiz)

```bash
npm start                   # Servidor Express (porta 5000)
npm test                    # Testes Jest
npm run db:migrate          # Aplica migrações pendentes
npm run db:migrate:undo     # Desfaz última migração
npm run db:seed             # Popula dados iniciais
npm run db:seed:undo        # Remove dados de seed
```

### Frontend (`cd frontend`)

```bash
npm run dev                 # Dev server Vite (porta 3000, proxy /api → :5000)
npm run build               # Build produção (tsc + vite build com Rolldown)
npm run preview             # Preview do build de produção
npx tsc --noEmit            # Verificação TypeScript (zero erros obrigatório)
```

---

## API — Endpoints

Base URL: `http://localhost:5000/api`

### Autenticação (`/api/auth`)

| Método | Rota | Descrição | Acesso |
|---|---|---|---|
| `POST` | `/auth/login` | Login — retorna access + refresh token | Público |
| `POST` | `/auth/register` | Cadastro de usuário | Público |
| `POST` | `/auth/refresh-tokens` | Renova access token | Público |
| `POST` | `/auth/logout` | Encerra sessão (invalida token) | Autenticado |
| `PUT` | `/auth/change-password` | Altera senha | Autenticado |

**Body de login:**
```json
{ "email": "admin@americana.sp.gov.br", "password": "Oss@2026" }
```

**Resposta:**
```json
{
  "data": { "usuario_id": "...", "nome": "...", "email": "...", "perfil": "admin" },
  "tokens": { "access": { "token": "eyJ..." }, "refresh": { "token": "eyJ..." } }
}
```

### Acompanhamentos / Entrada Mensal (`/api/acompanhamentos`)

| Método | Rota | Descrição | Perfis |
|---|---|---|---|
| `GET` | `/?unidadeId=&mesReferencia=YYYY-MM-01` | Lista acompanhamentos | Todos |
| `POST` | `/` | Registra valor realizado | Gestor_SMS, Admin |
| `PUT` | `/:id` | Atualiza acompanhamento | Gestor_SMS, Admin |
| `DELETE` | `/:id` | Remove acompanhamento | Admin |

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

O sistema possui 5 perfis de usuário:

| Perfil | Descrição |
|---|---|
| `admin` | Acesso total ao sistema |
| `gestor_sms` | Gestão de contratos e indicadores da SMS |
| `auditora` | Aprovação e auditoria de acompanhamentos |
| `cms` | Visualização para o Conselho Municipal de Saúde |
| `contratada` | Entrada de dados pela OSS contratada |

O backend usa `authorize([...perfis])` middleware e o frontend usa `ProtectedRoute` com `allowedPerfis`.

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
│   │   ├── migrations/      # 27+ migrações Sequelize
│   │   └── seeders/         # Dados iniciais reais de Americana/SP
│   ├── helper/              # ApiError, EmailHelper, RedisHelper, responseHandler
│   ├── middlewares/         # auth() JWT, authorize() RBAC, auditoria LGPD
│   ├── models/              # 22 modelos Sequelize (Usuario, Oss, Contrato, Indicador...)
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
├── specs/                   # Testes Jest (acompanhamentos, metas) + specs OpenAPI
├── Dockerfile
├── docker-compose.yml
├── ecosystem.config.js      # PM2 config
└── .env.example
```

---

## Banco de Dados

O banco utiliza MySQL 8+ com as seguintes convenções:
- UUIDs como PKs (`DEFAULT (UUID())`)
- Soft-delete (campo `ativo`)
- Tabelas de histórico imutáveis (append-only)

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
# Todos os testes (Jest)
npm test

# Watch mode
npm test -- --watch

# Cobertura
npm test -- --coverage

# TypeScript check (frontend — zero erros obrigatório)
cd frontend && npx tsc --noEmit
```

Os testes ficam em `specs/` organizados por feature (`*.spec.js`).

---

## Licença

[MIT](LICENSE)
