# API de consulta para o chat do Claude (MCP `oss-relatorios`)

Camada **somente leitura** que deixa o chat do Claude Project "Relatório OSS" consultar o banco, as prestações, o vault e o acervo de relatórios da CAF. Requisitos originais: [`api-claude-chat-requisitos.md`](api-claude-chat-requisitos.md).

Dois canais com o mesmo núcleo (`src/claude/core`), que dão o mesmo resultado:

| Canal | Como o chat usa | Processo no Windows |
|---|---|---|
| **MCP stdio** (principal) | ferramentas `mcp__remote-devices__oss-relatorios__<ferramenta>` | o Claude Desktop inicia `src/claude/mcp/server.js` |
| **Ponte por arquivos** (contingência) | grava `~/mnt/oss/claude-bridge/inbox/<id>.json`, lê `outbox/<id>.md` | `npm run ponte` (ou PM2 `oss-claude-ponte`) |
| **Instantâneos** | lê `~/mnt/oss/claude-bridge/snapshots/*.md` | `npm run snapshots`; o vigia regenera às 06:00 |

Tudo roda **no host**, não no container `oss_api`: precisa do `.env` com as credenciais `claude_*`, da pasta do acervo e do `pdftotext`.

## Instalação (uma vez)

1. **Usuários do banco.** As senhas ficam no `.env` (`DB_CLAUDE_PASS`, `DB_CLAUDE_SQL_PASS`). Aplicar:
   ```bash
   set -a; . <(grep -E '^DB_CLAUDE_(SQL_)?PASS=' .env); set +a
   sed -e "s/__RO_PASS__/$DB_CLAUDE_PASS/g" -e "s/__SQL_PASS__/$DB_CLAUDE_SQL_PASS/g" scripts/claude_ro.sql \
     | docker exec -i app-db mariadb -uhospital -p<senha-admin>
   ```
   - `claude_ro` atende as ferramentas dedicadas. Lê escalas, mas os nomes só saem com `identificar=true`.
   - `claude_sql` atende só a `consulta_sql`. Não tem acesso a escalas nominais, `tb_usuarios`, `tokens`, `users` nem `tb_auditoria_logs`.
   - **Tabela nova no banco** precisa entrar no `claude_ro.sql` (GRANT por tabela) e o script deve ser reaplicado.
2. **`.env`**: `DB_CLAUDE_USER`, `DB_CLAUDE_PASS`, `DB_CLAUDE_SQL_USER`, `DB_CLAUDE_SQL_PASS`, `ACERVO_RELATORIOS_DIR`, `PDFTOTEXT_BIN` (ver `.env.example`). Sem `DB_CLAUDE_USER` o servidor recusa subir, para nunca cair no usuário de escrita.
3. **Claude Desktop**: em `%APPDATA%\Claude\claude_desktop_config.json`, adicionar a entrada abaixo e reiniciar o Desktop.
   ```json
   "mcpServers": {
     "oss-relatorios": {
       "command": "C:\\Program Files\\nodejs\\node.exe",
       "args": ["E:\\xampp\\htdocs\\oss\\src\\claude\\mcp\\server.js"],
       "env": { "NODE_ENV": "production" }
     }
   }
   ```
4. Opcional: `npm run ponte` deixa a ponte e os instantâneos diários ativos.

Python com `openpyxl` (planilhas e listagem de prestações) e `pdftotext` (Git for Windows, `mingw64/bin`) já estão na máquina.

## Ferramentas

Toda ferramenta aceita `formato` (`md`, o padrão, com tabelas prontas, fonte e data; ou `json`), `pagina` e `por_pagina` (teto de 500 linhas). Resposta acima de 200 KB vai para `claude-bridge/outbox/` e a ferramenta devolve o caminho.

**Períodos**: `ano` + `periodo`, com `1quad` (jan–abr), `2quad` (mai–ago), `3quad` (set–dez), `ano`, ou `mes`/`trimestre`/`acumulado` com `mes` (mês final).

**Contratos**: aceitos pelo número do banco (`009/2023`, `066/2024`, `517/2025`) ou por apelido (`001/2023`, `004/2025`, `hma` → 009/2023; `dona_rosa`, `025/2025` → 066/2024; `zanaga`, `002/2025` (chamamento) → 517/2025). Os apelidos ficam em `ALIAS_CONTRATO` (`src/claude/core/consultas.js`).

**Unidades**: `HMA`, `UNACON`, `UPA-CIL`, `UPA-DR`, `UPA-ZAN`, ou apelidos (`hm`, `cillos`, `dona_rosa`, `zanaga`).

