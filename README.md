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
| **Frontend** | React 19 + TypeScript + Vite |
| **Estilização** | Tailwind CSS 4 |
| **Autenticação** | Passport.js + JWT |
| **Cache** | Redis |
| **Tempo Real** | Socket.io |
| **Agendamento** | node-cron |
| **Validação** | Joi |
| **Logging** | Winston + daily-rotate-file |
| **Testes** | Mocha + Chai + Sinon |
| **Deploy** | Docker / PM2 |

---

## Pré-requisitos

- Node.js >= 18
- MySQL 8+
- Redis 7+
- npm >= 9

---

## Configuração Local (XAMPP)

```bash
# 1. Instalar dependências (backend + frontend)
npm install
npm --prefix frontend install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite .env com as credenciais do MySQL local e um JWT_SECRET seguro

# 3. Criar o banco de dados no MySQL
# mysql -u root -p
# CREATE DATABASE oss CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 4. Executar migrações (cria as 25+ tabelas, views, procedures, triggers)
npm run db:migrate

# 5. Popular dados iniciais
# (2 OSS, 3 contratos, 5 unidades, 28 indicadores, metas 2026)
npm run db:seed

# 6. Iniciar em desenvolvimento (backend + frontend com hot-reload)
npm run dev
```

Após iniciar:
- **Frontend**: `http://localhost:3000`
- **API**: `http://localhost:3001/api`

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
PORT=3001

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

---

## Comandos Disponíveis

```bash
# Desenvolvimento (backend + frontend simultâneos)
npm run dev

# Somente backend
npm run dev:backend

# Somente frontend
npm run dev:frontend

# Build de produção (frontend → dist, depois sobe o Express)
npm run prod

# Apenas build do frontend
npm run build

# Produção (Express serve API + frontend estático)
npm start

# Testes
npm test

# Banco de dados
npm run db:migrate          # Aplica todas as migrações pendentes
npm run db:migrate:undo     # Desfaz todas as migrações
npm run db:seed             # Popula dados iniciais
npm run db:seed:undo        # Remove dados de seed
```

---

## API — Endpoints

### Autenticação (`/api/auth`)

| Método | Rota | Descrição | Acesso |
|---|---|---|---|
| `POST` | `/auth/register` | Cadastro de usuário | Público |
| `POST` | `/auth/email-exists` | Verifica disponibilidade de e-mail | Público |
| `POST` | `/auth/login` | Login — retorna access + refresh token | Público |
| `POST` | `/auth/refresh-token` | Renova access token | Autenticado |
| `POST` | `/auth/logout` | Encerra sessão (invalida token no Redis) | Autenticado |
| `PUT` | `/auth/change-password` | Altera senha | Autenticado |

### Acompanhamento Mensal (`/api/acompanhamento-mensal`)

| Método | Rota | Descrição | Perfis |
|---|---|---|---|
| `GET` | `/` | Lista acompanhamentos | Todos |
| `POST` | `/` | Registra valor realizado | Gestor_SMS, Admin, Contratadas |
| `PUT` | `/:id/aprovar` | Aprova acompanhamento | Auditora, Admin |
| `PUT` | `/:id/rejeitar` | Rejeita acompanhamento | Auditora, Admin |
| `POST` | `/calcular-descontos?mes=YYYY-MM-01` | Calcula descontos do mês | Admin, Gestor_SMS |
| `GET` | `/repasse?mes=YYYY-MM-01` | Repasse financeiro final | Admin, Gestor_SMS, Auditora, CMS |

### Indicadores (`/api/indicadores`)

| Método | Rota | Descrição | Perfis |
|---|---|---|---|
| `GET` | `/` | Lista indicadores ativos | Todos |
| `GET` | `/:id` | Detalhe de um indicador | Todos |
| `POST` | `/` | Cria indicador | Admin |
| `PUT` | `/:id` | Atualiza indicador | Admin |
| `DELETE` | `/:id` | Desativa (soft-delete) | Admin |

### Contratos (`/api/contratos`)

| Método | Rota | Descrição | Perfis |
|---|---|---|---|
| `GET` | `/` | Lista contratos | Todos |
| `GET` | `/:id` | Detalhe de um contrato | Todos |
| `POST` | `/` | Cria contrato | Admin |
| `PUT` | `/:id` | Atualiza contrato | Admin |
| `POST` | `/:id/aditivos` | Adiciona aditivo contratual | Admin |
| `POST` | `/:id/aditivos/:aditivoId/aplicar` | Aplica aditivo | Admin |

### Descontos (`/api/descontos`)

