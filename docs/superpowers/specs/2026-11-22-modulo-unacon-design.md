# Especificação de Design — Módulo Especializado UNACON

- **Data:** 2026-11-22
- **Status:** Aprovado para Planejamento de Implementação
- **Unidade:** UNACON — Unidade de Assistência de Alta Complexidade em Oncologia (Contrato 009/2023 - SCMC, CNES 2058790)
- **Autor:** Antigravity / Pair Programming com o Usuário

---

## 1. Visão Geral e Objetivos

A UNACON opera no âmbito do Contrato de Gestão 009/2023 (SCMC) com particularidades assistenciais críticas:
1. **Ausência de escala médica convencional de plantão 12x36/24h:** O serviço funciona em regime ambulatorial, sessões programadas de quimioterapia, cirurgias agendadas e consultas especializadas.
2. **Alta densidade de dados nominais:** Os Relatórios Assistenciais (RAs) e Books mensais já trazem tabelas nominais com listas completas de pacientes atendidos, cirurgias realizadas com código SIGTAP e tempo decorrido, e consultas por especialidade com comparecimento e município de origem.
3. **Necessidade de rastreabilidade e auditoria externa:** Confrontar os dados informados pela OSS contra a produção faturada oficialmente pelo SUS (banco `producao` local — APAC, AIH e SIA) e integrar futuramente com os agendamentos do Sistema Conecta para recuperação de prontuários e conferência de residência.

Este documento especifica a arquitetura técnica, modelo de dados, rotas de API, telas frontend e mecanismos de conciliação do novo **Módulo UNACON**.

---

## 2. Arquitetura de Navegação e Frontend

### 2.1 Estrutura de Menu Lateral (`SidebarMenu.tsx`)
O módulo será inserido no menu lateral como um grupo navegável independente (`id: 'unacon'`), com controle de permissão baseado em RBAC (`canDo('unacon', 'view')`).

Submenus:
1. **Painel Geral & Metas** (`/unacon/dashboard`): Visão executiva consolidada mês a mês, gráficos de tendência temporal e status das 27 metas contratuais oficiais.
2. **Quimioterapia & Tratamentos** (`/unacon/quimioterapia`): Monitoramento de sessões infusoriais, orais, hormonioterapia e suporte clínico.
3. **Cirurgias Oncológicas** (`/unacon/cirurgias`): Tabela nominal detalhada de cirurgias (data solicitação, data cirurgia, dias decorridos, código SIGTAP, cirurgião, complexidade).
4. **Consultas Especializadas** (`/unacon/consultas`): Consultas nominais por especialidade (Oncologia Clínica, Mastologia, Urologia, Cirurgia Oncológica, Cabeça e Pescoço), comparecimento, faltas/absenteísmo e município de residência.
5. **Exames SADT** (`/unacon/exames`): Acompanhamento quantitativo e nominal de Tomografias com Contraste e Ultrassonografias oncológicas.
6. **Linha do Cuidado & Lei 60 Dias** (`/unacon/linha-cuidado`): Monitoramento do tempo entre a 1ª consulta e o início do tratamento/cirurgia, com destaque em vermelho para casos $> 60$ dias. Indicadores de nutrição, psicologia, eventos adversos e internações decorrentes.
7. **Cruzamento SUS & Auditoria** (`/unacon/cruzamento`): Tela de conciliação em 4 vias contra APAC/AIH/SIA e Conecta, com filtros de divergência e exportação para diligência.
8. **Importação & Conecta** (`/unacon/importacao`): Sincronização automatizada das tabelas do Vault e upload de planilhas Excel/CSV do Conecta (para vincular prontuários e municípios).

### 2.2 Rotas Frontend (`App.tsx`)
```tsx
<Route path="/unacon"                     element={<Navigate to="/unacon/dashboard" replace />} />
<Route path="/unacon/dashboard"           element={<Guarded modulo="unacon"><UnaconDashboardPage /></Guarded>} />
<Route path="/unacon/quimioterapia"       element={<Guarded modulo="unacon"><UnaconQuimioPage /></Guarded>} />
<Route path="/unacon/cirurgias"           element={<Guarded modulo="unacon"><UnaconCirurgiasPage /></Guarded>} />
<Route path="/unacon/consultas"           element={<Guarded modulo="unacon"><UnaconConsultasPage /></Guarded>} />
<Route path="/unacon/exames"              element={<Guarded modulo="unacon"><UnaconExamesPage /></Guarded>} />
<Route path="/unacon/linha-cuidado"       element={<Guarded modulo="unacon"><UnaconLinhaCuidadoPage /></Guarded>} />
<Route path="/unacon/cruzamento"          element={<Guarded modulo="unacon"><UnaconCruzamentoPage /></Guarded>} />
<Route path="/unacon/importacao"          element={<Guarded modulo="unacon"><UnaconImportacaoPage /></Guarded>} />
```

---

## 3. Modelo de Dados (MySQL `oss`)

Serão criadas 4 tabelas relacionais via migração Sequelize (`src/db/migrations/`):

