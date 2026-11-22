---
paths:
  - prestacao-vault/**
  - 2025/**
  - 2026/**
  - src/db/carrega*.js
  - src/incorporacao/**
---

# Vault da prestação de contas

Dados sensíveis da SMS. Escopada: carrega ao tocar no vault, nos PDFs, nos carregadores ou na rotina de incorporação.

## Onde fica cada coisa

- PDFs originais: `2026/<mes>/<unidade>/...` e `2025/<unidade>/<mes>/...` (nomes de pasta como a OSS enviou).
- Texto convertido: `prestacao-vault/vault/<ano>/<unidade>/<mes>/<tipo>/[subpastas]/<assunto>.md`, com `<assunto>.tables.json` (tabelas do PlanejaDocs) e, em escalas, `.escala.tsv` e `.escala.json` ao lado.
- `prestacao-vault/vault/financeiro-historico/`: pareceres e análises consolidados (2023 a 2026).
- `prestacao-vault/escalas/`: instruções de extração de escala (`INSTRUCOES_CLAUDE.md`) e filas.
- `prestacao-vault/extracoes/` (fase 3 em diante) e `prestacao-vault/conhecimento/` (fase 6): saídas de extração e wiki da CAF.

## Frontmatter obrigatório do .md

`ano`, `unidade`, `unidade_nome`, `mes`, `tipo`, `subpath`, `assunto`, `origem` (caminho do PDF relativo à raiz do repositório), `paginas`, `scanned`, `ocr`, `convertido_em`. Nenhum script remove ou renomeia esses campos.

## Unidades

| Vault (`units.json`) | Sigla em `tb_unidades` | Contrato no banco | Observação |
|---|---|---|---|
| `hm` | HMA | 009/2023 (apelido 001/2023) | SCMC |
| `unacon` | UNACON | 009/2023 | SCMC |
| `upa_cillos` | UPA-CIL | 009/2023 | UPA Cillo = UPA São José |
| `upa_dona_rosa` | UPA-DR | 066/2024 (apelido 025/2025) | SCMC, CNES 4777220 |
| `pa_zanaga` | UPA-ZAN | 517/2025 (chamamento 002/2025) | INDSH |

Variação nova de nome de unidade entra em `prestacao-vault/units.json`, nunca no código. A numeração dos contratos ainda está a confirmar (`checar_numeracao` no MCP).

## Tipos

A pasta de origem define o tipo (`recortes` vira `recorte`, escalas vira `escala` etc., em `classify_tipo` de `convert_prestacao.py`). O INDSH (PA Zanaga) entrega PDFs soltos na pasta da unidade, que hoje caem em `outros`; a correção por padrão de nome (`regras_tipo.json`) é da fase 1. Não crie tipo novo sem registrá-lo na regra e no catálogo.

## Regras

1. Nada daqui vai para o git. Não copie conteúdo para `docs/`, `specs/`, código, commit ou PR.
2. Reclassificar ou renomear nunca exige reconverter: mova o `.md` junto com `.tables.json` e `.escala.*` e ajuste só o frontmatter. Reconversão (`--force`) só quando o texto estiver ruim.
3. Conversão: `py -3.13 convert_prestacao.py --ano <a> [--mes <m>]` em `prestacao-vault/` (não use `python3`, que no Windows é o stub da Store). Requer o PlanejaDocs em `localhost:9000`. O resume é idempotente.
4. Escalas: leia o PDF, não o `.md`, conforme `prestacao-vault/escalas/INSTRUCOES_CLAUDE.md`; carga por `node src/db/carregaEscalas.js <dir>`. O arquivo pode chegar com nome errado, período diferente da competência ou duplicado: confira competência, período e duplicidade antes de carregar (validação automática na fase 2).
5. Dados pessoais: escalas e atas trazem nomes e registros profissionais. Nunca registre dado de paciente. Nomes de profissionais só onde o fluxo exige (MCP com `identificar=true`).
6. Estado do acervo: `RESUME_2026.md` e `manifest.csv` estão desatualizados (o manifest é sobrescrito a cada execução). A fonte passa a ser `tb_documento` e `ESTADO.md` (fase 1); até lá, conte os `.md` no disco.
7. Toda incorporação termina com `npm run pos-incorporacao` (o hook faz no Claude Code) e com a etapa de memória da skill `incorporacao`.