| Método | Rota | Descrição | Perfis |
|---|---|---|---|
| `GET` | `/blocos` | Descontos por bloco de produção | Todos |
| `GET` | `/indicadores` | Descontos por indicador | Todos |
| `GET` | `/repasse?mes=` | Repasse com breakdown de descontos | Admin, Gestor_SMS |
| `PUT` | `/blocos/:id/auditar` | Audita desconto de bloco | Auditora, Admin |

### Metas (`/api/metas`)

| Método | Rota | Descrição | Perfis |
|---|---|---|---|
| `GET` | `/?indicador_id=&ano=` | Lista metas | Todos |
| `POST` | `/` | Cria meta | Admin, Gestor_SMS |
| `PUT` | `/:id` | Atualiza meta | Admin, Gestor_SMS |

---

## Controle de Acesso (RBAC)

O sistema possui 8 perfis com diferentes permissões:

| Perfil | Descrição |
|---|---|
| `admin` | Acesso total ao sistema |
| `gestor_sms` | Gestão de contratos e indicadores da SMS |
| `auditora` | Aprovação e auditoria de acompanhamentos |
| `conselheiro_cms` | Visualização para o Conselho Municipal de Saúde |
| `contratada_scmc` | Entrada de dados pela OSS SCMC |
| `contratada_indsh` | Entrada de dados pela OSS INDSH |
| `central_regulacao` | Acesso à central de regulação |
| `visualizador` | Somente leitura |

---

## Arquitetura e Estrutura

O backend segue a arquitetura em camadas **Route → Controller → Service → DAO → Model**:

```
oss/
├── src/
│   ├── config/          # Validação de env vars, conexão DB, Passport.js, constantes
│   ├── controllers/     # Recebe requisições HTTP, chama services, retorna resposta
│   ├── dao/             # Data Access Objects — queries encapsuladas por entidade
│   ├── db/
│   │   ├── migrations/  # 25+ migrações Sequelize (tabelas, views, procedures, triggers)
│   │   └── seeders/     # Dados iniciais reais de Americana/SP
│   ├── helper/          # ApiError, EmailHelper, RedisHelper, responseHandler
│   ├── middlewares/     # Auth JWT, RBAC, auditoria LGPD
│   ├── models/          # 26 modelos Sequelize (class-based, com associate)
│   ├── route/           # Rotas Express com middlewares de autenticação e autorização
│   ├── service/         # Lógica de negócio (cálculo de descontos, repasses, validações)
│   ├── validator/       # Schemas Joi para validação de entrada
│   ├── app.js           # Express app (middlewares, rotas, error handlers)
│   ├── cronJobs.js      # Tarefas agendadas (node-cron)
│   └── index.js         # Ponto de entrada — HTTP server + Socket.io
├── frontend/
│   └── src/
│       ├── components/  # Componentes reutilizáveis (UI + layout)
│       ├── pages/       # Login, Dashboard, EntradaMensal, Aprovação, Relatórios, Perfil
│       ├── contexts/    # AuthContext (JWT + RBAC no cliente)
│       ├── hooks/       # useApi (fetch wrapper tipado)
│       ├── lib/         # Formatadores (moeda, percentual, datas, status)
│       ├── types/       # 12 interfaces TypeScript do domínio
│       └── data/        # Mock data para desenvolvimento
├── docs/                # PRD_v2, ARQUITETURA_v2, banco_v2, erd_v2
├── specs/               # Specs OpenAPI e testes de integração
├── Dockerfile
├── docker-compose.yml
├── ecosystem.config.js  # PM2 config
└── .env.example
```

---

## Banco de Dados

O banco utiliza MySQL 8+ com as seguintes convenções:
- UUIDs como PKs (`DEFAULT (UUID())`)
- Colunas geradas (`GENERATED ALWAYS AS STORED`)
- Soft-delete (campo `ativo` / `deleted_at`)
- Tabelas de histórico imutáveis (append-only)

**Principais entidades:**

| Grupo | Modelos |
|---|---|
| Contratual | `Oss`, `Contrato`, `Unidade`, `Aditivo` |
| Indicadores | `BlocoProducao`, `Indicador`, `Meta` |
| Acompanhamento | `AcompanhamentoMensal`, `NotaExplicativa` |
| Financeiro | `RepasseMensal`, `ExecucaoFinanceira`, `Rubrica`, `DescontoBloco`, `DescontoIndicador` |
| Consolidação | `Consolidacao`, `ConsolidacaoItem` |
| Regulatório | `DocumentoRegulatorio`, `Comissao` |
| Auditoria | `AuditoriaLog`, `HistoricoContrato`, `HistoricoIndicador`, `HistoricoBloco` |
| Auth | `Usuario`, `Token` |

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
npm run build

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
# Todos os testes (Mocha + Chai + Sinon)
npm test

# Watch mode
npm test -- --watch
```

Os testes ficam em `specs/` organizados por feature (`*.spec.js`).

---

## Licença

[MIT](LICENSE)