### 3.1 `tb_unacon_pacientes`
Cadastro mestre unificado de pacientes oncológicos.
- `paciente_id` CHAR(36) PK DEFAULT (UUID())
- `nome` VARCHAR(250) NOT NULL
- `nome_normalizado` VARCHAR(250) NOT NULL (sem acento, minúsculo, espaços limpos)
- `cpf` CHAR(11) NULL
- `cns` CHAR(15) NULL
- `data_nascimento` DATE NULL
- `idade` INT NULL
- `prontuario` VARCHAR(50) NULL (enriquecido via Conecta ou RA)
- `municipio_origem` VARCHAR(150) NULL
- `criado_em` DATETIME DEFAULT CURRENT_TIMESTAMP
- `atualizado_em` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
- Índices: `idx_unacon_pac_norm` (`nome_normalizado`, `data_nascimento`), `idx_unacon_pac_cpf` (`cpf`), `idx_unacon_pac_pront` (`prontuario`).

### 3.2 `tb_unacon_procedimentos`
Registro individual de cada procedimento/consulta/cirurgia informado pela OSS ou Conecta.
- `procedimento_id` CHAR(36) PK DEFAULT (UUID())
- `paciente_id` CHAR(36) NOT NULL FK -> `tb_unacon_pacientes(paciente_id)`
- `competencia` CHAR(7) NOT NULL (AAAA-MM)
- `tipo` ENUM('quimioterapia', 'cirurgia', 'consulta', 'exame_sadt', 'outro') NOT NULL
- `subtipo` VARCHAR(100) NULL (ex: 'mastologia', 'urologia', 'infusional', 'oral', 'tomografia')
- `codigo_sigtap` VARCHAR(20) NULL (código de procedimento SIGTAP de 10 dígitos)
- `descricao_procedimento` VARCHAR(300) NULL
- `data_solicitacao` DATE NULL
- `data_execucao` DATE NULL
- `dias_ate_inicio` INT NULL (prazo calculado em dias a partir da 1ª consulta/solicitação)
- `status_lei_60_dias` ENUM('dentro_prazo', 'fora_prazo', 'nao_aplicavel') DEFAULT 'nao_aplicavel'
- `profissional_nome` VARCHAR(200) NULL
- `especialidade` VARCHAR(100) NULL
- `comparecimento` ENUM('atendido', 'ausente', 'cancelado', 'desconhecido') DEFAULT 'atendido'
- `tipo_agendamento` VARCHAR(50) NULL (ex: 'CROSS', 'RETORNO', 'INTERCONSULTA')
- `complexidade` ENUM('baixa', 'media', 'alta', 'nao_informada') DEFAULT 'nao_informada'
- `fonte_origem` ENUM('vault_ra', 'conecta', 'manual') DEFAULT 'vault_ra'
- `arquivo_origem` VARCHAR(300) NULL
- `criado_em` DATETIME DEFAULT CURRENT_TIMESTAMP
- `atualizado_em` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
- Índices: `idx_unacon_proc_comp` (`competencia`, `tipo`), `idx_unacon_proc_pac` (`paciente_id`), `idx_unacon_proc_sigtap` (`codigo_sigtap`).

### 3.3 `tb_unacon_conciliacao`
Registro de batimento automatizado entre os procedimentos informados e o faturamento do SUS (`producao`).
- `conciliacao_id` CHAR(36) PK DEFAULT (UUID())
- `competencia` CHAR(7) NOT NULL (AAAA-MM)
- `procedimento_id` CHAR(36) NULL FK -> `tb_unacon_procedimentos(procedimento_id)`
- `tabela_sus` ENUM('s_apa', 's_aih_pa', 's_prd') NULL
- `id_origem_sus` VARCHAR(100) NULL (número da APAC, ID da AIH ou ID do registro SIA)
- `status_conciliacao` ENUM('conciliado', 'apenas_oss', 'apenas_sus', 'divergencia') NOT NULL
- `paciente_nome_oss` VARCHAR(250) NULL
- `paciente_nome_sus` VARCHAR(250) NULL
- `sigtap_oss` VARCHAR(20) NULL
- `sigtap_sus` VARCHAR(20) NULL
- `data_oss` DATE NULL
- `data_sus` DATE NULL
- `municipio_oss` VARCHAR(150) NULL
- `municipio_sus` VARCHAR(150) NULL
- `divergencia_tipo` VARCHAR(100) NULL (ex: 'sigtap_divergente', 'municipio_divergente', 'data_incompativel')
- `divergencia_detalhe` TEXT NULL
- `conferido_em` DATETIME DEFAULT CURRENT_TIMESTAMP
- Índices: `idx_unacon_conc_status` (`competencia`, `status_conciliacao`).

