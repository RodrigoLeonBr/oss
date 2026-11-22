# Wiki da CAF: esquema

Esquema e modelos da camada de conhecimento do projeto. A wiki com dados reais fica em `prestacao-vault/conhecimento/` (fora do git, conforme `.claude/rules/security.md`); aqui ficam só a estrutura e os modelos, sem nenhum dado da prestação. Quando a wiki for criada (fase 6), este arquivo é copiado para `prestacao-vault/conhecimento/AGENTS.md`.

## Três camadas

| Camada | Onde | Quem escreve | Papel |
|---|---|---|---|
| Evidência | `2025/`, `2026/` (PDF) e `prestacao-vault/vault/` (.md) | conversão automática | prova; nunca editada à mão |
| Estruturada | banco `oss` (MySQL) | sistema, carregadores e importadores | única fonte de números e das avaliações da CAF |
| Conhecimento | `prestacao-vault/conhecimento/` | LLM, revisada pela CAF | entendimento: contexto, histórico, reincidência, decisões |

## Estrutura

```
conhecimento/
  AGENTS.md        cópia deste esquema
  index.md         mapa de conteúdo, uma linha por nota
  log.md           registro cronológico, só acréscimo
  contratos/       009-2023-scmc.md, 066-2024-dona-rosa.md, 517-2025-zanaga.md
  unidades/        hma.md, unacon.md, upa-cil.md, upa-dr.md, upa-zan.md
  indicadores/     <sigla-unidade>-<codigo>.md
  apontamentos/    <id>.md (condições de renovação, observações da comissão, pedidos de informação)
  periodos/        <ano>-<n>quad.md
  decisoes/        <aaaa-mm-dd>-<assunto>.md
  fontes/          fichas dos pareceres e relatórios do acervo da CAF
  glossario.md
```

## Convenções

1. Chaves iguais às do banco e do vault: contrato como gravado no banco (009/2023, 066/2024, 517/2025), sigla da unidade (HMA, UNACON, UPA-CIL, UPA-DR, UPA-ZAN), código do indicador e competência `AAAA-MM`.
2. Nenhum número digitado à mão. Números entram por blocos gerados (`npm run conhecimento:dados`, fase 6):
   ```
   <!-- dados:cumprimento contrato=066/2024 periodo=2026-2quad -->
   (preenchido pelo gerador, com data de corte)
   <!-- /dados -->
   ```
3. Toda afirmação qualitativa leva link para a fonte (`[[vault/2026/upa_dona_rosa/agosto/recorte/educação permanente]]` ou documento do acervo) com página.
4. Pessoas só pelo cargo. Nenhum dado de paciente.
5. Entrada de log no formato `## [AAAA-MM-DD] <operacao> | <unidade> <competencia> | <resumo>`, para que `grep "^## \[" log.md | tail` mostre as últimas.

## Rotinas

| Rotina | Quando | O que faz |
|---|---|---|
| Ingestão | depois de cada incorporação (`npm run pos-incorporacao`) | atualiza notas da unidade, indicadores e apontamentos afetados; acrescenta ao log |
| Consulta | no chat, pelo MCP `buscar_conhecimento` (fase 6) | responde pelo `index.md` e pelo frontmatter, citando as fontes |
| Revisão (lint) | mensal e no cron noturno | contradições (ex.: numeração de contratos), apontamento sem atualização, nota sem fonte, número fora de bloco, indicador não cumprido sem justificativa avaliada |
