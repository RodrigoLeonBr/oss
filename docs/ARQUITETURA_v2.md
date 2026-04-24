# 📐 DOCUMENTO DE ARQUITETURA DO SISTEMA

## SaúdeControl OSS — Sistema de Acompanhamento de Contratos de Gestão em Saúde Pública
### Município de Americana/SP

**Versão:** 2.1  
**Data de Atualização:** 23 de abril de 2026  
**Responsável:** Rodrigo Alexander Diaz Leon, Diretor de Planejamento da SMS Americana  
**Status:** Revisado com base nos Planos de Trabalho, planilhas operacionais e entregas em `docs/superpowers/` (auth/permissions, metas decompostas)  
**Base de código:** Node.js + Express + Sequelize · frontend React 18 + TypeScript + Vite (proxy `/api`)  
**Banco de Dados:** MySQL/MariaDB  
**Hospedagem:** Servidor Local (SMS Americana)

---

## 1. VISÃO GERAL DA ARQUITETURA

### 1.1 Escopo Atualizado

O sistema gerencia **5 unidades de saúde** sob **2 OSS distintas** com **3 contratos de gestão ativos**:

```
SMS Americana
├── Contrato SCMC nº 009/2023 (6º TA)
│   ├── HMA – Hospital Municipal Dr. Waldemar Tebaldi
│   ├── UNACON – Unidade Alta Complexidade Oncológica
│   └── UPA 24h Avenida de Cillos (CNES: 7471777)
├── Contrato SCMC nº 066/2024 (2º TA)
│   └── UPA 24h Dona Rosa (CNES: 4777220)
└── Chamamento PMA nº 002/2025
    └── UPA 24h Antônio Zanaga (CNES: a confirmar)
```

### 1.2 Padrão Arquitetural

MVC (Model-View-Controller) com separação clara de responsabilidades, implementando APIs RESTful. Motor de cálculo de desconto configurável por contrato para suportar dois modelos distintos (flat SCMC vs ponderado INDSH).

```
┌──────────────────────────────────────────────────────────────────┐
│                  ARQUITETURA — SaúdeControl OSS                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │            CAMADA DE APRESENTAÇÃO (Frontend)            │   │
│   │   React 18+ + TypeScript  |  Mobile App (V3 Futuro)     │   │
│   └─────────────────────────────────────────────────────────┘   │
│                          ↓ HTTPS                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │          CAMADA DE APLICAÇÃO (Backend API)              │   │
│   │   Node.js + Express  |  Controllers  |  Services        │   │
│   │   ┌────────────────────────────────────────────────┐    │   │
│   │   │  Motor de Cálculo de Desconto (Configurável)   │    │   │
│   │   │  ├─ DescontoFlatService (SCMC – flat 1%/ind.)  │    │   │
│   │   │  └─ DescontoPonderadoService (INDSH – peso%)   │    │   │
│   │   └────────────────────────────────────────────────┘    │   │
│   │   ┌────────────────────────────────────────────────┐    │   │
│   │   │  Consolidador Periódico (Node-Cron)            │    │   │
│   │   │  ├─ consolidacaoTrimestral.js                  │    │   │
│   │   │  └─ consolidacaoQuadrimestral.js               │    │   │
│   │   └────────────────────────────────────────────────┘    │   │
│   └─────────────────────────────────────────────────────────┘   │
│                          ↓ SQL                                   │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │       CAMADA DE DADOS (ORM Sequelize + MySQL)           │   │
│   │   Models: Contrato, OSS, Unidade, Bloco, Indicador,     │   │
│   │   Meta, AcompanhamentoMensal, PermissaoPerfil,          │   │
│   │   Desconto, NotaExplicativa, Rubrica, Usuario, …        │   │
│   └─────────────────────────────────────────────────────────┘   │
│                          ↓                                       │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │       BANCO DE DADOS (MySQL/MariaDB)                    │   │
│   │   Banco: saude_contratos_americana                      │   │
│   │   Motor: InnoDB (ACID)  |  Retenção: 5 anos (TCESP)    │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 1.3 Autenticação, autorização e multi-módulo (implementado)

- **Sessão:** login com e-mail e senha (`bcrypt` sobre `tb_usuarios.senha_hash`); resposta inclui tokens JWT; refresh via rotas de auth existentes.  
- **Permissões no banco:** tabela `tb_permissoes_perfil` — por par (`perfil`, `módulo`) define `can_view/insert/update/delete` e `escopo` (`global` | `proprio`). O perfil `proprio` aciona filtro por `oss_id` do usuário no backend (`ossScopeHelper` + serviços).  
- **API:** `GET /api/auth/me/permissions` carrega matriz do perfil logado; frontend usa `canDo(módulo, ação)` e rotas protegidas por módulo.  
- **Admin:** CRUD de usuários (`/api/usuarios`) e matriz de permissões (`/api/permissoes/:perfil`) restritos a perfis administrativos; middleware `checkPermission` disponível para mutações granulares.

### 1.4 Metas decompostas e acompanhamento por folha (implementado)

Conforme [spec de metas](superpowers/specs/2026-04-23-metas-decomposicao-pesos-design.md) e [plano associado](superpowers/plans/2026-04-23-metas-decomposicao-pesos.md):

- **`tb_metas`:** colunas `parent_meta_id` (auto-FK), `papel` (`avulsa` | `agregada` | `componente`), `peso` (componentes). Pacote criado em transação com **mesma `versao`** para pai e filhas; soma dos `meta_mensal` das filhas = meta agregada (tolerância no serviço). Indicador **qualitativo** não aceita pacote.  
- **API:** `POST /api/metas` (avulsa), `POST /api/metas/pacote` (agregada + componentes), listagem de raízes com `children`.  
- **`tb_acompanhamento_mensal`:** unicidade **(`meta_id`, `mes_referencia`)**; lançamento só em metas **folha** (avulsa ou componente); meta **agregada** não recebe `valor_realizado` (derivado).  
- **Cumprimento global (F):** helper `metaCumprimentoPonderado` — média ponderada dos fatores por linha, com cap abaixo de `meta_minima` (constante `META_FATOR_CAP_SUBMIN`).

---

## 2. BANCO DE DADOS — SCHEMA COMPLETO

### 2.1 Tabelas de Contrato e Estrutura Organizacional

```sql
-- Organizações Sociais
CREATE TABLE TB_OSS (
  id          CHAR(36) PRIMARY KEY,
  nome        VARCHAR(200) NOT NULL,       -- "SCMC – Grupo Chavantes" | "INDSH"
  cnpj        CHAR(18) NOT NULL UNIQUE,    -- "73.027.690/0001-46" | "23.453.830/0001-70"
  email       VARCHAR(200),
  telefone    VARCHAR(20),
  endereco    TEXT,
  ativo       TINYINT(1) DEFAULT 1,
  created_at  DATETIME,
  updated_at  DATETIME
);