| Grupo | Ferramentas |
|---|---|
| Cadastro | `listar_contratos`, `detalhar_contrato`, `listar_unidades`, `listar_indicadores` |
| Desempenho | `cumprimento_metas` (mesmos números do Relatório CMS), `nao_cumpridos`, `comparar_periodos`, `serie_indicador`, `notas_explicativas`, `pendencias_lancamento` |
| Financeiro | `repasse_descontos`, `percentual_recebimento`, `execucao_financeira` |
| Produção SIA/SIH | `ponte_producao`, `producao_sigtap` |
| Escalas | `efetivo_escalas`, `cobertura_plantao` (nomes só com `identificar=true`, registrado no log) |
| Documentos | `listar_prestacoes`, `buscar_vault`, `ler_documento`, `acervo_relatorios`, `planilha_indicadores` |
| Redação | **`pacote_relatorio`**, `relatorio_anterior`, `checar_numeracao` |
| Livre | `consulta_sql` (SELECT/WITH/SHOW/DESCRIBE/EXPLAIN, 30 s, usuário `claude_sql`) |

**Regra do `definitivo`** (`acervo_relatorios`): dentro de ano + período + contrato + tipo, a versão **mais antiga** é a definitiva. A data vem do nome do arquivo; na falta dele, da `CreationDate` do PDF; na falta dela, da data de modificação. Cópias de mesmo MD5 contam como uma. O tipo (`caf`, `nta`, `planilha`, `resumo`, `contabil`, `outro`) sai do texto da 1ª página; nos digitalizados, do nome. Para calibrar, edite `TIPO_POR_TEXTO` e `TIPO_POR_NOME` em `src/claude/core/documentos.js`.

## Ponte por arquivos

Uso a partir do shell do chat:
```bash
id=$(date +%s)
echo '{"id":"'$id'","ferramenta":"cumprimento_metas","params":{"ano":2026,"periodo":"2quad","escopo":"contrato","id":"001/2023"}}' \
  > ~/mnt/oss/claude-bridge/inbox/$id.json
sleep 5; cat ~/mnt/oss/claude-bridge/outbox/$id.md      # envelope: outbox/$id.json
cat ~/mnt/oss/claude-bridge/status.json                  # vivo_em < 2 min = ponte ativa
```
Envelope de resposta: `{ id, ok, ferramenta, params, gerado_em, dados | erro }`. O pedido processado vai para `inbox/processados/`.

## Auditoria e LGPD

- Cada chamada gera uma linha em `claude-bridge/logs/AAAA-MM-DD.jsonl` (canal, ferramenta, params, linhas, ms, erro). Valores de variáveis `*PASS*`/`*SECRET*`/`*TOKEN*`/`*KEY*` do `.env` são trocados por `***` na saída e no log.
- `ler_documento` só abre arquivos em `oss/<ano>/`, `prestacao-vault/vault/`, no acervo e nos `.xlsx` da raiz.
- Nenhum dado de paciente é exposto.
- `claude-bridge/` está fora do git.

## Testes

```bash
npx mocha specs/claude/core.spec.js --exit      # puros + banco/acervo (pula se o banco estiver fora)
node src/claude/core/limites.js                 # self-checks: limites, formatos, documentos
npx @modelcontextprotocol/inspector node src/claude/mcp/server.js   # teste manual das ferramentas
```

## Texto para as instruções do Claude Project

> Os dados do sistema OSS vêm do MCP `oss-relatorios` (ferramentas `mcp__remote-devices__oss-relatorios__*`), que é somente leitura. Para montar um relatório quadrimestral ou anual, comece por `pacote_relatorio` (contrato, ano, periodo) e aprofunde com `cumprimento_metas`, `nao_cumpridos`, `ponte_producao` e `relatorio_anterior`. Os números do banco são 009/2023 (HMA, UNACON, UPA Cillos; chamado de 001/2023 nos relatórios), 066/2024 (UPA Dona Rosa), ambos da Santa Casa de Chavantes, e 517/2025 (UPA Antônio Zanaga, INDSH); `checar_numeracao` mostra as divergências. Escalas saem só agregadas; não peça `identificar=true` sem necessidade. Se o MCP não aparecer, use a ponte: grave o pedido em `~/mnt/oss/claude-bridge/inbox/<id>.json` e leia `outbox/<id>.md`; confira antes `claude-bridge/status.json`. Instantâneos do dia ficam em `~/mnt/oss/claude-bridge/snapshots/`. Os PDFs e os `.md` também podem ser lidos direto em `~/mnt/oss` e `~/mnt/relatórios`. O relatório definitivo de cada período é o mais antigo (`acervo_relatorios` marca `definitivo`).
