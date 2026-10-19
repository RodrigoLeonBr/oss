---
paths:
  - src/route/**
  - src/controllers/**
  - src/service/**
  - src/dao/**
  - src/validator/**
---

# API / backend (escopada por paths)

Carrega sob demanda ao tocar no backend. Para RBAC/escopo/LGPD ver `security.md` (sempre ativa).

## Camadas

`Route → Controller → Service → DAO → Model (Sequelize)`

- **Controller** (`src/controllers/`): valida com schema Joi (`schema.validate(...)` → `BAD_REQUEST` no `error`), chama Service, responde `{ status: true, data, message }`, erros via `next(e)`.
- **Service** (`src/service/`): regra de negócio. Recebe `ossIdFiltro` (escopo) e repassa aos asserts/queries.
- **DAO** (`src/dao/`): `SuperDao` base genérica (`findById`, `findByWhere`, `updateOrCreate`, `bulkCreate`...) + DAOs especializados. Services também usam `db.<model>` direto para queries com `include`.
- **Validator** (`src/validator/`): schemas Joi, um por recurso.
- **Erros**: só `ApiError(httpStatus.X, msg)`; `middlewares/error.js` (`errorConverter` + `errorHandler`) formata.

## Rotas montadas (`src/route/index.js`, base `/api`)

`/auth` · `/oss` · `/unidades` · `/acompanhamento-mensal` · `/acompanhamentos` · `/indicadores` · `/contratos` · `/descontos` · `/metas` · `/usuarios` · `/permissoes` · `/relatorios` · `GET /health`.

> Há **dois** módulos de acompanhamento montados (`/acompanhamento-mensal` e `/acompanhamentos`) — confirme qual antes de editar.

## Regra de cumprimento — fonte única

`src/helper/avaliacaoCumprimento.js` é a única fonte da classificação `cumprido|parcial|nao_cumprido|aguardando`. Espaço de percentual (`pct = realizado/base*100`), direção `maior_igual`/`menor_igual`, faixas `meta_parcial`/`meta_minima` (defaults 100/85 e 100/115). Avaliação **viva** (recalculada na leitura, não persistida); snapshots usam `meta_tipo_snap`. Não reimplemente em controller/frontend.