-- Contratos de Gestão
CREATE TABLE TB_CONTRATOS (
  id                     CHAR(36) PRIMARY KEY,
  oss_id                 CHAR(36) NOT NULL REFERENCES TB_OSS(id),
  numero                 VARCHAR(50) NOT NULL,      -- "009/2023" | "066/2024" | "002/2025"
  tipo                   ENUM('contrato','chamamento') NOT NULL,
  termo_aditivo_atual    VARCHAR(10),               -- "6º" | "2º" | NULL
  data_inicio            DATE NOT NULL,
  data_fim               DATE NOT NULL,
  valor_mensal_base      DECIMAL(15,2) NOT NULL,    -- 10.855.769,19 | 1.600.982,91 | 1.479.452,60
  valor_anual            DECIMAL(15,2),
  perc_fixo              DECIMAL(5,2) DEFAULT 90.00,  -- 90%
  perc_variavel          DECIMAL(5,2) DEFAULT 10.00,  -- 10%
  modelo_desconto_qual   ENUM('flat','ponderado') NOT NULL,
  -- flat: SCMC (−1% por indicador não cumprido, máximo 10%)
  -- ponderado: INDSH (−peso% por indicador não cumprido)
  status                 ENUM('ativo','encerrado','suspenso','rompido') DEFAULT 'ativo',
  ipca_referencia        DECIMAL(5,4),              -- IPCA acumulado para reajuste
  observacoes            TEXT,
  deleted_at             DATETIME,                  -- soft-delete
  created_at             DATETIME,
  updated_at             DATETIME
);

-- Termos Aditivos
CREATE TABLE TB_ADITIVOS (
  id              CHAR(36) PRIMARY KEY,
  contrato_id     CHAR(36) NOT NULL REFERENCES TB_CONTRATOS(id),
  numero          VARCHAR(20) NOT NULL,     -- "6" | "2"
  data_assinatura DATE NOT NULL,
  data_vigencia   DATE NOT NULL,
  novo_valor_mensal DECIMAL(15,2),
  descricao_mudancas TEXT NOT NULL,
  documento_url   VARCHAR(500),            -- link ao PDF do TA
  created_at      DATETIME,
  updated_at      DATETIME
);

-- Unidades de Saúde
CREATE TABLE TB_UNIDADES (
  id               CHAR(36) PRIMARY KEY,
  contrato_id      CHAR(36) NOT NULL REFERENCES TB_CONTRATOS(id),
  nome             VARCHAR(200) NOT NULL,    -- "HMA" | "UNACON" | "UPA Cillos" | "UPA Dona Rosa" | "UPA Zanaga"
  sigla            VARCHAR(20) NOT NULL,
  tipo             ENUM('hospital','upa','unacon','pa','outro') NOT NULL,
  cnes             VARCHAR(20),              -- "7471777" | "4777220"
  endereco         TEXT,
  porte            VARCHAR(50),             -- "Porte Médio II" | "UPA Porte II Opção V"
  capacidade_leitos INT,                    -- 128 (HMA) | null (UPAs)
  especialidades   JSON,                    -- ["Clínico Geral","Emergência","Pediatria"]
  ativo            TINYINT(1) DEFAULT 1,
  deleted_at       DATETIME,
  created_at       DATETIME,
  updated_at       DATETIME
);

-- Blocos de Produção (exclusivo HMA)
CREATE TABLE TB_BLOCOS_PRODUCAO (
  id               CHAR(36) PRIMARY KEY,
  unidade_id       CHAR(36) NOT NULL REFERENCES TB_UNIDADES(id),
  nome             VARCHAR(100) NOT NULL,   -- "Bloco 1 – Urgência/Emergência"
  codigo           VARCHAR(20) NOT NULL,    -- "BLOCO_URG" | "BLOCO_INT" | "BLOCO_SADT" | "BLOCO_CIR"
  peso_perc        DECIMAL(5,2),            -- % do orçamento alocado ao bloco
  ativo            TINYINT(1) DEFAULT 1,
  created_at       DATETIME,
  updated_at       DATETIME
);
```

### 2.2 Tabelas de Indicadores e Metas

```sql
-- Indicadores
CREATE TABLE TB_INDICADORES (
  id               CHAR(36) PRIMARY KEY,
  unidade_id       CHAR(36) REFERENCES TB_UNIDADES(id),   -- NULL = indicador transversal
  bloco_id         CHAR(36) REFERENCES TB_BLOCOS_PRODUCAO(id),  -- NULL se não pertencer a bloco
  codigo           VARCHAR(50) NOT NULL UNIQUE,  -- "HMA_QUAL_01" | "ZANAGA_SAU" | "UNACON_QUIMIO"
  nome             VARCHAR(300) NOT NULL,
  descricao        TEXT,
  tipo             ENUM('quantitativo','qualitativo') NOT NULL,
  grupo            ENUM('auditoria_operacional','qualidade_atencao','transversal') NOT NULL,
  formula_calculo  TEXT,                   -- "∑ óbitos analisados / ∑ óbitos >24h × 100"
  unidade_medida   VARCHAR(50),            -- "atendimentos" | "%" | "dias" | "sessões"
  periodicidade    ENUM('mensal','bimestral','trimestral','quadrimestral','unico') NOT NULL,
  tipo_implantacao TINYINT(1) DEFAULT 0,   -- 1 = indicador de implantação com prazo único
  prazo_dias_implantacao INT,              -- ex: 60 ou 90 dias após início do contrato
  peso_perc        DECIMAL(5,2),           -- peso % para modelo ponderado (INDSH)
  -- para modelo flat SCMC, desconto por indicador é calculado pela regra contratual
  meta_tipo        ENUM('igual','maior_igual','menor_igual','entre') DEFAULT 'maior_igual',
  meta_descricao   VARCHAR(100),           -- "≥85%" | "≤33%" | "100%" | "≤10 dias"
  versao           INT DEFAULT 1,          -- para versionamento
  ativo            TINYINT(1) DEFAULT 1,
  deleted_at       DATETIME,               -- soft-delete
  created_at       DATETIME,
  updated_at       DATETIME,
  
  INDEX idx_unidade (unidade_id),
  INDEX idx_tipo (tipo),
  INDEX idx_grupo (grupo),
  INDEX idx_periodicidade (periodicidade)
);