### 3.4 `tb_unacon_uploads`
Histórico de cargas e importações de planilhas externas (Sistema Conecta).
- `upload_id` CHAR(36) PK DEFAULT (UUID())
- `nome_arquivo` VARCHAR(250) NOT NULL
- `tipo_fonte` ENUM('conecta_consultas', 'conecta_cirurgias', 'planilha_geral') NOT NULL
- `competencia` CHAR(7) NULL
- `total_linhas` INT NOT NULL DEFAULT 0
- `linhas_processadas` INT NOT NULL DEFAULT 0
- `linhas_erros` INT NOT NULL DEFAULT 0
- `usuario_id` CHAR(36) NULL
- `criado_em` DATETIME DEFAULT CURRENT_TIMESTAMP

---

## 4. Mecanismo de Ingestão e Batimento

### 4.1 Ingestão Automatizada do Vault (ETL Vault -> Banco)
- Um script Node.js dedicado (`src/incorporacao/unaconVaultIngest.js`):
  1. Varre `prestacao-vault/vault/2026/unacon/<mes>/relatorio_assistencial/*.md`.
  2. Localiza blocos Markdown com as tabelas de Cirurgias Realizadas e Consultas Realizadas.
  3. Realiza o parse das colunas: Data, Especialidade, Paciente, Idade, Procedimento, Médico, Município, Tipo de Agendamento.
  4. Executa `findOrCreate` em `tb_unacon_pacientes` por `nome_normalizado` + `data_nascimento`.
  5. Insere os registros em `tb_unacon_procedimentos`.

### 4.2 Ingestão de Arquivos do Conecta (Upload)
- Rota `POST /api/unacon/upload` com suporte a arquivos `.xlsx` e `.csv`:
  - Mapeia campos flexíveis (`Prontuário`, `Nome`, `CPF`, `CNS`, `Data`, `Município`, `Especialidade`).
  - Atualiza o campo `prontuario` e `municipio_origem` em `tb_unacon_pacientes`.
  - Associa o procedimento ao agendamento real do Conecta.

### 4.3 Motor de Batimento com MySQL `producao` (Conexão Read-Only)
- Utiliza a conexão read-only já existente em `src/config/producaoDb.js` para consultar o banco `producao` no CNES `2058790`:
  1. **Quimioterapia:**
     - Query em `producao.s_apa`: busca por `APA_PRIPAL` (código SIGTAP iniciado em `0304*`), `APA_CMP` (AAAAMM), `APA_CPFRES` / `APA_CNSPCT` e `APA_NMPCN`.
  2. **Cirurgias Oncológicas:**
     - Query em `producao.s_aih_pa` e `producao.s_aih`: busca por `PROC_DETALHADO`, `CNES = '2058790'` e `COMPETENCIA`.
  3. **Consultas Especializadas e Exames SADT:**
     - Query em `producao.s_prd`: busca por `prd_uid = '2058790'`, `prd_cmp`, `prd_pa` (código SIGTAP da consulta `0301010072` ou SADT `0205*` e `0206*`).
- **Regras de Match:**
  - Nível 1 (Exato): CPF ou CNS idêntico.
  - Nível 2 (Fuzzy): Nome normalizado idêntico + mesmo mês de competência + procedimento correlato.
  - Nível 3 (Divergência): Mesmo paciente e competência, mas com divergência no código SIGTAP ou município de residência.

---

## 5. Rotas de API Backend (`src/routes/unaconRoute.js`)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/unacon/dashboard` | Retorna consolidados mensais de metas e totais de produção |
| `GET` | `/api/unacon/procedimentos` | Lista procedimentos com paginação, filtros de tipo, mês e paciente |
| `GET` | `/api/unacon/cirurgias` | Lista cirurgias oncológicas nominais com tempo de execução e complexidade |
| `GET` | `/api/unacon/consultas` | Lista consultas por especialidade, comparecimento e município |
| `GET` | `/api/unacon/linha-cuidado` | Relatório de início de tratamento ($\le 60$ dias) e indicadores de qualidade |
| `GET` | `/api/unacon/conciliacao` | Dados do cruzamento em 4 vias (Conciliado, Apenas OSS, Apenas SUS, Divergência) |
| `POST`| `/api/unacon/conciliacao/executar` | Dispara reprocessamento do batimento contra o banco `producao` |
| `POST`| `/api/unacon/sincronizar-vault` | Dispara ingestão dos relatórios do Vault para o banco |
| `POST`| `/api/unacon/upload-conecta` | Upload de planilha Excel/CSV do Conecta |
| `GET` | `/api/unacon/exportar-auditoria` | Exporta relatório em Excel/CSV de inconformidades e divergências |

---

## 6. Critérios de Aceite e Verificação

1. **Frontend:**
   - O item **UNACON** aparece no menu lateral com todos os 8 submenus operacionais e responsivos.
   - O type-check `cd frontend && npx tsc --noEmit` executa com zero erros.
2. **Backend:**
   - As migrações executam com sucesso em `npm run db:migrate`.
   - Ingestor do Vault carrega com precisão os dados nominais de cirurgias e consultas de janeiro a setembro/2026.
   - O batimento com o banco `producao` identifica corretamente os casos faturados em APAC, AIH e SIA.
3. **Segurança e LGPD:**
   - O módulo respeita RBAC e isolamento de dados pessoais sensíveis em logs e mensagens de erro.
