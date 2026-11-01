# API de consulta para o chat do Claude (projeto Relatório OSS)

Documento de requisitos para o Claude Code implementar, neste repositório, uma camada de consulta somente leitura que permita ao Claude, no chat do projeto Relatório OSS, consultar os dados do sistema e dos acervos de documentos e discutir a elaboração dos relatórios da CAF.

Elaborado em 01/11/2026 a partir de testes feitos na sessão de chat vinculada a este computador.

## 1. Contexto e restrição principal

O chat roda em uma sessão na nuvem vinculada a este computador pelo Claude Desktop. Dessa sessão o Claude consegue:

| Recurso | Situação testada em 01/11/2026 |
|---|---|
| Shell Linux isolado com as pastas conectadas montadas em `~/mnt/<pasta>` (`~/mnt/oss`, `~/mnt/relatórios`) | Funciona: leitura e escrita de arquivos, Python 3 (openpyxl), Node, pdftotext, tesseract (só inglês) |
| Rede desse shell até o Windows (localhost, 172.17.0.1, 192.168.0.1, host.docker.internal, portas 3306, 4000 e 4001) | **Bloqueada**: o shell não alcança o MySQL nem a API Express |
| Servidores MCP instalados no Claude Desktop deste computador | São repassados ao chat como ferramentas `mcp__remote-devices__<servidor>__<ferramenta>` |
| Navegador interno do Claude Desktop | Abre `http://localhost:4000`, mas é lento e frágil para consultas em volume |

Consequência: uma API HTTP comum, sozinha, **não é alcançável** pelo chat. A solução precisa usar um destes dois canais, nesta ordem de preferência:

1. **Servidor MCP local (canal principal).** Um processo stdio iniciado pelo Claude Desktop, rodando no Windows, com acesso direto ao MySQL e às pastas. O chat chama as ferramentas como funções.
2. **Ponte por arquivos (canal de contingência).** Uma pasta dentro de `oss` onde o chat grava pedidos em JSON e um vigia no Windows grava as respostas. Também gera instantâneos periódicos. Funciona mesmo sem o MCP configurado, porque o chat já enxerga `~/mnt/oss`.

As duas camadas devem reaproveitar o mesmo núcleo de consulta (services existentes), para dar sempre o mesmo resultado.

## 2. Arquitetura proposta

```
src/claude/
  core/                 núcleo de consulta, puro, sem Express
    consultas.js        funções de leitura (usam os services e DAOs existentes)
    documentos.js       índice e busca nos acervos de PDF e no vault
    formatos.js         saída em JSON e em Markdown (tabelas prontas para relatório)
    limites.js          paginação, teto de linhas, mascaramento LGPD
  mcp/
    server.js           servidor MCP stdio (@modelcontextprotocol/sdk)
  ponte/
    vigia.js            processa claude-bridge/inbox -> claude-bridge/outbox
    snapshots.js        gera claude-bridge/snapshots/*.json e *.md
claude-bridge/          (fora do git, criar no .gitignore)
  inbox/  outbox/  snapshots/  logs/
```

Regras gerais:

| Regra | Detalhe |
|---|---|
| Somente leitura | Usuário MySQL próprio (`claude_ro`) com `SELECT` em `oss` e `producao`. Nenhuma ferramenta escreve no banco. |
| Credenciais | Lidas do `.env` (`DB_CLAUDE_USER`, `DB_CLAUDE_PASS`). Nunca devolvidas em resposta nem gravadas em log. |
| Reuso | Usar `RelatorioCmsService`, `AcompanhamentoService`, `PonteProducaoService`, `RecebimentoService`, `helper/avaliacaoCumprimento.js` e `helper/periodoRelatorio.js`. Não duplicar regra de negócio. |
| Escopo | Visão global (perfil equivalente a `auditora` ou `admin` em leitura). |
| LGPD | Escalas: por padrão retornar contagens e horas por unidade, setor e categoria; nome e registro profissional só com parâmetro explícito `identificar=true`, registrado em log. Nenhum dado de paciente. |
| Limites | Teto padrão de 500 linhas por resposta, com `pagina` e `por_pagina`; respostas acima de 200 KB vão para arquivo em `claude-bridge/outbox` e a ferramenta devolve o caminho. |
| Auditoria | Cada chamada registrada em `claude-bridge/logs/AAAA-MM-DD.jsonl` (ferramenta, parâmetros, linhas, duração). |
| Formato | Toda ferramenta aceita `formato: "json" | "md"`. Em `md`, devolver tabelas com cabeçalho, unidade de medida, fonte e data da extração, prontas para colar no relatório. Valores monetários em R$ com vírgula decimal; percentuais com uma casa. |
| Períodos | Aceitar `ano` + `periodo` (`mes`, `1quad`, `2quad`, `3quad`, `trimestre`, `ano`, `acumulado`) e converter para a janela do `periodoRelatorio.js`. Quadrimestres fixos: jan a abr, mai a ago, set a dez. |