-- Metas Anuais por Indicador
CREATE TABLE TB_METAS_ANUAIS (
  id               CHAR(36) PRIMARY KEY,
  indicador_id     CHAR(36) NOT NULL REFERENCES TB_INDICADORES(id),
  ano              INT NOT NULL,            -- 2026 | 2027
  valor_meta_anual DECIMAL(15,4),           -- 144000 | 0.85 | 10 (dias)
  valor_meta_mensal DECIMAL(15,4),          -- calculado = anual / 12 (quando aplicável)
  meta_minima_perc DECIMAL(5,2) DEFAULT 70, -- limite inferior (faixa de desconto 30%)
  meta_parcial_perc DECIMAL(5,2) DEFAULT 85,-- limite inferior (faixa sem desconto)
  observacoes      TEXT,                   -- "Incremento base histórica 2025 → 1.450 exames RX"
  versao           INT DEFAULT 1,
  aprovado_por     CHAR(36) REFERENCES TB_USUARIOS(id),
  created_at       DATETIME,
  updated_at       DATETIME,
  
  UNIQUE KEY uk_indicador_ano (indicador_id, ano)
);
```

### 2.3 Tabela de Acompanhamento Mensal

```sql
CREATE TABLE TB_ACOMPANHAMENTO_MENSAL (
  id                      CHAR(36) PRIMARY KEY,
  indicador_id            CHAR(36) NOT NULL REFERENCES TB_INDICADORES(id),
  meta_anual_id           CHAR(36) NOT NULL REFERENCES TB_METAS_ANUAIS(id),
  mes_referencia          DATE NOT NULL,           -- YYYY-MM-01
  valor_realizado         DECIMAL(15,4),
  valor_meta_mensal       DECIMAL(15,4) NOT NULL,  -- snapshot da meta no momento do preenchimento
  percentual_cumprimento  DECIMAL(8,4),            -- calculado = (realizado/meta) × 100
  variacao_percentual     DECIMAL(8,4),            -- vs mês anterior
  status_cumprimento      ENUM('cumprido','parcial','nao_cumprido','nao_aplicavel','aguardando') DEFAULT 'aguardando',
  -- Indicadores de implantação
  status_implantacao      ENUM('nao_iniciado','em_prazo','cumprido','vencido') NULL,
  data_cumprimento_implant DATE NULL,
  -- Classificação de desconto (para quantitativos)
  faixa_producao          ENUM('acima_meta','entre_85_100','entre_70_84','abaixo_70') NULL,
  desconto_estimado       DECIMAL(15,2) DEFAULT 0,
  -- Fluxo de aprovação
  status_aprovacao        ENUM('rascunho','submetido','aprovado','rejeitado') DEFAULT 'rascunho',
  preenchido_por          CHAR(36) REFERENCES TB_USUARIOS(id),
  data_preenchimento      DATETIME,
  submetido_por           CHAR(36) REFERENCES TB_USUARIOS(id),
  data_submissao          DATETIME,
  aprovado_por            CHAR(36) REFERENCES TB_USUARIOS(id),
  data_aprovacao          DATETIME,
  motivo_rejeicao         TEXT,
  -- Rastreabilidade
  versao                  INT DEFAULT 1,
  created_at              DATETIME,
  updated_at              DATETIME,

  UNIQUE KEY uk_indicador_mes (indicador_id, mes_referencia),
  INDEX idx_mes (mes_referencia),
  INDEX idx_status (status_cumprimento),
  INDEX idx_aprovacao (status_aprovacao)
);

-- Notas Explicativas (obrigatórias para desvios de meta)
CREATE TABLE TB_NOTAS_EXPLICATIVAS (
  id                   CHAR(36) PRIMARY KEY,
  acompanhamento_id    CHAR(36) NOT NULL REFERENCES TB_ACOMPANHAMENTO_MENSAL(id),
  descricao            TEXT NOT NULL,
  causa_raiz           TEXT,                -- análise de causa
  acao_corretiva       TEXT,                -- plano de ação
  previsao_normalizacao DATE,               -- quando espera atingir meta novamente
  criado_por           CHAR(36) REFERENCES TB_USUARIOS(id),
  validado_por         CHAR(36) REFERENCES TB_USUARIOS(id),  -- auditora
  status_validacao     ENUM('pendente','aceita','rejeitada') DEFAULT 'pendente',
  created_at           DATETIME,
  updated_at           DATETIME
);
```

### 2.4 Tabelas de Desconto e Repasse

```sql
-- Descontos Calculados por Mês
CREATE TABLE TB_DESCONTOS (
  id                  CHAR(36) PRIMARY KEY,
  contrato_id         CHAR(36) NOT NULL REFERENCES TB_CONTRATOS(id),
  mes_referencia      DATE NOT NULL,
  -- Repasse Base
  valor_mensal_base   DECIMAL(15,2) NOT NULL,
  parcela_fixa        DECIMAL(15,2) NOT NULL,   -- 90% do base
  parcela_variavel    DECIMAL(15,2) NOT NULL,   -- 10% do base
  -- Descontos por Produção (blocos HMA / UPA)
  desconto_producao_total DECIMAL(15,2) DEFAULT 0,
  -- Descontos por Qualidade
  desconto_qualidade_total DECIMAL(15,2) DEFAULT 0,
  -- Repasse Final
  repasse_final       DECIMAL(15,2) NOT NULL,
  -- Controle
  status              ENUM('calculado','validado','aprovado','pago') DEFAULT 'calculado',
  calculado_em        DATETIME,
  validado_por        CHAR(36) REFERENCES TB_USUARIOS(id),
  aprovado_por        CHAR(36) REFERENCES TB_USUARIOS(id),
  observacoes         TEXT,
  created_at          DATETIME,
  updated_at          DATETIME,

  UNIQUE KEY uk_contrato_mes (contrato_id, mes_referencia)
);

