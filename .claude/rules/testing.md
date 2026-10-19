# Testing

Carregada em toda sessão.

- Runner é **mocha + chai + sinon** — **não** Jest (ignore qualquer menção a Jest no README antigo).
- Specs em `specs/`, organizadas por feature: `specs/metas/`, `specs/acompanhamentos/`, `specs/Authentication/`.
- Suite completa: `npm test` (roda em `--watch`).
- **Um** arquivo (sem watch): `npx mocha specs/metas/<arquivo>.spec.js --exit`.
- Type-check do frontend (obrigatório, zero erros antes de commit): `cd frontend && npx tsc --noEmit`.
- Regra de cumprimento tem self-check embutido: `node src/helper/avaliacaoCumprimento.js` (asserts, imprime `OK`).
- Lógica não-trivial nova (branch, loop, dinheiro, cumprimento/escopo) deixa **um** check runnable. Sem frameworks extras, sem fixtures, salvo pedido.