## 3. Ferramentas (MCP) e pedidos (ponte)

Os nomes valem para as duas camadas. Na ponte, o pedido é `{ "id": "...", "ferramenta": "<nome>", "params": { ... } }`.

### 3.1 Cadastro contratual

| Ferramenta | Parâmetros | Retorno |
|---|---|---|
| `listar_contratos` | `ativo?` | OSS, número, aditivos, vigência, valor mensal base, percentuais fixo e variável, modelo de desconto, unidades |
| `detalhar_contrato` | `contrato` (id ou número, ex. `001/2023`) | Dados acima mais histórico de aditivos e rubricas |
| `listar_unidades` | `contrato?` | Nome, sigla, CNES, contrato |
| `listar_indicadores` | `unidade?`, `contrato?`, `tipo?` (quantitativo, qualitativo) | Indicador, bloco, peso, meta vigente, direção (`meta_tipo`), faixas |

### 3.2 Desempenho e metas

| Ferramenta | Parâmetros | Retorno |
|---|---|---|
| `cumprimento_metas` | `ano`, `periodo`, `escopo` (todos, contrato, unidade), `id?` | Igual a `GET /api/relatorios/cms`: realizado, meta do período, percentual, status por indicador, agrupado contrato, unidade, quantitativos e qualitativos, mais resumo |
| `serie_indicador` | `indicador` ou `unidade`, `de`, `ate` (AAAA-MM) | Série mensal de realizado, meta e status |
| `comparar_periodos` | `escopo`, `id?`, `periodo_a`, `periodo_b` | Variação absoluta e percentual por indicador entre dois períodos (ex. 2º quad 2025 x 2º quad 2026) |
| `nao_cumpridos` | `ano`, `periodo`, `escopo`, `id?` | Só indicadores parciais e não cumpridos, ordenados pelo desvio |
| `notas_explicativas` | `unidade?`, `de`, `ate` | Notas da OSS vinculadas a acompanhamentos |
| `pendencias_lancamento` | `ano`, `mes` | Indicadores sem valor lançado ou sem aprovação |

### 3.3 Financeiro

| Ferramenta | Parâmetros | Retorno |
|---|---|---|
| `repasse_descontos` | `contrato`, `ano`, `periodo` | Repasse base, descontos por bloco e por indicador, valor final (avisar quando `tb_repasse_mensal` estiver vazia) |
| `percentual_recebimento` | `contrato`, `ano`, `periodo` | Regra de recebimento por grupos e vigência (`RecebimentoService`) |
| `execucao_financeira` | `contrato`, `unidade?`, `ano`, `periodo` | Receitas e despesas por rubrica de `tb_execucao_financeira`, se houver dados |

### 3.4 Produção oficial (SIA/SIH)

| Ferramenta | Parâmetros | Retorno |
|---|---|---|
| `ponte_producao` | `unidade`, `competencia` ou `ano` + `periodo` | Informado x registrado x diferença x divergência %, por indicador mapeado (reuso de `PonteProducaoService`) |
| `producao_sigtap` | `cnes`, `de`, `ate`, `codigo` (2, 4, 6 ou 10 dígitos), `fonte` (sia, sih) | Quantidade apresentada por competência, para indicadores ainda sem mapeamento |

### 3.5 Escalas e força de trabalho