-- Descontos por Bloco de Produção (detalhamento)
CREATE TABLE TB_DESCONTOS_BLOCOS (
  id                    CHAR(36) PRIMARY KEY,
  desconto_id           CHAR(36) NOT NULL REFERENCES TB_DESCONTOS(id),
  bloco_id              CHAR(36) NOT NULL REFERENCES TB_BLOCOS_PRODUCAO(id),
  meta_mensal           DECIMAL(15,4) NOT NULL,
  realizado             DECIMAL(15,4) NOT NULL,
  percentual_atingimento DECIMAL(8,4) NOT NULL,
  faixa                 ENUM('acima_meta','entre_85_100','entre_70_84','abaixo_70') NOT NULL,
  orcamento_bloco       DECIMAL(15,2) NOT NULL,
  percentual_desconto   DECIMAL(5,2) NOT NULL,   -- 0% | 10% | 30%
  valor_desconto        DECIMAL(15,2) NOT NULL,
  created_at            DATETIME
);

-- Descontos por Indicador de Qualidade (detalhamento)
CREATE TABLE TB_DESCONTOS_INDICADORES (
  id                    CHAR(36) PRIMARY KEY,
  desconto_id           CHAR(36) NOT NULL REFERENCES TB_DESCONTOS(id),
  acompanhamento_id     CHAR(36) NOT NULL REFERENCES TB_ACOMPANHAMENTO_MENSAL(id),
  indicador_id          CHAR(36) NOT NULL REFERENCES TB_INDICADORES(id),
  modelo_desconto       ENUM('flat','ponderado') NOT NULL,
  peso_indicador        DECIMAL(5,2),            -- para modelo ponderado
  percentual_desconto   DECIMAL(5,2) NOT NULL,   -- 1% (flat) ou peso% (ponderado)
  valor_desconto        DECIMAL(15,2) NOT NULL,
  created_at            DATETIME
);
```

### 2.5 Tabelas de Análise Periódica

```sql
-- Consolidação Trimestral e Quadrimestral
CREATE TABLE TB_CONSOLIDACOES_PERIODICAS (
  id                  CHAR(36) PRIMARY KEY,
  unidade_id          CHAR(36) NOT NULL REFERENCES TB_UNIDADES(id),
  tipo_periodo        ENUM('trimestral','quadrimestral') NOT NULL,
  periodo_numero      INT NOT NULL,               -- T1/T2/T3/T4 | Q1/Q2/Q3
  ano                 INT NOT NULL,               -- 2026
  data_inicio         DATE NOT NULL,              -- 2026-01-01
  data_fim            DATE NOT NULL,              -- 2026-03-31
  status              ENUM('gerado','validado','arquivado') DEFAULT 'gerado',
  gerado_em           DATETIME,
  created_at          DATETIME,
  updated_at          DATETIME,

  UNIQUE KEY uk_unidade_periodo_ano (unidade_id, tipo_periodo, periodo_numero, ano)
);

-- Itens da Consolidação (por indicador no período)
CREATE TABLE TB_CONSOLIDACOES_ITENS (
  id                      CHAR(36) PRIMARY KEY,
  consolidacao_id         CHAR(36) NOT NULL REFERENCES TB_CONSOLIDACOES_PERIODICAS(id),
  indicador_id            CHAR(36) NOT NULL REFERENCES TB_INDICADORES(id),
  soma_realizado          DECIMAL(15,4),          -- soma dos meses do período
  media_realizado         DECIMAL(15,4),
  meta_periodo            DECIMAL(15,4),          -- meta mensal × nº meses
  percentual_cumprimento  DECIMAL(8,4),
  faixa                   ENUM('acima_meta','entre_85_100','entre_70_84','abaixo_70') NULL,
  desconto_periodo        DECIMAL(15,2) DEFAULT 0,
  meses_cumpridos         INT,                    -- nº de meses em que a meta foi atingida
  meses_totais            INT,                    -- nº total de meses no período
  created_at              DATETIME
);
```

### 2.6 Módulo Financeiro por Rubrica

```sql
-- Rubricas Orçamentárias (estrutura de custo)
CREATE TABLE TB_RUBRICAS_ORCAMENTARIAS (
  id              CHAR(36) PRIMARY KEY,
  contrato_id     CHAR(36) NOT NULL REFERENCES TB_CONTRATOS(id),
  codigo          VARCHAR(20) NOT NULL,   -- "01" | "01.17" | "13"
  nome            VARCHAR(200) NOT NULL,  -- "Recursos Humanos" | "Salários e Ordenados"
  nivel           ENUM('grupo','categoria') NOT NULL,
  grupo_pai_id    CHAR(36) REFERENCES TB_RUBRICAS_ORCAMENTARIAS(id),
  ativo           TINYINT(1) DEFAULT 1,
  created_at      DATETIME,
  updated_at      DATETIME,

  UNIQUE KEY uk_contrato_codigo (contrato_id, codigo)
);

-- Valores Orçados e Realizados por Mês
CREATE TABLE TB_EXECUCAO_FINANCEIRA (
  id                CHAR(36) PRIMARY KEY,
  rubrica_id        CHAR(36) NOT NULL REFERENCES TB_RUBRICAS_ORCAMENTARIAS(id),
  mes_referencia    DATE NOT NULL,
  valor_orcado      DECIMAL(15,2) NOT NULL,    -- conforme planilha de custo
  valor_realizado   DECIMAL(15,2),             -- preenchido até 20º dia útil
  variacao          DECIMAL(15,2),             -- calculado = realizado − orçado
  status_aprovacao  ENUM('rascunho','aprovado') DEFAULT 'rascunho',
  created_at        DATETIME,
  updated_at        DATETIME,

  UNIQUE KEY uk_rubrica_mes (rubrica_id, mes_referencia)
);
```

### 2.7 Tabelas de Usuários e Auditoria

```sql
-- Usuários
CREATE TABLE TB_USUARIOS (
  id              CHAR(36) PRIMARY KEY,
  nome            VARCHAR(200) NOT NULL,
  email           VARCHAR(200) NOT NULL UNIQUE,
  senha_hash      VARCHAR(60) NOT NULL,         -- bcrypt
  perfil          ENUM('admin','gestor_sms','auditora','conselheiro_cms',
                       'contratada_scmc','contratada_indsh',
                       'central_regulacao','visualizador') NOT NULL,
  ativo           TINYINT(1) DEFAULT 1,
  ultimo_login    DATETIME,
  deleted_at      DATETIME,                    -- soft-delete (LGPD)
  created_at      DATETIME,
  updated_at      DATETIME
);

