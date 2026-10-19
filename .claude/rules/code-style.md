# Code style

Convenção de estilo do repositório. Carregada em toda sessão.

- **Idioma**: domínio e código em **português** (nomes de variáveis, funções, rotas, models, mensagens). Mantenha o idioma do arquivo que estiver editando.
- **Backend**: controllers são classes com métodos arrow-function, instanciadas com `new` no arquivo de rota. Services sem estado. ESLint `airbnb-base` + Prettier.
- **Resposta HTTP padrão**: `res.status(...).json({ status: true, data, message })`. Nunca montar JSON de erro à mão — lançar `ApiError(httpStatus.X, msg)` e deixar `middlewares/error.js` formatar.
- **Models**: nomes snake_case singular (`db.contrato`, `db.acompanhamento_mensal`) e PKs nomeadas (`contrato_id`, `acomp_id`), não `id` genérico.

## Frontend (React 19 + TS + Vite 8)

- Página CRUD: `types.ts` → `List.tsx` → `FormModal.tsx` → `DeleteModal.tsx`, lazy em `App.tsx` + rota.
- Defina componentes `Field` **fora** do modal pai — senão perdem foco a cada render.
- Tabela responsiva: `overflow-x-auto` + `minWidth` envolvendo **header + body** juntos.
- `erasableSyntaxOnly` ligado: declare a propriedade antes do `constructor`, não como parameter property.
- Fetch via hook `useApi` (lança `ApiError`). Em DEV, 401 não desloga: componente cai para mock no `catch`.
