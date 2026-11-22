---
name: incorporacao
description: Roteiro para incorporar documentos da prestação de contas das OSS (conversão de PDF, escalas, financeiro, extrações, quadrimestrais, atas, capacitações) ao vault e ao banco, e para atualizar as memórias depois. Use sempre que converter, carregar, importar, reclassificar ou corrigir dado da prestação, quando o usuário chamar /incorporar ou quando o hook pos-incorporacao avisar.
---

# Incorporação de documentos da prestação

Plano por fases no Whiteboard "Plano de incorporação do vault ao SaúdeControl OSS". Regras de fundo: `.claude/rules/vault.md` e `.claude/rules/extracao.md`. Piloto: `pa_zanaga` e `upa_dona_rosa`.

## Parâmetros

| Parâmetro | Valores |
|---|---|
| `unidade` | `hm`, `unacon`, `upa_cillos`, `upa_dona_rosa`, `pa_zanaga` |
| `competencia` ou `periodo` | `AAAA-MM` ou `AAAA-1quad`, `AAAA-2quad`, `AAAA-3quad` |
| `etapa` | `conversao`, `escalas`, `financeiro`, `justificativas`, `comissoes`, `capacitacoes`, `quadrimestral`, `memoria`, `tudo` |

Se faltar algum, pergunte antes de executar qualquer comando. Não deduza a unidade pelo contexto da conversa.

## Ordem de execução

| # | Etapa | Como fazer hoje | Automação |
|---|---|---|---|
| 1 | Conferir origem | Listar os PDFs da competência em `2026/<mes>/<unidade>/` (ou `2025/<unidade>/<mes>/`) e comparar com `listar_prestacoes` do MCP | manual |
| 2 | Converter | `py -3.13 convert_prestacao.py --ano <a> --mes <m>` em `prestacao-vault/` (PlanejaDocs em `localhost:9000`); anotar erros do `convert.log` | hook registra |
| 3 | Catalogar e reclassificar | Até a F1: contar `.md` x PDF por tipo e anotar arquivos em `outros` | F1 |
| 4 | Validar | Escalas: conferir competência, período, duplicidade e setor de cada `.escala.tsv` antes da carga. Extrações: conferir trecho e página | F2 (escalas), F3 a F5 |
| 5 | Extrair | Skill `extrair-prestacao` por tipo, saída em `prestacao-vault/extracoes/` | F3 a F5 |
| 6 | Carregar e recalcular | `node src/db/carregaEscalas.js <dir>`, carregadores financeiros, importador de extrações | hook registra |
| 7 | Pós-incorporação | `npm run pos-incorporacao -- --unidade=<u> --competencia=<c> --gatilho=manual --comando="<o que foi feito>"`; o hook faz sozinho para os comandos de `src/incorporacao/gatilhos.js` | F0 |
| 8 | Memória | Ver abaixo | F0 (registro), F6 (automática) |
| 9 | Relatório | Ver modelo abaixo | manual |

## Etapa de memória (obrigatória)

Depois de qualquer incorporação ou correção, antes de dar a tarefa por encerrada:

1. `npm run pos-incorporacao -- --pendentes` para ver o que está aberto.
2. `prestacao-vault/ESTADO.md`: atualizar a contagem de PDFs, `.md`, erros e arquivos em `outros` da unidade e competência. Até a F1 a contagem é feita no disco; depois o arquivo é gerado do catálogo.
3. Se existir `prestacao-vault/conhecimento/` (F6): conferir a entrada que a rotina acrescentou ao `log.md` e atualizar a nota da unidade quando mudou algo qualitativo (nova ressalva, justificativa relevante, comissão sem ata).
4. Mudou convenção, padrão de nome, unidade, tipo ou numeração de contrato: atualizar `prestacao-vault/units.json`, `regras_tipo.json` (F1), `.claude/rules/vault.md` ou `AGENTS.md`, conforme o caso.
5. Listar no relatório final o que deve ir para a memória do Project no claude.ai (`claude/memoria-projeto-relatorio-oss.md`), para o chat atualizar.
6. Fechar a pendência: `npm run pos-incorporacao -- --concluir=<id> --obs="<o que foi atualizado>"`.

## Relatório da incorporação

Unidade, competência e gatilho; PDFs encontrados, convertidos e com erro; distribuição por tipo e arquivos em `outros`; escalas carregadas e em revisar, com motivo; registros extraídos e pendentes de avaliação da CAF; memórias atualizadas; o que fica para decisão humana.

## Cuidados

Nada da prestação vai para o git nem para fora das pastas de dados. MCP é somente leitura: escrita no banco só pelos carregadores e importadores. Nunca registrar dado de paciente. Não ler nem copiar `.env`.