-- Auditoria de Logs (TCESP: retenção 5 anos)
CREATE TABLE TB_AUDITORIA_LOGS (
  id               CHAR(36) PRIMARY KEY,
  usuario_id       CHAR(36) REFERENCES TB_USUARIOS(id),
  tabela_afetada   VARCHAR(100) NOT NULL,
  operacao         ENUM('INSERT','UPDATE','DELETE','SELECT','LOGIN','LOGOUT','EXPORT') NOT NULL,
  registro_id      CHAR(36),                  -- ID do registro afetado
  dados_antes      JSON,                      -- snapshot antes da operação
  dados_depois     JSON,                      -- snapshot após a operação
  ip_origem        VARCHAR(45),
  user_agent       TEXT,
  data_operacao    DATETIME NOT NULL,
  -- Não tem soft-delete — logs são permanentes (5 anos TCESP)

  INDEX idx_usuario (usuario_id),
  INDEX idx_tabela (tabela_afetada),
  INDEX idx_data (data_operacao)
);
```

---

## 3. MOTOR DE CÁLCULO DE DESCONTO

### 3.1 Interface Comum (Strategy Pattern)

```javascript
// src/services/desconto/DescontoStrategy.js

class DescontoStrategy {
  /**
   * Calcula o desconto total para um contrato/mês
   * @param {Object} contrato - Dados do contrato (inclui modelo_desconto_qual)
   * @param {Array} acompanhamentos - Array de registros do mês
   * @param {Array} blocos - Dados dos blocos de produção (HMA)
   * @returns {Object} { descontoProducao, descontoQualidade, repasseFinal, detalhes }
   */
  calcular(contrato, acompanhamentos, blocos) {
    throw new Error('calcular() deve ser implementado pela subclasse');
  }
}

module.exports = DescontoStrategy;
```

### 3.2 Modelo Flat (SCMC — Contratos 009/2023 e 066/2024)

```javascript
// src/services/desconto/DescontoFlatService.js

class DescontoFlatService extends DescontoStrategy {
  calcular(contrato, acompanhamentos, blocos) {
    const { valor_mensal_base, perc_variavel } = contrato;
    const parcela_variavel = valor_mensal_base * (perc_variavel / 100);

    // NÍVEL 1 — Descontos por produção (blocos HMA ou equivalente)
    let descontoProducao = 0;
    const detalhes_blocos = blocos.map(bloco => {
      const { meta, realizado, orcamento_bloco } = bloco;
      const pct = realizado / meta;
      let pct_desconto = 0;
      let faixa = 'acima_meta';

      if (pct >= 0.85) {
        faixa = pct >= 1 ? 'acima_meta' : 'entre_85_100';
        pct_desconto = 0;
      } else if (pct >= 0.70) {
        faixa = 'entre_70_84';
        pct_desconto = 0.10;
      } else {
        faixa = 'abaixo_70';
        pct_desconto = 0.30;
      }

      const valor_desconto = orcamento_bloco * pct_desconto;
      descontoProducao += valor_desconto;
      return { ...bloco, faixa, pct_desconto, valor_desconto };
    });

    // NÍVEL 2 — Descontos por indicadores de qualidade (flat 1% por indicador)
    let descontoQualidade = 0;
    const indicadores_qualidade = acompanhamentos.filter(
      a => a.indicador.grupo === 'qualidade_atencao'
    );

    const detalhes_qualidade = indicadores_qualidade.map(ac => {
      const nao_cumprido = ac.status_cumprimento === 'nao_cumprido';
      const valor_desconto = nao_cumprido ? valor_mensal_base * 0.01 : 0;
      descontoQualidade += valor_desconto;
      return { ...ac, percentual_desconto: nao_cumprido ? 1 : 0, valor_desconto };
    });

    const repasseFinal = valor_mensal_base - descontoProducao - descontoQualidade;

    return {
      modelo: 'flat',
      valor_mensal_base,
      parcela_fixa: valor_mensal_base * 0.90,
      parcela_variavel,
      desconto_producao_total: descontoProducao,
      desconto_qualidade_total: descontoQualidade,
      repasse_final: repasseFinal,
      detalhes_blocos,
      detalhes_qualidade,
    };
  }
}
```

### 3.3 Modelo Ponderado (INDSH — Chamamento 002/2025)

```javascript
// src/services/desconto/DescontoPonderadoService.js

class DescontoPonderadoService extends DescontoStrategy {
  calcular(contrato, acompanhamentos, blocos) {
    const { valor_mensal_base, perc_variavel } = contrato;
    const parcela_variavel = valor_mensal_base * (perc_variavel / 100);

    // NÍVEL 1 — Descontos por produção (mesma lógica de faixas)
    let descontoProducao = 0;
    const detalhes_blocos = blocos.map(bloco => {
      const pct = bloco.realizado / bloco.meta;
      let pct_desconto = 0;
      let faixa = 'acima_meta';
      if (pct >= 0.85) { faixa = pct >= 1 ? 'acima_meta' : 'entre_85_100'; pct_desconto = 0; }
      else if (pct >= 0.70) { faixa = 'entre_70_84'; pct_desconto = 0.10; }
      else { faixa = 'abaixo_70'; pct_desconto = 0.30; }
      const valor_desconto = bloco.orcamento_bloco * pct_desconto;
      descontoProducao += valor_desconto;
      return { ...bloco, faixa, pct_desconto, valor_desconto };
    });

    // NÍVEL 2 — Descontos proporcionais ao PESO do indicador (INDSH)
    let descontoQualidade = 0;
    const todos_indicadores = acompanhamentos;

    const detalhes_qualidade = todos_indicadores.map(ac => {
      const nao_cumprido = ac.status_cumprimento === 'nao_cumprido';
      const peso = ac.indicador.peso_perc / 100;  // ex: 0.15 para 15%
      // desconto = peso% × parcela_variável
      const valor_desconto = nao_cumprido ? parcela_variavel * peso : 0;
      descontoQualidade += valor_desconto;
      return { ...ac, percentual_desconto: nao_cumprido ? ac.indicador.peso_perc : 0, valor_desconto };
    });

    const repasseFinal = valor_mensal_base - descontoProducao - descontoQualidade;

    return {
      modelo: 'ponderado',
      valor_mensal_base,
      parcela_fixa: valor_mensal_base * 0.90,
      parcela_variavel,
      desconto_producao_total: descontoProducao,
      desconto_qualidade_total: descontoQualidade,
      repasse_final: repasseFinal,
      detalhes_blocos,
      detalhes_qualidade,
    };
  }
}
```

### 3.4 Factory de Seleção do Modelo

```javascript
// src/services/desconto/DescontoServiceFactory.js

