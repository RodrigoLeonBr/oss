# Sistema OSS Saúde Americana

API REST para acompanhamento de contratos de gestão em saúde pública - SMS Americana/SP.
Baseado em Node.js + Express + Sequelize + MySQL. Conformidade LGPD e TCESP.

## Setup Rápido

```bash
# 1. Instalar dependências
npm install
npm --prefix frontend install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite .env: DB_HOST, DB_USER, DB_PASS, DB_NAME=oss, JWT_SECRET

# 3. Criar o banco no MySQL
# CREATE DATABASE oss CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 4. Executar migrações (cria as 13+ tabelas)
npm run db:migrate

# 5. Popular dados iniciais (contrato SCMC-2026-001, unidades, 28 indicadores, metas 2026)
npm run db:seed

# 6. Iniciar em desenvolvimento (backend + frontend)
npm run dev
```

## Execução Unificada (Backend + Frontend)

### Desenvolvimento

- `npm run dev`
  - Backend Express em `http://localhost:3001`
  - Frontend Vite em `http://localhost:3000` (com proxy `/api` para `3001`)
  - Hot-reload ativo para frontend e backend

### Produção (Servidor Único Express)

- `npm run prod`
  - Executa `vite build` em `frontend/dist`
  - Inicia Express em `http://localhost:3001`
  - Express serve API (`/api/*`) e frontend estático (`frontend/dist`)
  - Rotas SPA (`/dashboard`, `/relatorios`, etc.) retornam `index.html`

## Endpoints Principais

| Método | Endpoint | Descrição | Perfis |
|--------|----------|-----------|--------|
| POST | `/api/auth/login` | Login JWT | Público |
| GET | `/api/acompanhamento-mensal` | Listar acompanhamentos | Todos |
| POST | `/api/acompanhamento-mensal` | Registrar valor realizado | Gestor_SMS |
| PUT | `/api/acompanhamento-mensal/:id/aprovar` | Aprovar acompanhamento | Auditora |
| POST | `/api/acompanhamento-mensal/calcular-descontos?mes=YYYY-MM-01` | Calcular descontos | Admin, Gestor_SMS |
| GET | `/api/acompanhamento-mensal/repasse?mes=YYYY-MM-01` | Repasse final do mês | Admin, Gestor_SMS, Auditora, CMS |
| GET | `/api/indicadores` | Listar indicadores ativos | Todos |
| POST | `/api/indicadores` | Criar indicador | Admin |
| DELETE | `/api/indicadores/:id` | Desativar (soft-delete) | Admin |
| GET | `/api/contratos` | Listar contratos | Todos |
| GET | `/api/contratos/:id/descontos` | Descontos de um contrato | Admin, Gestor_SMS, Auditora, CMS |
| GET | `/api/descontos?mes=` | Listar descontos | Todos |
| PUT | `/api/descontos/:id/auditar` | Auditar desconto | Auditora |
| GET | `/api/descontos/repasse?mes=` | Repasse com breakdown | Admin, Gestor_SMS |
| GET | `/api/metas?indicador_id=&ano=` | Listar metas | Todos |
| POST | `/api/metas` | Criar meta | Admin, Gestor_SMS |


## Features

- **ORM**: [Sequelize](https://sequelize.org/)  orm for object data modeling
- **Migration and Seed**: DB migration and Seed using [Sequelize-CLI](https://github.com/sequelize/cli) 
- **Authentication and authorization**: using [passport](http://www.passportjs.org)
- **Error handling**: centralized error handling
- **Validation**: request data validation using [Joi](https://github.com/hapijs/joi)
- **Logging**: using [winston](https://github.com/winstonjs/winston) 
- **Testing**: unittests using [Mocha](https://mochajs.org/)
- **Caching**: Caching using [Redis](https://redis.io/)
- **Bidirectional Communication**: using [Scoket](https://socket.io/)
- **Job scheduler**: with [Node-cron](https://www.npmjs.com/package/node-cron)
- **Dependency management**: with [Yarn](https://yarnpkg.com)
- **Environment variables**: using [dotenv](https://github.com/motdotla/dotenv) and [cross-env](https://github.com/kentcdodds/cross-env#readme)
- **CORS**: Cross-Origin Resource-Sharing enabled using [cors](https://github.com/expressjs/cors)
- **Docker support**
- **Linting**: with [ESLint](https://eslint.org) and [Prettier](https://prettier.io)

## Commands

Running locally:

```bash
npm run dev
```

Running in production:

```bash
npm run prod
```

Testing:

```bash
# run all tests
npm test

```

## Environment Variables

The environment variables can be found and modified in the `.env` file. They come with these default values:

```bash
#Server environment
NODE_ENV=development
#Port number
PORT=3001

#Db configuration
DB_HOST=db-host
DB_USER=db-user
DB_PASS=db-pass
DB_NAME=db-name


# JWT secret key
JWT_SECRET=your-jwt-secret-key
# Number of minutes after which an access token expires
JWT_ACCESS_EXPIRATION_MINUTES=5
# Number of days after which a refresh token expires
JWT_REFRESH_EXPIRATION_DAYS=30

#Log config
LOG_FOLDER=logs/
LOG_FILE=%DATE%-app-log.log
LOG_LEVEL=error

#Redis
REDIS_HOST=redis-host
REDIS_PORT=6379
REDIS_USE_PASSWORD=no
REDIS_PASSWORD=your-password

```

## Project Structure

```
specs\
src\
 |--config\         # Environment variables and configuration related things
 |--controllers\    # Route controllers (controller layer)
 |--dao\            # Data Access Object for models
 |--db\             # Migrations and Seed files
 |--models\         # Sequelize models (data layer)
 |--routes\         # Routes
 |--services\       # Business logic (service layer)
 |--helper\         # Helper classes and functions
 |--validations\    # Request data validation schemas
 |--app.js          # Express app
 |--cronJobs.js     # Job Scheduler
 |--index.js        # App entry point
frontend\
 |--src\            # React + TypeScript (Vite)
 |--vite.config.ts  # Dev server + proxy /api
ecosystem.config.js # PM2 config (npm start)
```

## PM2 (Deploy Local SMS Americana)

```bash
# Build + start com PM2
npm run build
pm2 start ecosystem.config.js

# Comandos úteis
pm2 status
pm2 logs saudecontrol-oss
pm2 restart saudecontrol-oss
```

## License

[MIT](LICENSE)
