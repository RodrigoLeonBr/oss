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

A pasta de origem define o tipo (`recortes` vira `recorte`, escalas vira `escala` etc., em `classify_tipo` de `convert_prestacao.py`). PDF solto na pasta do mês (padrão do INDSH no PA Zanaga) recebe o tipo pelo nome, conforme `prestacao-vault/regras_tipo.json`, usado pela conversão e por `npm run reclassificar` (`src/incorporacao/tipos.js`). Tipos por nome: `comissao`, `escala`, `capacitacao`, `pesquisa_satisfacao`, `ouvidoria`, `regulatorio`, `rh`, `financeiro`, `oficio`, `protocolo`, `relatorio_assistencial`. Tipo novo entra primeiro em `regras_tipo.json` (seção `tipos`). No reclassificador, `.md` com `.escala.json` ao lado vira `escala` independentemente do nome. A reclassificação do PA Zanaga 2026 foi aplicada em 22/11/2026 (557 arquivos; planos em `prestacao-vault/reclassificacao/`).

Antes de reconverter uma unidade, aplique a reclassificação pendente: o resume da conversão pula pelo caminho de destino, e um `.md` ainda em `outros` seria convertido de novo na pasta do tipo novo.

## Regras

1. Nada daqui vai para o git. Não copie conteúdo para `docs/`, `specs/`, código, commit ou PR.
2. Reclassificar ou renomear nunca exige reconverter: mova o `.md` junto com `.tables.json` e `.escala.*` e ajuste só o frontmatter. Reconversão (`--force`) só quando o texto estiver ruim.
3. Conversão: `py -3.13 convert_prestacao.py --ano <a> [--mes <m>]` em `prestacao-vault/` (não use `python3`, que no Windows é o stub da Store). Requer o PlanejaDocs em `localhost:9000`. O resume é idempotente.
4. Escalas: leia o PDF, não o `.md`, conforme `prestacao-vault/escalas/INSTRUCOES_CLAUDE.md`; carga por `node src/db/carregaEscalas.js <dir>`. O arquivo pode chegar com nome errado, período diferente da competência ou duplicado: confira competência, período e duplicidade antes de carregar (validação automática na fase 2).
5. Dados pessoais: escalas e atas trazem nomes e registros profissionais. Nunca registre dado de paciente. Nomes de profissionais só onde o fluxo exige (MCP com `identificar=true`).
6. Estado do acervo: `prestacao-vault/ESTADO.md`, gerado do catálogo (`prestacao-vault/indice/vault.db`) por `npm run catalogo:atualizar`; no banco, `tb_documento` (`--banco`). `RESUME_2026.md` e `manifest.csv` ficam só como histórico. Busca de texto: índice FTS5 do catálogo, pela `buscar_vault` do MCP. Catálogo e índice exigem Node 22.13 ou superior (`node:sqlite`).
7. Toda incorporação termina com `npm run pos-incorporacao` (o hook faz no Claude Code) e com a etapa de memória da skill `incorporacao`.