const DescontoFlatService = require('./DescontoFlatService');
const DescontoPonderadoService = require('./DescontoPonderadoService');

class DescontoServiceFactory {
  static create(modelo_desconto_qual) {
    switch (modelo_desconto_qual) {
      case 'flat':      return new DescontoFlatService();
      case 'ponderado': return new DescontoPonderadoService();
      default:
        throw new Error(`Modelo de desconto desconhecido: ${modelo_desconto_qual}`);
    }
  }
}

module.exports = DescontoServiceFactory;
```

---

## 4. JOBS AGENDADOS (Node-Cron)

```javascript
// src/cron/ — Jobs automáticos

// calcularDescontoMensal.js
// Executa: 6º dia útil do mês às 02:00
// Ação: Para cada contrato ativo, busca acompanhamentos do mês anterior,
//       seleciona o service correto (flat ou ponderado), calcula descontos,
//       grava em TB_DESCONTOS, gera alertas, envia emails

// consolidacaoTrimestral.js
// Executa: 1º dia útil após fim de cada trimestre (04/Apr, 01/Jul, 01/Oct, 02/Jan)
// Ação: Consolida T1/T2/T3/T4 por unidade, classifica faixas, salva em TB_CONSOLIDACOES_PERIODICAS

// consolidacaoQuadrimestral.js
// Executa: 1º dia útil após fim de cada quadrimestre (01/Mai, 01/Set, 01/Jan)
// Ação: Consolida Q1/Q2/Q3 por unidade, verifica indicadores quadrimestrais (PPRA, PCMSO, POPs)

// alertaImplantacao.js
// Executa: Diariamente às 08:00
// Ação: Verifica indicadores de implantação com prazo próximo ou vencido,
//       envia alertas ao Gestor SMS e Auditora

// gerarAlertaDesempenho.js
// Executa: Diariamente às 08:00
// Ação: Identifica indicadores com % cumprimento <85% (alerta amarelo) e <70% (alerta vermelho),
//       notifica Gestor SMS, Auditora, Rodrigo

// alertaVigenciaContrato.js
// Executa: Semanalmente às 08:00 (segunda-feira)
// Ação: Verifica contratos com vencimento em 90, 60 e 30 dias, notifica Rodrigo

// backupBancoDados.js
// Executa: Diariamente às 03:00 (incremental) | Toda segunda às 02:00 (completo)
// Saída: /backups/saude_contratos_americana_YYYY-MM-DD.sql

// limpezaLogsAplicacao.js
// Executa: 1º dia do mês às 04:00
// Ação: Remove logs de aplicação >90 dias (NÃO remove TB_AUDITORIA_LOGS — retenção 5 anos)
```

---

## 5. ENDPOINTS REST COMPLETOS

> **Prefixo real da aplicação:** `/api` (não `/api/v1`). Exemplos abaixo usam o padrão antigo para compatibilidade de leitura; na implementação, trocar `v1` por rota direta em `/api`.

```
AUTENTICAÇÃO
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/auth/me/permissions   -- permissões do perfil (matriz)

OSS (Organizações Sociais)
GET    /api/v1/oss
POST   /api/v1/oss
GET    /api/v1/oss/:id
PUT    /api/v1/oss/:id

CONTRATOS
GET    /api/v1/contratos
POST   /api/v1/contratos
GET    /api/v1/contratos/:id
PUT    /api/v1/contratos/:id
GET    /api/v1/contratos/:id/aditivos
POST   /api/v1/contratos/:id/aditivos

UNIDADES
GET    /api/v1/unidades
GET    /api/v1/unidades/:id
POST   /api/v1/unidades
GET    /api/v1/unidades/:id/blocos

INDICADORES
GET    /api/v1/indicadores
GET    /api/v1/indicadores?unidade_id=X&tipo=qualitativo
GET    /api/v1/indicadores/:id
POST   /api/v1/indicadores
PUT    /api/v1/indicadores/:id
DELETE /api/v1/indicadores/:id          -- soft-delete

METAS ANUAIS
GET    /api/v1/metas/:ano
GET    /api/v1/metas/:ano?unidade_id=X
POST   /api/v1/metas
PUT    /api/v1/metas/:id

ACOMPANHAMENTO MENSAL
GET    /api/v1/acompanhamento/:mes
GET    /api/v1/acompanhamento/:mes?unidade_id=X&contrato_id=Y
POST   /api/v1/acompanhamento                      -- entrada simples
POST   /api/v1/acompanhamento/lote                 -- entrada em lote (CSV/JSON)
PUT    /api/v1/acompanhamento/:id
POST   /api/v1/acompanhamento/:id/submeter
POST   /api/v1/acompanhamento/:id/aprovar
POST   /api/v1/acompanhamento/:id/rejeitar
POST   /api/v1/acompanhamento/:id/nota-explicativa -- adicionar justificativa

CONSOLIDAÇÕES PERIÓDICAS
GET    /api/v1/consolidacoes/trimestral/:ano
GET    /api/v1/consolidacoes/trimestral/:ano/:trimestre
GET    /api/v1/consolidacoes/quadrimestral/:ano
GET    /api/v1/consolidacoes/quadrimestral/:ano/:quadrimestre
POST   /api/v1/consolidacoes/trimestral/gerar      -- forçar geração manual
POST   /api/v1/consolidacoes/quadrimestral/gerar