| Ferramenta | Parâmetros | Retorno |
|---|---|---|
| `efetivo_escalas` | `unidade?`, `de`, `ate`, `agrupar` (setor, categoria, dia, turno) | Profissionais distintos, plantões e horas (consultas de `docs/escalas-consultas.sql` sobre `vw_escala_realizados`) |
| `cobertura_plantao` | `unidade`, `data_hora` | Contagem por setor e categoria naquele instante; nomes só com `identificar=true` |

### 3.6 Documentos e acervo de relatórios

| Ferramenta | Parâmetros | Retorno |
|---|---|---|
| `listar_prestacoes` | `ano`, `mes?`, `unidade?`, `tipo?` (oficio, relatorio_assistencial, book, recorte, financeiro, escala, rh) | Arquivos de `oss\<ano>\...`, com caminho, páginas, data e se já existe a versão `.md` no vault |
| `buscar_vault` | `texto`, `ano?`, `unidade?`, `mes?`, `limite?` | Trechos do `prestacao-vault\vault` com caminho e linha (busca textual; índice opcional SQLite FTS5 em `claude-bridge/index.db`) |
| `ler_documento` | `caminho`, `paginas?` | Texto extraído do PDF ou `.md`, paginado |
| `acervo_relatorios` | `ano?`, `periodo?`, `contrato?` (001/2023, dona_rosa, zanaga), `tipo?` (caf, nta, planilha, resumo) | Inventário da pasta `C:\Planejamento\fernando\chavantes - santa casa de misericordia\relatórios` (só `.pdf`, ignorar `_duplicados`), com data de criação, páginas, se é digitalizado e a marca `definitivo` |
| `planilha_indicadores` | `arquivo` (gerais, dona_rosa, zanaga), `aba` | Conteúdo das planilhas `indicadores_*_2026.xlsx` e `pa_zanaga_2026.xlsx` da raiz, em tabela |

Regra do `definitivo` em `acervo_relatorios`: quando houver mais de uma versão do mesmo período, contrato e tipo, a **mais antiga** é a definitiva (data no nome do arquivo quando houver; senão `CreationDate` do PDF; senão data de modificação). Cópias com o mesmo hash MD5 contam como uma só.

A pasta de relatórios está organizada em `<ano>\<1º quad|2º quad|3º quad|anual>`, com o Contrato 001/2023 na raiz do período e subpastas `dona rosa` e `zanaga` (em `2025\anual`: `HMAUNACONUPA`, `Dona Rosa`, `zanaga`). O caminho da pasta deve vir de variável de ambiente (`ACERVO_RELATORIOS_DIR`).

### 3.7 Apoio à redação do relatório

| Ferramenta | Parâmetros | Retorno |
|---|---|---|
| `pacote_relatorio` | `contrato`, `ano`, `periodo` | Um único JSON/MD com tudo que o relatório quadrimestral usa: dados da parceria, cumprimento de metas, não cumpridos, ponte de produção, repasse e descontos, efetivo, lista de documentos da prestação e o relatório definitivo do mesmo período do ano anterior. É a ferramenta mais importante. |
| `relatorio_anterior` | `contrato`, `ano`, `periodo` | Caminho e texto do relatório definitivo do período anterior e do mesmo período do ano anterior, para comparação e para retomar ressalvas |
| `checar_numeracao` | `contrato` | Divergências conhecidas de numeração (001/2023 x 009/2023 x 004/2025; 066/2024 x 025/2025) encontradas no banco, nas planilhas e nos relatórios |

## 4. Servidor MCP

Requisitos:

1. Pacote `@modelcontextprotocol/sdk`, transporte stdio, arquivo `src/claude/mcp/server.js`, script `npm run mcp`.
2. Cada ferramenta com esquema de entrada (Joi ou zod) e descrição em português que explique quando usá-la.
3. Erros devolvidos como texto claro (banco fora do ar, unidade sem CNES, período inválido), sem stack trace.
4. Inicialização sem depender do Express, Redis ou Socket.io; só Sequelize e a conexão read-only `producaoDb.js`.
5. Instrução de registro no Claude Desktop, em `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "oss-relatorios": {
      "command": "node",
      "args": ["E:\\xampp\\htdocs\\oss\\src\\claude\\mcp\\server.js"],
      "env": { "NODE_ENV": "production" }
    }
  }
}
```

