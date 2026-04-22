---
slug: project-structure
category: architecture
generatedAt: 2026-04-21T00:00:00.000Z
---

# Como o codebase está organizado?

## Estrutura de Alto Nível

```
oss/
├── src/                      # Backend Node.js/Express
├── frontend/                 # Frontend React + TypeScript + Vite 8
├── docs/                     # Documentação do produto (PRD, Arquitetura, ERD)
├── specs/                    # Testes unitários Jest + specs OpenAPI
├── design/                   # Design System HTML/JSX
├── .context/                 # Base de conhecimento do projeto
├── Dockerfile                # Containerização
└── package.json              # Scripts npm (start, build, db:migrate, db:seed)
```

## Backend (`src/`)

```
src/
├── app.js                    # Entry point Express, middlewares globais
├── cronJobs.js               # Tarefas agendadas (node-cron)
├── config/
│   ├── config.js             # Configurações (JWT, DB, Redis)
│   ├── passport.js           # Estratégia JWT — carrega Usuario de tb_usuarios
│   ├── logger.js             # Winston logger
│   └── tokens.js             # Constantes de tipo de token
├── controllers/              # REST controllers
│   ├── AuthController.js
│   ├── AcompanhamentosController.js   # Entrada mensal
│   ├── AcompanhamentoController.js    # Legacy
│   ├── MetaController.js
│   ├── IndicadorController.js
│   ├── OssController.js
│   ├── UnidadeController.js
│   ├── ContratoController.js
│   └── DescontoController.js
├── dao/                      # Data Access Objects
│   ├── SuperDao.js           # Base class com find/create/update/delete
│   ├── AcompanhamentoDao.js
│   ├── IndicadorDao.js
│   ├── TokenDao.js
│   └── UserDao.js            # (boilerplate, não mais usado para auth)
├── db/
│   ├── migrations/           # 27+ migrações Sequelize
│   └── seeders/              # Dados iniciais (OSS, contratos, unidades, usuários)
├── helper/                   # Utilitários transversais
│   ├── ApiError.js
│   ├── EmailHelper.js
│   ├── RedisHelper.js
│   └── responseHandler.js
├── middlewares/
│   ├── auth.js               # Passport JWT middleware
│   ├── rbac.js               # authorize([...perfis])
│   └── auditoria.js          # Log LGPD de ações sensíveis
├── models/                   # 22 modelos Sequelize
│   ├── Usuario.js            # tb_usuarios (usuario_id, email, senha_hash, perfil)
│   ├── Oss.js, Contrato.js, Unidade.js
│   ├── Indicador.js, Meta.js, AcompanhamentoMensal.js
│   └── ... (mais 15 modelos)
├── route/
│   ├── index.js              # Router principal
│   ├── authRoute.js
│   ├── acompanhamentosRoute.js
│   ├── metaRoute.js
│   ├── indicadorRoute.js
│   ├── ossRoute.js
│   ├── unidadeRoute.js
│   └── contratoRoute.js
├── service/
│   ├── AuthService.js        # Login via tb_usuarios com senha_hash
│   ├── TokenService.js       # JWT com sub=usuario_id
│   ├── AcompanhamentosService.js  # Entrada mensal + calcularStatus
│   ├── MetaService.js
│   ├── IndicadorService.js
│   ├── OssService.js
│   ├── UnidadeService.js
│   └── ContratoService.js
└── validator/
    ├── AcompanhamentosValidator.js
    ├── MetaValidator.js
    └── IndicadorValidator.js
```

## Frontend (`frontend/src/`)

```
frontend/src/
├── main.tsx                  # Entry React + BrowserRouter
├── App.tsx                   # Rotas, lazy loading, ProtectedRoute
├── contexts/
│   └── AuthContext.tsx       # JWT real, RBAC, dark mode, auto-login DEV
├── hooks/
│   └── useApi.ts             # fetch wrapper (get/post/put/del + ApiError)
├── lib/
│   └── formatters.ts         # moeda, percentual, datas, status labels
├── types/
│   └── index.ts              # 12 interfaces globais (Perfil, Usuario, Oss, ...)
├── data/
│   └── mock.ts               # Mock data (fallback DEV em catches de API)
├── components/
│   ├── SidebarMenu.tsx       # Sidebar com NAV_ITEMS + MENU_GROUPS accordion
│   ├── layout/
│   │   ├── Header.tsx
│   │   └── ProtectedRoute.tsx
│   └── ui/
│       ├── CardMetrica.tsx
│       ├── TabelaIndicadores.tsx
│       ├── ModalEntradaDados.tsx
│       ├── BotaoAprovar.tsx
│       ├── AlertaDesconto.tsx
│       └── StatusBadge.tsx
└── pages/
    ├── LoginPage.tsx
    ├── DashboardPage.tsx
    ├── EntradaMensalPage.tsx  # Wrapper que despacha para EntradaMensal/
    ├── AprovacaoPage.tsx
    ├── RelatoriosCMSPage.tsx
    ├── PerfilOSSPage.tsx
    ├── EntradaMensal/         # Módulo de acompanhamento mensal
    │   ├── types.ts           # AcompanhamentoRecord, calcularStatusPreview
    │   ├── EntradaMensalHub.tsx   # Cards por unidade com progresso
    │   ├── EntradaMensalList.tsx  # Tabela virtualizada de indicadores
    │   └── EntradaMensalModal.tsx # Modal criar/editar acompanhamento
    ├── Oss/                   # CRUD Organizações Sociais
    │   ├── types.ts           # OssRecord, mascaraCNPJ, validarCNPJ
    │   ├── OssList.tsx
    │   ├── OssFormModal.tsx
    │   └── OssDeleteModal.tsx
    ├── Contratos/             # CRUD Contratos de Gestão
    │   ├── types.ts           # ContratoRecord, formatarMoeda
    │   ├── ContratosList.tsx
    │   ├── ContratosFormModal.tsx
    │   └── ContratosDeleteModal.tsx
    ├── Unidades/              # CRUD Unidades de Saúde
    │   ├── types.ts           # UnidadeRecord, mascaraCNPJUnidade
    │   ├── UnidadesList.tsx
    │   ├── UnidadesFormModal.tsx
    │   └── UnidadesDeleteModal.tsx
    ├── Indicadores/           # CRUD Indicadores com hub por unidade
    │   ├── types.ts           # IndicadorRecord, formatarMeta
    │   ├── IndicadoresHub.tsx
    │   ├── IndicadoresList.tsx
    │   ├── IndicadoresFormModal.tsx
    │   └── IndicadoresDeleteModal.tsx
    └── Metas/                 # CRUD Metas com meta_tipo
        ├── types.ts           # MetaRecord, formatarValor
        ├── MetasHub.tsx
        ├── MetasList.tsx
        ├── MetasFormModal.tsx
        └── MetasDeleteModal.tsx
```

## Padrões de Organização

### Backend
Cada recurso segue: `Route` → `Controller` → `Service` → `DAO` → `Model`. Controllers nunca acessam DAO diretamente.

### Frontend
Cada módulo CRUD em `pages/<Entidade>/` segue: `types.ts` → `List.tsx` → `FormModal.tsx` → `DeleteModal.tsx`. Componentes `Field` e `inputCls` são definidos fora do modal para evitar re-montagem.

### Módulos Hub+List
Módulos com seleção de entidade pai (Indicadores, Metas, EntradaMensal) usam um componente `Hub` para seleção + navegação, e `List` para a tabela virtualizada.