DESCONTOS
GET    /api/v1/descontos/:mes
GET    /api/v1/descontos/:mes?contrato_id=X
GET    /api/v1/descontos/validacao
POST   /api/v1/descontos/:id/validar
POST   /api/v1/descontos/:id/aprovar
GET    /api/v1/descontos/:id/simulacao              -- simular desconto sem salvar

FINANCEIRO (Rubricas)
GET    /api/v1/financeiro/:contrato_id/:mes
POST   /api/v1/financeiro/lote                     -- importar planilha de custos
PUT    /api/v1/financeiro/:id
GET    /api/v1/financeiro/cronograma/:contrato_id/:ano

RELATÓRIOS
GET    /api/v1/relatorios/dashboard                -- dados para dashboard principal
GET    /api/v1/relatorios/cms/:mes                 -- Pauta CMS (JSON → PDF)
GET    /api/v1/relatorios/auditoria/:mes
GET    /api/v1/relatorios/financeiro/:mes
GET    /api/v1/relatorios/trimestral/:ano/:tri
GET    /api/v1/relatorios/quadrimestral/:ano/:quad
GET    /api/v1/relatorios/contratada/:oss_id/:mes  -- visão OSS (restrito por RBAC)
POST   /api/v1/relatorios/export                   -- exportar Excel
POST   /api/v1/relatorios/export/pdf

USUÁRIOS
GET    /api/v1/usuarios
POST   /api/v1/usuarios
PUT    /api/v1/usuarios/:id
DELETE /api/v1/usuarios/:id                        -- soft-delete (LGPD)

PERMISSÕES (admin)
GET    /api/v1/permissoes/:perfil
PUT    /api/v1/permissoes/:perfil                 -- corpo: { permissoes: [...] }

METAS (extensão)
POST   /api/v1/metas/pacote                       -- cria agregada + N componentes (só produção)

AUDITORIA
GET    /api/v1/auditoria/logs
GET    /api/v1/auditoria/logs/:id
GET    /api/v1/auditoria/logs?tabela=X&data_inicio=Y&data_fim=Z
```

---

## 6. ESTRUTURA DO PROJETO

```
src/
├── config/
│   ├── database.js              # Conexão MySQL
│   ├── sequelize.js             # Configuração Sequelize
│   ├── constants.js             # Constantes (faixas, modelos desconto)
│   └── .env                     # Variáveis de ambiente
│
├── controllers/
│   ├── authController.js
│   ├── ossController.js
│   ├── contratoController.js
│   ├── unidadeController.js
│   ├── indicadorController.js
│   ├── metaController.js
│   ├── acompanhamentoController.js
│   ├── consolidacaoController.js
│   ├── descontoController.js
│   ├── financeiroController.js
│   ├── relatorioController.js
│   └── usuarioController.js
│
├── services/
│   ├── desconto/
│   │   ├── DescontoStrategy.js            # Interface base
│   │   ├── DescontoFlatService.js         # SCMC (flat −1%/indicador)
│   │   ├── DescontoPonderadoService.js    # INDSH (ponderado por peso%)
│   │   └── DescontoServiceFactory.js     # Seleciona modelo por contrato
│   ├── consolidacaoTrimestralService.js
│   ├── consolidacaoQuadrimestralService.js
│   ├── acompanhamentoService.js
│   ├── alertaService.js
│   ├── relatorioService.js
│   ├── financeiroService.js
│   └── emailService.js
│
├── models/
│   ├── OSS.js
│   ├── Contrato.js
│   ├── Aditivo.js
│   ├── Unidade.js
│   ├── BlocoProducao.js
│   ├── Indicador.js
│   ├── MetaAnual.js
│   ├── AcompanhamentoMensal.js
│   ├── NotaExplicativa.js
│   ├── ConsolidacaoPeriodica.js
│   ├── ConsolidacaoItem.js
│   ├── Desconto.js
│   ├── DescontoBloco.js
│   ├── DescontoIndicador.js
│   ├── RubricaOrcamentaria.js
│   ├── ExecucaoFinanceira.js
│   ├── Usuario.js
│   └── AuditoriaLog.js
│
├── cron/
│   ├── calcularDescontoMensal.js
│   ├── consolidacaoTrimestral.js
│   ├── consolidacaoQuadrimestral.js
│   ├── alertaImplantacao.js
│   ├── alertaDesempenho.js
│   ├── alertaVigenciaContrato.js
│   └── backupBancoDados.js
│
├── db/
│   ├── migrations/
│   │   ├── 001-create-oss.js
│   │   ├── 002-create-contratos.js
│   │   ├── 003-create-aditivos.js
│   │   ├── 004-create-unidades.js
│   │   ├── 005-create-blocos-producao.js
│   │   ├── 006-create-indicadores.js
│   │   ├── 007-create-metas-anuais.js
│   │   ├── 008-create-acompanhamento-mensal.js
│   │   ├── 009-create-notas-explicativas.js
│   │   ├── 010-create-consolidacoes.js
│   │   ├── 011-create-descontos.js
│   │   ├── 012-create-rubricas-orcamentarias.js
│   │   ├── 013-create-execucao-financeira.js
│   │   ├── 014-create-usuarios.js
│   │   └── 015-create-auditoria-logs.js
│   └── seeders/
│       ├── 001-seed-oss.js                -- SCMC + INDSH
│       ├── 002-seed-contratos.js          -- 009/2023, 066/2024, 002/2025
│       ├── 003-seed-unidades.js           -- HMA, UNACON, UPA Cillos, UPA Dona Rosa, UPA Zanaga
│       ├── 004-seed-blocos.js             -- 4 blocos HMA
│       ├── 005-seed-indicadores.js        -- todos os 50+ indicadores dos 3 contratos
│       ├── 006-seed-metas-2026.js         -- metas anuais 2026 conforme planos de trabalho
│       ├── 007-seed-rubricas.js           -- rubricas orçamentárias dos 3 contratos
│       └── 008-seed-usuarios.js           -- usuários iniciais
│
├── middlewares/
│   ├── authenticate.js
│   ├── authorize.js             -- RBAC com segregação por OSS
│   ├── errorHandler.js
│   ├── validation.js
│   ├── logging.js
│   ├── corsConfig.js
│   └── rateLimit.js
│
├── helpers/
│   ├── calculoDesconto.js       -- funções puras para cálculos
│   ├── consolidacaoHelper.js    -- helpers para consolidação periódica
│   ├── excelExport.js
│   ├── pdfExport.js
│   └── alertaService.js
│
└── routes/
    ├── index.js
    ├── auth.js
    ├── oss.js
    ├── contrato.js
    ├── unidade.js
    ├── indicador.js
    ├── meta.js
    ├── acompanhamento.js
    ├── consolidacao.js
    ├── desconto.js
    ├── financeiro.js
    ├── relatorio.js
    └── usuario.js