Depois de registrar, reiniciar o Claude Desktop. No chat, as ferramentas devem aparecer como `mcp__remote-devices__oss-relatorios__<ferramenta>` (ou nome equivalente).

## 5. Ponte por arquivos (contingência)

1. `npm run ponte` inicia `src/claude/ponte/vigia.js` (pode rodar no PM2 junto com a API).
2. O vigia observa `claude-bridge/inbox/*.json` (chokidar ou `fs.watch` com varredura a cada 3 s), executa a ferramenta pedida e grava `claude-bridge/outbox/<id>.json` e, se `formato=md`, `<id>.md`. Move o pedido para `inbox/processados/`.
3. Resposta sempre com `{ id, ok, ferramenta, params, gerado_em, dados | erro }`.
4. `npm run snapshots` (e cron diário às 06:00 em `cronJobs.js`) gera em `claude-bridge/snapshots/`:
   `contratos.json`, `indicadores.json`, `cumprimento_<ano>_<periodo>.json` para os períodos com lançamento, `acervo_relatorios.json`, `prestacoes_<ano>.json` e `LEIAME.md` com a data da última geração.
5. Arquivo `claude-bridge/status.json` atualizado a cada minuto pelo vigia (`{ vivo_em, versao, banco_ok, producao_ok }`), para o chat saber se a ponte está ativa.

Uso esperado pelo chat (shell remoto):

```bash
id=$(date +%s); echo '{"id":"'$id'","ferramenta":"cumprimento_metas","params":{"ano":2026,"periodo":"2quad","escopo":"contrato","id":"001/2023","formato":"md"}}' > ~/mnt/oss/claude-bridge/inbox/$id.json
# aguardar ~5 s
cat ~/mnt/oss/claude-bridge/outbox/$id.md
```

## 6. Testes de aceite

Implementar testes Mocha em `specs/claude/` para o núcleo e um roteiro manual:

| Nº | Teste | Esperado |
|---|---|---|
| 1 | `listar_contratos` | 001/2023 SCMC, UPA Dona Rosa SCMC e PA Zanaga INDSH |
| 2 | `cumprimento_metas` 2026, 1quad, contrato 001/2023 | Mesmos números do Relatório CMS na tela com os mesmos filtros |
| 3 | `nao_cumpridos` 2026, 2quad, todos | Lista ordenada pelo desvio |
| 4 | `ponte_producao` HMA, 202608 | Informado x registrado; 503 tratado se o banco `producao` estiver fora |
| 5 | `acervo_relatorios` 2024, 1quad, 001/2023, caf | Definitivo = `relatório quad jan abr 2024 20240725.pdf` |
| 6 | `acervo_relatorios` 2024, anual, dona_rosa, caf | Definitivo = `parecer anual upa dona rosa 2024 07_05_2025.pdf` |
| 7 | `buscar_vault` "hemodiálise", 2026, hm | Trechos com caminho do `.md` |
| 8 | `efetivo_escalas` sem `identificar` | Nenhum nome ou registro profissional na saída |
| 9 | `pacote_relatorio` 001/2023, 2026, 2quad, md | Markdown único, abaixo de 200 KB ou gravado em arquivo |
| 10 | Pedido pela ponte com ferramenta inexistente | `ok: false` com mensagem clara |
| 11 | Qualquer ferramenta | Nenhum segredo do `.env` no retorno nem no log |

## 7. Ordem de implementação sugerida

1. Usuário MySQL `claude_ro` e variáveis no `.env.example`.
2. Núcleo `src/claude/core` com `listar_contratos`, `listar_indicadores`, `cumprimento_metas` e `acervo_relatorios`, mais testes.
3. Servidor MCP com essas quatro ferramentas e registro no Claude Desktop. Validar no chat.
4. Ponte por arquivos e snapshots.
5. Demais ferramentas, terminando por `pacote_relatorio`.
6. Atualizar `CLAUDE.md` (seção "Palácio de memória") e criar `docs/api-claude-chat.md` com o uso final.

## 8. Fora de escopo

Escrita no banco, aprovação de lançamentos, cálculo de descontos, envio de ofícios, geração do .docx final do relatório (o chat redige; a API só fornece dados) e exposição da API para a internet.
