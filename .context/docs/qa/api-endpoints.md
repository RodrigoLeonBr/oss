---
slug: api-endpoints
category: features
generatedAt: 2026-04-21T00:00:00.000Z
relevantFiles:
  - src/route/index.js
  - src/route/authRoute.js
  - src/route/acompanhamentosRoute.js
  - src/route/metaRoute.js
  - src/route/indicadorRoute.js
  - src/route/ossRoute.js
  - src/route/unidadeRoute.js
  - src/route/contratoRoute.js
---

# Quais endpoints de API existem?

Base URL: `http://localhost:5000/api`

## Autenticação

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/auth/login` | — | Login com email/password → JWT |
| POST | `/auth/register` | — | Registro de usuário |
| POST | `/auth/logout` | ✓ | Logout (revoga refresh token) |
| POST | `/auth/refresh-tokens` | — | Renova access token |

**Body de login:**
```json
{ "email": "admin@americana.sp.gov.br", "password": "Oss@2026" }
```

**Resposta de login:**
```json
{
  "data": { "usuario_id": "...", "nome": "...", "email": "...", "perfil": "admin" },
  "tokens": {
    "access": { "token": "eyJ...", "expires": "..." },
    "refresh": { "token": "eyJ...", "expires": "..." }
  }
}
```

## Acompanhamentos (Entrada Mensal)

| Método | Rota | Auth | Perfis | Descrição |
|--------|------|------|--------|-----------|
| GET | `/acompanhamentos` | ✓ | todos | Lista com filtros (`unidadeId`, `mesReferencia`) |
| POST | `/acompanhamentos` | ✓ | gestor_sms, admin | Cria/atualiza acompanhamento mensal |
| PUT | `/acompanhamentos/:id` | ✓ | gestor_sms, admin | Edita acompanhamento |
| DELETE | `/acompanhamentos/:id` | ✓ | admin | Remove acompanhamento |

**Query GET:** `?unidadeId=<uuid>&mesReferencia=YYYY-MM-01`

## Metas

| Método | Rota | Auth | Perfis | Descrição |
|--------|------|------|--------|-----------|
| GET | `/metas` | ✓ | todos | Lista metas com filtros |
| POST | `/metas` | ✓ | gestor_sms, admin | Cria meta |
| PUT | `/metas/:id` | ✓ | gestor_sms, admin | Edita meta |
| DELETE | `/metas/:id` | ✓ | admin | Remove meta |

## Indicadores

| Método | Rota | Auth | Perfis | Descrição |
|--------|------|------|--------|-----------|
| GET | `/indicadores` | ✓ | todos | Lista indicadores |
| POST | `/indicadores` | ✓ | admin | Cria indicador |
| PUT | `/indicadores/:id` | ✓ | admin | Edita indicador |
| DELETE | `/indicadores/:id` | ✓ | admin | Remove indicador |

## OSS (Organizações Sociais)

| Método | Rota | Auth | Perfis | Descrição |
|--------|------|------|--------|-----------|
| GET | `/oss` | ✓ | todos | Lista OSS |
| GET | `/oss/:id` | ✓ | todos | Detalhe de OSS |
| POST | `/oss` | ✓ | admin | Cria OSS |
| PUT | `/oss/:id` | ✓ | admin | Edita OSS |
| DELETE | `/oss/:id` | ✓ | admin | Remove OSS (soft delete) |

## Unidades de Saúde

| Método | Rota | Auth | Perfis | Descrição |
|--------|------|------|--------|-----------|
| GET | `/unidades` | ✓ | todos | Lista unidades (`?ativo=1`) |
| GET | `/unidades/:id` | ✓ | todos | Detalhe de unidade |
| POST | `/unidades` | ✓ | admin | Cria unidade |
| PUT | `/unidades/:id` | ✓ | admin | Edita unidade |
| DELETE | `/unidades/:id` | ✓ | admin | Remove unidade |

## Contratos de Gestão

| Método | Rota | Auth | Perfis | Descrição |
|--------|------|------|--------|-----------|
| GET | `/contratos` | ✓ | todos | Lista contratos |
| GET | `/contratos/:id` | ✓ | todos | Detalhe do contrato |
| POST | `/contratos` | ✓ | admin | Cria contrato |
| PUT | `/contratos/:id` | ✓ | admin | Edita contrato |
| DELETE | `/contratos/:id` | ✓ | admin | Remove contrato |

## Autenticação nas Requisições

Todas as rotas com `Auth ✓` exigem header:

```
Authorization: Bearer <access_token>
```

O `useApi` do frontend injeta este header automaticamente lendo `auth.token` do `AuthContext`.

## Formato de Respostas

Sucesso:
```json
{ "status": true, "code": 200, "message": "...", "data": { ... } }
```

Erro:
```json
{ "status": false, "code": 400, "message": "Mensagem de erro" }
```

O `unwrap()` helper em cada `types.ts` extrai o `data` da resposta.