```

---

## 7. SEEDS INICIAIS (Dados dos Planos de Trabalho)

Os seeders devem popular o banco com os dados reais dos contratos:

### Seed OSS (001)
```javascript
{ nome: 'SCMC – Grupo Chavantes', cnpj: '73.027.690/0001-46', ... }
{ nome: 'INDSH', cnpj: '23.453.830/0001-70', ... }
```

### Seed Contratos (002)
```javascript
{ numero: '009/2023', oss: 'SCMC', termo_aditivo_atual: '6º',
  valor_mensal_base: 10855769.19, modelo_desconto_qual: 'flat' }
{ numero: '066/2024', oss: 'SCMC', termo_aditivo_atual: '2º',
  valor_mensal_base: 1600982.91, modelo_desconto_qual: 'flat' }
{ numero: '002/2025 (Chamamento)', oss: 'INDSH',
  valor_mensal_base: 1479452.60, modelo_desconto_qual: 'ponderado' }
```

### Seed Unidades (003)
```javascript
{ nome: 'Hospital Municipal Dr. Waldemar Tebaldi', sigla: 'HMA',
  tipo: 'hospital', cnes: null, contrato: '009/2023',
  capacidade_leitos: 128, porte: 'Porte Médio – Porte II' }
{ nome: 'UNACON', sigla: 'UNACON', tipo: 'unacon', contrato: '009/2023' }
{ nome: 'UPA 24h Avenida de Cillos', sigla: 'UPA_CILLOS',
  tipo: 'upa', cnes: '7471777', contrato: '009/2023' }
{ nome: 'UPA 24h Dona Rosa', sigla: 'UPA_DONA_ROSA',
  tipo: 'upa', cnes: '4777220', contrato: '066/2024' }
{ nome: 'UPA 24h Antônio Zanaga', sigla: 'UPA_ZANAGA',
  tipo: 'upa', contrato: '002/2025' }
```

### Seed Metas 2026 (006)
Todos os valores conforme as planilhas XLSX geradas:
- HMA: 12.000 atend./mês urgência, 90 partos/mês, 3.500 RX/mês, etc.
- UNACON: 354 sessões quimioterapia/mês
- UPA Cillos: 6.750 atend. médicos/mês
- UPA Dona Rosa: 6.750 atend., 1.450 RX, 3.000 lab./mês
- UPA Zanaga: 6.750 atend., 20.000 proc. enf., 1.000 RX, 3.000 lab./mês

---

## 8. SEGURANÇA E CONFORMIDADE

### 8.1 Segregação de Acesso por OSS
```javascript
// middleware/authorize.js — exemplo para contratadas
if (user.perfil === 'contratada_scmc') {
  // Pode ver apenas contratos da SCMC (009/2023 e 066/2024)
  query.where({ oss_id: SCMC_OSS_ID });
} else if (user.perfil === 'contratada_indsh') {
  // Pode ver apenas o contrato INDSH (002/2025)
  query.where({ oss_id: INDSH_OSS_ID });
}
```

### 8.2 Checklists

**Segurança:**
- [ ] HTTPS habilitado (certificado SSL)
- [ ] JWT com expiração de 8h (sessão de trabalho)
- [ ] 2FA para Admin e Gestor SMS
- [ ] Rate limiting (100 req/min por usuário)
- [ ] Segregação de dados por OSS (middleware RBAC)
- [ ] Auditoria de todos os acessos (TB_AUDITORIA_LOGS)
- [ ] Backup diário automatizado com retenção 5 anos

**Conformidade:**
- [ ] TCESP: retenção 5 anos em TB_AUDITORIA_LOGS
- [ ] LGPD: soft-delete para usuários (TB_USUARIOS)
- [ ] Notas explicativas para desvios de meta
- [ ] Histórico versionado de indicadores e metas
- [ ] Relatórios com cabeçalho oficial e espaço para assinatura

---

## 9. PRÓXIMOS PASSOS

### Fase 1 (Abr–Mai 2026): Setup e Design
- [ ] Servidor local configurado (MySQL/MariaDB)
- [ ] Node.js + Express operacional
- [ ] Migrations executadas (15 tabelas)
- [ ] Seeds iniciais carregados (dados dos 3 contratos)

### Fase 2 (Jun–Ago 2026): Desenvolvimento Core
- [ ] Motor de cálculo de desconto (flat + ponderado)
- [ ] Consolidações trimestrais/quadrimestrais
- [ ] APIs de acompanhamento e aprovação
- [ ] Autenticação JWT + RBAC por OSS

### Fase 3 (Set–Out 2026): Frontend + Testes
- [ ] Dashboard multi-contrato (React 18+)
- [ ] Formulários de entrada com validação em tempo real
- [ ] Geração de relatórios PDF/Excel
- [ ] UAT com SMS, Auditora, SCMC e INDSH

### Fase 4 (Nov 2026): Go-Live
- [ ] Dados históricos de 2025 migrados
- [ ] Treinamento de todos os usuários
- [ ] Suporte 24h por 30 dias pós-lançamento
- [ ] Monitoramento com PM2

---

**Documento Atualizado:** 23 de abril de 2026 | **Versão:** 2.1  
**Contratos de Referência:** SCMC 009/2023 (6º TA) · SCMC 066/2024 (2º TA UPA Dona Rosa) · INDSH Chamamento PMA 002/2025 (UPA Zanaga)  
**Especificações recentes:** `docs/superpowers/specs/2026-04-23-metas-decomposicao-pesos-design.md` · plano auth/permissions em `docs/superpowers/plans/2026-04-23-auth-permissions.md`  
**Responsável:** Rodrigo Alexander Diaz Leon, Diretor de Planejamento da SMS Americana
