# 🏥 Banco de Dados — SaúdeControl OSS v2.0
## Sistema de Acompanhamento de Contratos de Gestão em Saúde Pública
### Município de Americana/SP

**Versão:** 2.0 | **Atualizado:** Abril/2026  
**Compatibilidade:** MySQL 8.0+ / MariaDB 10.6+  
**Responsável:** Rodrigo Alexander Diaz Leon, Diretor de Planejamento da SMS Americana

---

## Propósito e Princípios de Design

Este banco de dados centraliza, gerencia e monitora contratos de gestão de unidades de saúde pública. A estrutura foi projetada com três princípios centrais:

1. **Multi-contrato ilimitado:** qualquer número de OSS, contratos e unidades pode ser adicionado sem alteração de schema.
2. **Imutabilidade do histórico:** toda mudança de valor, meta, regra ou configuração gera uma nova versão — nunca sobrescreve dados validados de períodos anteriores.
3. **Dois modelos de desconto coexistentes:** modelo *flat* (SCMC: −1% fixo por indicador não cumprido) e modelo *ponderado* (INDSH: −peso_individual% por indicador), selecionados automaticamente pela configuração do contrato.

---

## Schema SQL Completo

### GRUPO A — Estrutura Organizacional e Contratual

```sql
-- ============================================================
-- TB_OSS: Organizações Sociais de Saúde
-- ============================================================
CREATE TABLE TB_OSS (
  oss_id          CHAR(36)       PRIMARY KEY DEFAULT (UUID()),
  nome            VARCHAR(200)   NOT NULL,
  -- Ex: "SCMC – Grupo Chavantes" | "INDSH"
  cnpj            CHAR(18)       NOT NULL UNIQUE,
  -- Ex: "73.027.690/0001-46" | "23.453.830/0001-70"
  tipo_org        ENUM('Fundacao','Associacao','Cooperativa','Instituto','Outro')
                                 NOT NULL DEFAULT 'Instituto',
  email           VARCHAR(200),
  telefone        VARCHAR(20),
  endereco_social TEXT,
  -- Sede Social (ex: Pedro Leopoldo/MG para INDSH)
  endereco_adm    TEXT,
  -- Sede Administrativa (ex: São Paulo/SP para INDSH)
  site            VARCHAR(200),
  ativa           TINYINT(1)     NOT NULL DEFAULT 1,
  deleted_at      DATETIME       NULL,   -- soft-delete (LGPD)
  criado_em       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                 ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- TB_CONTRATOS: Contratos de Gestão
-- ============================================================
CREATE TABLE TB_CONTRATOS (
  contrato_id          CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  oss_id               CHAR(36)     NOT NULL REFERENCES TB_OSS(oss_id),
  numero               VARCHAR(50)  NOT NULL,
  -- Ex: "009/2023" | "066/2024" | "002/2025 (Chamamento)"
  tipo                 ENUM('contrato_gestao','chamamento_publico','convenio','outro')
                                    NOT NULL,
  -- Vigência atual (atualizada a cada aditivo)
  data_inicio          DATE         NOT NULL,
  data_fim             DATE         NOT NULL,
  -- Repasse base vigente (atualizado a cada aditivo)
  valor_mensal_base    DECIMAL(15,2) NOT NULL,
  valor_anual          DECIMAL(15,2) GENERATED ALWAYS AS (valor_mensal_base * 12) STORED,
  -- Estrutura de repasse
  perc_fixo            DECIMAL(5,2) NOT NULL DEFAULT 90.00,
  perc_variavel        DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  -- Modelo de desconto qualitativo:
  -- 'flat'      = SCMC: cada indicador não cumprido = −1% do repasse total
  -- 'ponderado' = INDSH: cada indicador = −peso_proprio% do variável
  modelo_desconto_qual ENUM('flat','ponderado') NOT NULL,
  -- Contagem de aditivos (atualizada automaticamente)
  numero_aditivos      INT          NOT NULL DEFAULT 0,
  -- Status
  status               ENUM('Ativo','Encerrado','Suspenso','Rompido')
                                    NOT NULL DEFAULT 'Ativo',
  observacoes          TEXT,
  deleted_at           DATETIME     NULL,
  criado_em            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                    ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT chk_datas_contrato CHECK (data_fim > data_inicio),
  CONSTRAINT chk_perc_soma      CHECK (perc_fixo + perc_variavel = 100.00),
  CONSTRAINT chk_perc_range     CHECK (perc_fixo BETWEEN 0 AND 100),
  INDEX idx_contratos_oss   (oss_id),
  INDEX idx_contratos_status(status)
);

-- ============================================================
-- TB_HISTORICO_CONTRATO: Snapshots de cada versão do contrato
-- Criado automaticamente a cada aditivo ou renovação anual.
-- Garante que possamos saber exatamente quais eram as
-- condições em qualquer momento histórico.
-- ============================================================
CREATE TABLE TB_HISTORICO_CONTRATO (
  historico_id        CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  contrato_id         CHAR(36)     NOT NULL REFERENCES TB_CONTRATOS(contrato_id),
  aditivo_id          CHAR(36)     NULL REFERENCES TB_ADITIVOS(aditivo_id),
  -- NULL = versão original; preenchido se mudança veio de aditivo
  versao              INT          NOT NULL DEFAULT 1,
  -- Vigência desta versão
  vigencia_inicio     DATE         NOT NULL,
  vigencia_fim        DATE         NULL,
  -- Valores vigentes nesta versão
  valor_mensal_base   DECIMAL(15,2) NOT NULL,
  perc_fixo           DECIMAL(5,2) NOT NULL,
  perc_variavel       DECIMAL(5,2) NOT NULL,
  modelo_desconto_qual ENUM('flat','ponderado') NOT NULL,
  motivo_versao       TEXT         NOT NULL,
  -- Ex: "Versão original", "Reajuste IPCA 4,68% - Out/2025", "2º Termo Aditivo"
  aprovado_por        CHAR(36)     NULL REFERENCES TB_USUARIOS(usuario_id),
  criado_em           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_hist_contrato   (contrato_id),
  INDEX idx_hist_vigencia   (contrato_id, vigencia_inicio),
  UNIQUE KEY uk_contrato_versao (contrato_id, versao)
);

-- ============================================================
-- TB_ADITIVOS: Termos Aditivos
-- ============================================================
CREATE TABLE TB_ADITIVOS (
  aditivo_id          CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  contrato_id         CHAR(36)     NOT NULL REFERENCES TB_CONTRATOS(contrato_id),
  numero_aditivo      INT          NOT NULL,
  -- Sequencial dentro do contrato: 1, 2, 3...
  data_assinatura     DATE         NOT NULL,
  data_vigencia_inicio DATE        NOT NULL,
  -- Tipo e conteúdo
  tipo_aditivo        ENUM('prorrogacao','reajuste_financeiro','alteracao_metas',
                           'alteracao_indicadores','alteracao_blocos',
                           'alteracao_regras','misto') NOT NULL,
  descricao_sumaria   VARCHAR(500) NOT NULL,
  conteudo_completo   LONGTEXT,
  documento_url       VARCHAR(500),
  -- Valores ANTERIORES ao aditivo (snapshot)
  valor_anterior      DECIMAL(15,2),
  -- Valores NOVOS definidos pelo aditivo
  novo_valor_mensal   DECIMAL(15,2),
  nova_data_fim       DATE,
  ipca_aplicado       DECIMAL(6,4),
  -- Ex: 0.0468 para 4,68%
  -- Controle
  aplicado            TINYINT(1)   NOT NULL DEFAULT 0,
  aplicado_em         DATETIME     NULL,
  aprovado_por        CHAR(36)     NULL REFERENCES TB_USUARIOS(usuario_id),
  criado_em           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uk_aditivo_numero (contrato_id, numero_aditivo),
  INDEX idx_aditivos_contrato (contrato_id)
);

-- ============================================================
-- TB_UNIDADES: Unidades de Saúde
-- ============================================================
CREATE TABLE TB_UNIDADES (
  unidade_id          CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  contrato_id         CHAR(36)     NOT NULL REFERENCES TB_CONTRATOS(contrato_id),
  nome                VARCHAR(200) NOT NULL,
  -- Ex: "Hospital Municipal Dr. Waldemar Tebaldi"
  sigla               VARCHAR(20)  NOT NULL,
  -- Ex: "HMA" | "UNACON" | "UPA_CILLOS" | "UPA_DONA_ROSA" | "UPA_ZANAGA"
  tipo                ENUM('hospital','upa','unacon','pa','ambulatorio','outro')
                                   NOT NULL,
  cnes                VARCHAR(20)  NULL,
  -- Ex: "7471777" (UPA Cillos) | "4777220" (UPA Dona Rosa)
  endereco            TEXT,
  porte               VARCHAR(100),
  -- Ex: "Porte Médio – Porte II" | "UPA Porte II Opção V"
  capacidade_leitos   INT          NULL,
  -- Preenchido apenas para hospitais (HMA: 128 leitos)
  especialidades      JSON         NULL,
  -- Array: ["Clínico Geral","Emergência","Pediatria","Oncologia"]
  responsavel_tecnico VARCHAR(200) NULL,
  -- Valor mensal segregado desta unidade dentro do contrato
  -- (para contratos que abrangem múltiplas unidades)
  valor_mensal_unidade DECIMAL(15,2) NULL,
  percentual_peso     DECIMAL(5,2) NULL,
  ativa               TINYINT(1)   NOT NULL DEFAULT 1,
  deleted_at          DATETIME     NULL,
  criado_em           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_unidades_contrato (contrato_id),
  INDEX idx_unidades_tipo     (tipo)
);

-- ============================================================
-- TB_BLOCOS_PRODUCAO: Blocos de Produção (principalmente HMA)
-- Cada bloco tem orçamento alocado e faixas de desconto.
-- ============================================================
CREATE TABLE TB_BLOCOS_PRODUCAO (
  bloco_id            CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  unidade_id          CHAR(36)     NOT NULL REFERENCES TB_UNIDADES(unidade_id),
  codigo              VARCHAR(30)  NOT NULL,
  -- Ex: "BLOCO_URG" | "BLOCO_INT" | "BLOCO_SADT" | "BLOCO_CIR"
  nome                VARCHAR(150) NOT NULL,
  -- Ex: "Bloco 1 – Urgência/Emergência"
  descricao           TEXT,
  valor_mensal_alocado DECIMAL(15,2) NOT NULL DEFAULT 0,
  percentual_peso_bloco DECIMAL(5,2) NOT NULL DEFAULT 0,
  -- % do orçamento total do contrato/unidade destinado a este bloco
  ativo               TINYINT(1)   NOT NULL DEFAULT 1,
  criado_em           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_bloco_codigo_unidade (unidade_id, codigo),
  INDEX idx_blocos_unidade (unidade_id)
);

-- ============================================================
-- TB_HISTORICO_BLOCOS: Snapshot de valores do bloco a cada aditivo
-- ============================================================
CREATE TABLE TB_HISTORICO_BLOCOS (
  hist_bloco_id       CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  bloco_id            CHAR(36)     NOT NULL REFERENCES TB_BLOCOS_PRODUCAO(bloco_id),
  aditivo_id          CHAR(36)     NULL REFERENCES TB_ADITIVOS(aditivo_id),
  versao              INT          NOT NULL DEFAULT 1,
  vigencia_inicio     DATE         NOT NULL,
  vigencia_fim        DATE         NULL,
  valor_mensal_alocado DECIMAL(15,2) NOT NULL,
  percentual_peso_bloco DECIMAL(5,2) NOT NULL,
  motivo_versao       TEXT         NOT NULL,
  criado_em           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_hist_bloco      (bloco_id),
  INDEX idx_hist_bloco_vig  (bloco_id, vigencia_inicio)
);
```

---

### GRUPO B — Indicadores e Metas

```sql
-- ============================================================
-- TB_INDICADORES: Catálogo de indicadores
-- ============================================================
CREATE TABLE TB_INDICADORES (
  indicador_id        CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  unidade_id          CHAR(36)     NULL REFERENCES TB_UNIDADES(unidade_id),
  -- NULL = indicador transversal (válido para todas as unidades do contrato)
  bloco_id            CHAR(36)     NULL REFERENCES TB_BLOCOS_PRODUCAO(bloco_id),
  -- NULL se não pertencer a bloco específico
  codigo              VARCHAR(50)  NOT NULL UNIQUE,
  -- Ex: "HMA_QUAL_01" | "ZANAGA_SAU_FUNC" | "UNACON_QUIMIO"
  nome                VARCHAR(300) NOT NULL,
  descricao           TEXT,
  tipo                ENUM('quantitativo','qualitativo') NOT NULL,
  grupo               ENUM('auditoria_operacional','qualidade_atencao',
                           'transversal','rh') NOT NULL,
  formula_calculo     TEXT,
  -- Descrição legível da fórmula
  unidade_medida      VARCHAR(50),
  -- "atendimentos" | "%" | "dias" | "sessões" | "doadores"
  periodicidade       ENUM('mensal','bimestral','trimestral',
                           'quadrimestral','unico') NOT NULL DEFAULT 'mensal',
  -- 'unico' = indicador de implantação com prazo definido (ex: INDSH)
  tipo_implantacao    TINYINT(1)   NOT NULL DEFAULT 0,
  -- 1 = prazo único (ex: "60 dias após início do contrato")
  prazo_dias_impl     INT          NULL,
  -- Relevante apenas quando tipo_implantacao = 1
  fonte_dados         ENUM('SIASUS','SIH','CNES','Prontuario',
                           'Manual','Misto') NOT NULL DEFAULT 'Manual',
  -- Para modelo de desconto PONDERADO (INDSH):
  -- peso_perc é o percentual individual do indicador (total = 100%)
  -- Para modelo FLAT (SCMC): campo não utilizado no cálculo
  peso_perc           DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  -- Tipo de comparação da meta (para determinar cumprimento)
  meta_tipo           ENUM('igualdade','maior_igual','menor_igual',
                           'entre','percentual_max') NOT NULL DEFAULT 'maior_igual',
  -- maior_igual: realizado >= meta (ex: taxa ocupação ≥85%)
  -- menor_igual: realizado <= meta (ex: taxa mortalidade <4%)
  -- entre: min <= realizado <= max
  -- percentual_max: realizado <= meta (ex: taxa cesarianas ≤33%)
  -- Versionamento
  versao              INT          NOT NULL DEFAULT 1,
  ativo               TINYINT(1)   NOT NULL DEFAULT 1,
  deleted_at          DATETIME     NULL,   -- soft-delete
  criado_em           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_ind_unidade     (unidade_id),
  INDEX idx_ind_tipo        (tipo),
  INDEX idx_ind_grupo       (grupo),
  INDEX idx_ind_ativo       (ativo),
  INDEX idx_ind_periodicidade (periodicidade)
);

-- ============================================================
-- TB_HISTORICO_INDICADORES: Versões anteriores de indicadores
-- Permite alterar indicador sem perder histórico
-- ============================================================
CREATE TABLE TB_HISTORICO_INDICADORES (
  hist_ind_id         CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  indicador_id        CHAR(36)     NOT NULL REFERENCES TB_INDICADORES(indicador_id),
  aditivo_id          CHAR(36)     NULL REFERENCES TB_ADITIVOS(aditivo_id),
  versao              INT          NOT NULL,
  vigencia_inicio     DATE         NOT NULL,
  vigencia_fim        DATE         NULL,
  -- Snapshot dos campos que podem mudar
  nome                VARCHAR(300) NOT NULL,
  formula_calculo     TEXT,
  periodicidade       VARCHAR(30)  NOT NULL,
  peso_perc           DECIMAL(5,2) NOT NULL,
  meta_tipo           VARCHAR(30)  NOT NULL,
  fonte_dados         VARCHAR(30)  NOT NULL,
  motivo_versao       TEXT         NOT NULL,
  alterado_por        CHAR(36)     NULL REFERENCES TB_USUARIOS(usuario_id),
  criado_em           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_hist_ind        (indicador_id),
  INDEX idx_hist_ind_vigencia (indicador_id, vigencia_inicio)
);

-- ============================================================
-- TB_METAS: Metas por período de vigência
-- NOVA ABORDAGEM: não vinculada a "ano fixo"
-- Cada meta tem vigência (inicio e fim), podendo ser
-- alterada via aditivo a qualquer momento.
-- ============================================================
CREATE TABLE TB_METAS (
  meta_id             CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  indicador_id        CHAR(36)     NOT NULL REFERENCES TB_INDICADORES(indicador_id),
  aditivo_id          CHAR(36)     NULL REFERENCES TB_ADITIVOS(aditivo_id),
  -- NULL = meta original do contrato
  versao              INT          NOT NULL DEFAULT 1,
  vigencia_inicio     DATE         NOT NULL,
  vigencia_fim        DATE         NULL,
  -- NULL = vigente até ser substituída por nova versão
  -- Valores da meta
  meta_mensal         DECIMAL(15,4),
  -- NULL para indicadores de qualidade (% ou dias)
  meta_anual          DECIMAL(15,4),
  -- calculado automaticamente quando relevante
  meta_valor_qualit   DECIMAL(15,4),
  -- Para indicadores qualitativos (ex: 0.85 = 85%, 10 = 10 dias)
  meta_minima         DECIMAL(15,4),
  -- Faixa de desconto 30% (70% da meta quantitativa)
  meta_parcial        DECIMAL(15,4),
  -- Faixa sem desconto (85% da meta quantitativa)
  unidade_medida      VARCHAR(50),
  -- "atendimentos" | "%" | "dias" | "sessões"
  observacoes         TEXT,
  -- Ex: "Incremento base histórica 2025 → 1.450 exames RX"
  -- Prazo de implantação (para tipo_implantacao = 1)
  prazo_implantacao   DATE         NULL,
  -- Data limite para cumprimento do indicador de implantação
  aprovado_por        CHAR(36)     NULL REFERENCES TB_USUARIOS(usuario_id),
  criado_em           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_metas_indicador   (indicador_id),
  INDEX idx_metas_vigencia    (indicador_id, vigencia_inicio),
  INDEX idx_metas_aditivo     (aditivo_id)
);
```

---

### GRUPO C — Acompanhamento e Desempenho

```sql
-- ============================================================
-- TB_ACOMPANHAMENTO_MENSAL: Valores realizados mensalmente
-- Tabela de entrada de dados — coração do sistema
-- ============================================================
CREATE TABLE TB_ACOMPANHAMENTO_MENSAL (
  acomp_id            CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  indicador_id        CHAR(36)     NOT NULL REFERENCES TB_INDICADORES(indicador_id),
  meta_id             CHAR(36)     NOT NULL REFERENCES TB_METAS(meta_id),
  -- Referência à meta VIGENTE no momento do preenchimento
  mes_referencia      DATE         NOT NULL,
  -- Sempre YYYY-MM-01 (primeiro dia do mês)
  -- Snapshot da meta no momento (garante histórico mesmo se meta mudar depois)
  meta_vigente_mensal  DECIMAL(15,4),
  meta_vigente_qualit  DECIMAL(15,4),
  -- Valor realizado (obrigatório; >= 0)
  valor_realizado     DECIMAL(15,4) NULL,
  -- NULL enquanto em rascunho
  -- Cálculos automáticos (via TRIGGER ao preencher valor_realizado)
  percentual_cumprimento DECIMAL(8,4) GENERATED ALWAYS AS (
    CASE
      WHEN meta_vigente_mensal IS NOT NULL AND meta_vigente_mensal > 0
        THEN ROUND((valor_realizado / meta_vigente_mensal) * 100, 4)
      ELSE NULL
    END
  ) STORED,
  variacao_vs_mes_ant DECIMAL(8,4) NULL,
  -- Calculado pelo backend ao salvar
  status_cumprimento  ENUM('cumprido','parcial','nao_cumprido',
                           'nao_aplicavel','aguardando') NOT NULL DEFAULT 'aguardando',
  faixa_producao      ENUM('acima_meta','entre_85_100',
                           'entre_70_84','abaixo_70') NULL,
  -- Para indicadores de implantação
  status_implantacao  ENUM('nao_iniciado','em_prazo',
                           'cumprido','vencido') NULL,
  data_cumprimento_impl DATE NULL,
  -- Notas e justificativas
  descricao_desvios   TEXT         NULL,
  -- Obrigatório quando status != 'cumprido' (validação no backend)
  -- Fluxo de aprovação
  status_aprovacao    ENUM('rascunho','submetido','aprovado',
                           'rejeitado') NOT NULL DEFAULT 'rascunho',
  preenchido_por      CHAR(36)     NULL REFERENCES TB_USUARIOS(usuario_id),
  data_preenchimento  DATETIME     NULL,
  submetido_por       CHAR(36)     NULL REFERENCES TB_USUARIOS(usuario_id),
  data_submissao      DATETIME     NULL,
  aprovado_por        CHAR(36)     NULL REFERENCES TB_USUARIOS(usuario_id),
  data_aprovacao      DATETIME     NULL,
  motivo_rejeicao     TEXT         NULL,
  -- Desconto estimado (calculado em tempo real para exibição)
  desconto_estimado   DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  -- Versão (para retificações formais)
  versao              INT          NOT NULL DEFAULT 1,
  criado_em           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_acomp_ind_mes (indicador_id, mes_referencia),
  INDEX idx_acomp_mes         (mes_referencia),
  INDEX idx_acomp_status      (status_cumprimento),
  INDEX idx_acomp_aprovacao   (status_aprovacao),
  INDEX idx_acomp_indicador   (indicador_id),
  CONSTRAINT chk_valor_realizado
    CHECK (valor_realizado IS NULL OR valor_realizado >= 0)
);

-- ============================================================
-- TB_NOTAS_EXPLICATIVAS: Justificativas formais de desvio
-- Obrigatórias quando status != cumprido
-- ============================================================
CREATE TABLE TB_NOTAS_EXPLICATIVAS (
  nota_id             CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  acomp_id            CHAR(36)     NOT NULL REFERENCES TB_ACOMPANHAMENTO_MENSAL(acomp_id),
  descricao           TEXT         NOT NULL,
  causa_raiz          TEXT,
  acao_corretiva      TEXT,
  previsao_normalizacao DATE        NULL,
  criado_por          CHAR(36)     NOT NULL REFERENCES TB_USUARIOS(usuario_id),
  validado_por        CHAR(36)     NULL REFERENCES TB_USUARIOS(usuario_id),
  status_validacao    ENUM('pendente','aceita','rejeitada') NOT NULL DEFAULT 'pendente',
  motivo_rejeicao_nota TEXT        NULL,
  criado_em           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_notas_acomp (acomp_id)
);

-- ============================================================
-- TB_CONSOLIDACOES: Análises trimestrais e quadrimestrais
-- Geradas automaticamente pelo job scheduler
-- ============================================================
CREATE TABLE TB_CONSOLIDACOES (
  consolidacao_id     CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  unidade_id          CHAR(36)     NOT NULL REFERENCES TB_UNIDADES(unidade_id),
  tipo_periodo        ENUM('trimestral','quadrimestral') NOT NULL,
  periodo_numero      TINYINT      NOT NULL,
  -- Trimestral: 1=Jan-Mar | 2=Abr-Jun | 3=Jul-Set | 4=Out-Dez
  -- Quadrimestral: 1=Jan-Abr | 2=Mai-Ago | 3=Set-Dez
  ano                 SMALLINT     NOT NULL,
  data_inicio         DATE         NOT NULL,
  data_fim            DATE         NOT NULL,
  status              ENUM('gerado','validado','arquivado') NOT NULL DEFAULT 'gerado',
  gerado_em           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  gerado_por          CHAR(36)     NULL,
  -- NULL = gerado automaticamente por job

  UNIQUE KEY uk_consolidacao (unidade_id, tipo_periodo, periodo_numero, ano),
  INDEX idx_consol_unidade (unidade_id),
  INDEX idx_consol_ano     (ano, tipo_periodo)
);

-- ============================================================
-- TB_CONSOLIDACAO_ITENS: Detalhe por indicador na consolidação
-- ============================================================
CREATE TABLE TB_CONSOLIDACAO_ITENS (
  item_id             CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  consolidacao_id     CHAR(36)     NOT NULL REFERENCES TB_CONSOLIDACOES(consolidacao_id),
  indicador_id        CHAR(36)     NOT NULL REFERENCES TB_INDICADORES(indicador_id),
  soma_realizado      DECIMAL(15,4),
  media_realizado     DECIMAL(15,4),
  meta_periodo        DECIMAL(15,4),
  percentual_cumprimento DECIMAL(8,4),
  faixa               ENUM('acima_meta','entre_85_100',
                           'entre_70_84','abaixo_70') NULL,
  meses_cumpridos     TINYINT,
  meses_totais        TINYINT,
  desconto_periodo    DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  criado_em           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uk_consol_item (consolidacao_id, indicador_id),
  INDEX idx_consol_item_consol (consolidacao_id)
);
```

---

### GRUPO D — Descontos e Repasse Financeiro

```sql
-- ============================================================
-- TB_REPASSE_MENSAL: Cálculo do repasse consolidado por contrato/mês
-- Uma linha por contrato × mês, gerada automaticamente no 6º dia útil
-- ============================================================
CREATE TABLE TB_REPASSE_MENSAL (
  repasse_id          CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  contrato_id         CHAR(36)     NOT NULL REFERENCES TB_CONTRATOS(contrato_id),
  historico_contrato_id CHAR(36)   NOT NULL REFERENCES TB_HISTORICO_CONTRATO(historico_id),
  -- Qual versão do contrato estava vigente neste mês
  mes_referencia      DATE         NOT NULL,
  -- Valores base
  valor_mensal_base   DECIMAL(15,2) NOT NULL,
  parcela_fixa        DECIMAL(15,2) NOT NULL,
  parcela_variavel    DECIMAL(15,2) NOT NULL,
  -- Descontos
  desconto_producao_total  DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  desconto_qualidade_total DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  desconto_total      DECIMAL(15,2) GENERATED ALWAYS AS
                      (desconto_producao_total + desconto_qualidade_total) STORED,
  -- Repasse final
  repasse_final       DECIMAL(15,2) GENERATED ALWAYS AS
                      (valor_mensal_base - desconto_producao_total
                       - desconto_qualidade_total) STORED,
  percentual_retido   DECIMAL(5,2) GENERATED ALWAYS AS
                      (ROUND((desconto_total / valor_mensal_base) * 100, 2)) STORED,
  -- Fluxo de aprovação
  status              ENUM('calculado','validado','aprovado','pago')
                      NOT NULL DEFAULT 'calculado',
  calculado_em        DATETIME     NULL,
  validado_por        CHAR(36)     NULL REFERENCES TB_USUARIOS(usuario_id),
  data_validacao      DATETIME     NULL,
  aprovado_por        CHAR(36)     NULL REFERENCES TB_USUARIOS(usuario_id),
  data_aprovacao      DATETIME     NULL,
  data_pagamento      DATETIME     NULL,
  observacoes         TEXT,
  criado_em           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_repasse_contrato_mes (contrato_id, mes_referencia),
  INDEX idx_repasse_mes     (mes_referencia),
  INDEX idx_repasse_status  (status)
);

-- ============================================================
-- TB_DESCONTOS_BLOCO: Desconto detalhado por bloco de produção
-- Filho de TB_REPASSE_MENSAL
-- ============================================================
CREATE TABLE TB_DESCONTOS_BLOCO (
  desc_bloco_id       CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  repasse_id          CHAR(36)     NOT NULL REFERENCES TB_REPASSE_MENSAL(repasse_id),
  bloco_id            CHAR(36)     NOT NULL REFERENCES TB_BLOCOS_PRODUCAO(bloco_id),
  mes_referencia      DATE         NOT NULL,
  meta_mensal         DECIMAL(15,4) NOT NULL,
  valor_realizado     DECIMAL(15,4) NOT NULL,
  percentual_atingimento DECIMAL(8,4) NOT NULL,
  faixa               ENUM('acima_meta','entre_85_100',
                           'entre_70_84','abaixo_70') NOT NULL,
  orcamento_bloco     DECIMAL(15,2) NOT NULL,
  percentual_desconto DECIMAL(5,2)  NOT NULL,
  -- 0 | 10 | 30
  valor_desconto      DECIMAL(15,2) NOT NULL,
  auditado            TINYINT(1)    NOT NULL DEFAULT 0,
  auditado_por        CHAR(36)      NULL REFERENCES TB_USUARIOS(usuario_id),
  data_auditoria      DATETIME      NULL,
  criado_em           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_desc_bloco_repasse (repasse_id),
  INDEX idx_desc_bloco_mes     (mes_referencia)
);

-- ============================================================
-- TB_DESCONTOS_INDICADOR: Desconto detalhado por indicador qualitativo
-- Filho de TB_REPASSE_MENSAL
-- Suporta os dois modelos: flat e ponderado
-- ============================================================
CREATE TABLE TB_DESCONTOS_INDICADOR (
  desc_ind_id         CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  repasse_id          CHAR(36)     NOT NULL REFERENCES TB_REPASSE_MENSAL(repasse_id),
  acomp_id            CHAR(36)     NOT NULL REFERENCES TB_ACOMPANHAMENTO_MENSAL(acomp_id),
  indicador_id        CHAR(36)     NOT NULL REFERENCES TB_INDICADORES(indicador_id),
  mes_referencia      DATE         NOT NULL,
  -- Modelo de cálculo aplicado
  modelo_desconto     ENUM('flat','ponderado') NOT NULL,
  -- Para modelo flat: percentual_desconto = 1% (fixo)
  -- Para modelo ponderado: percentual_desconto = peso_perc do indicador
  peso_indicador      DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  percentual_desconto DECIMAL(5,2) NOT NULL,
  valor_desconto      DECIMAL(15,2) NOT NULL,
  auditado            TINYINT(1)    NOT NULL DEFAULT 0,
  auditado_por        CHAR(36)      NULL REFERENCES TB_USUARIOS(usuario_id),
  data_auditoria      DATETIME      NULL,
  criado_em           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_desc_ind_repasse (repasse_id),
  INDEX idx_desc_ind_mes     (mes_referencia)
);
```

---

### GRUPO E — Módulo Financeiro (Rubricas Orçamentárias)

```sql
-- ============================================================
-- TB_RUBRICAS: Estrutura orçamentária por contrato
-- Baseada nas planilhas de custeio SCMC e INDSH
-- ============================================================
CREATE TABLE TB_RUBRICAS (
  rubrica_id          CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  contrato_id         CHAR(36)     NOT NULL REFERENCES TB_CONTRATOS(contrato_id),
  rubrica_pai_id      CHAR(36)     NULL REFERENCES TB_RUBRICAS(rubrica_id),
  -- NULL = grupo; preenchido = sub-item
  codigo              VARCHAR(20)  NOT NULL,
  -- Ex: "01" (grupo RH) | "01.17" (Salários e Ordenados)
  nome                VARCHAR(200) NOT NULL,
  nivel               ENUM('grupo','categoria') NOT NULL,
  ativo               TINYINT(1)   NOT NULL DEFAULT 1,
  criado_em           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uk_rubrica_contrato_cod (contrato_id, codigo),
  INDEX idx_rubrica_contrato (contrato_id)
);

-- ============================================================
-- TB_EXECUCAO_FINANCEIRA: Orçado vs Realizado por rubrica/mês
-- ============================================================
CREATE TABLE TB_EXECUCAO_FINANCEIRA (
  exec_id             CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  rubrica_id          CHAR(36)     NOT NULL REFERENCES TB_RUBRICAS(rubrica_id),
  mes_referencia      DATE         NOT NULL,
  valor_orcado        DECIMAL(15,2) NOT NULL,
  -- Conforme planilha de custeio aprovada
  valor_realizado     DECIMAL(15,2) NULL,
  -- Preenchido até 20º dia útil
  variacao            DECIMAL(15,2) GENERATED ALWAYS AS
                      (COALESCE(valor_realizado,0) - valor_orcado) STORED,
  variacao_perc       DECIMAL(8,4) GENERATED ALWAYS AS (
    CASE WHEN valor_orcado <> 0
      THEN ROUND(((COALESCE(valor_realizado,0) - valor_orcado) / valor_orcado) * 100, 4)
      ELSE NULL
    END
  ) STORED,
  status_aprovacao    ENUM('rascunho','submetido','aprovado') NOT NULL DEFAULT 'rascunho',
  preenchido_por      CHAR(36)     NULL REFERENCES TB_USUARIOS(usuario_id),
  aprovado_por        CHAR(36)     NULL REFERENCES TB_USUARIOS(usuario_id),
  criado_em           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_exec_rubrica_mes (rubrica_id, mes_referencia),
  INDEX idx_exec_mes   (mes_referencia),
  INDEX idx_exec_rubrica (rubrica_id)
);

-- ============================================================
-- TB_HISTORICO_RUBRICAS: Snapshot de valores orçados a cada aditivo
-- ============================================================
CREATE TABLE TB_HISTORICO_RUBRICAS (
  hist_rub_id         CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  rubrica_id          CHAR(36)     NOT NULL REFERENCES TB_RUBRICAS(rubrica_id),
  aditivo_id          CHAR(36)     NULL REFERENCES TB_ADITIVOS(aditivo_id),
  versao              INT          NOT NULL DEFAULT 1,
  vigencia_inicio     DATE         NOT NULL,
  vigencia_fim        DATE         NULL,
  valor_orcado_mensal DECIMAL(15,2) NOT NULL,
  motivo_versao       TEXT         NOT NULL,
  criado_em           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_hist_rub        (rubrica_id),
  INDEX idx_hist_rub_vigencia (rubrica_id, vigencia_inicio)
);
```

---

### GRUPO F — Comissões e Documentos Regulatórios

```sql
-- ============================================================
-- TB_COMISSOES: Comissões obrigatórias por unidade
-- ============================================================
CREATE TABLE TB_COMISSOES (
  comissao_id         CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  unidade_id          CHAR(36)     NOT NULL REFERENCES TB_UNIDADES(unidade_id),
  tipo                ENUM('CCIH','SAU','CIPA','NSP','Prontuarios',
                           'Obitos','Etica_Medica','Etica_Enfermagem',
                           'Humanizacao','GTH','Farmacoterapeutica',
                           'Gerenciamento_Residuos','Outro') NOT NULL,
  data_constituicao   DATE         NULL,
  funcionando         TINYINT(1)   NOT NULL DEFAULT 0,
  ultima_reuniao      DATE         NULL,
  integrantes         JSON         NULL,
  -- Array de { nome, cargo, conselho_profissional }
  observacoes         TEXT,
  criado_em           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_comissao_tipo_unidade (unidade_id, tipo),
  INDEX idx_comissoes_unidade (unidade_id)
);

-- ============================================================
-- TB_DOCUMENTOS_REGULATORIOS: CNES, alvarás, licenças
-- ============================================================
CREATE TABLE TB_DOCUMENTOS_REGULATORIOS (
  doc_id              CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  unidade_id          CHAR(36)     NOT NULL REFERENCES TB_UNIDADES(unidade_id),
  tipo_documento      ENUM('CNES','Alvara_Sanitario','Licenca_Ambiental',
                           'AVCB','Registro_CFM','Registro_COREN',
                           'CRF','Habilitacao_UNACON','Outro') NOT NULL,
  numero_documento    VARCHAR(100),
  orgao_emissor       VARCHAR(100),
  data_emissao        DATE         NULL,
  data_vencimento     DATE         NULL,
  -- NULL = sem prazo
  ativa               TINYINT(1)   NOT NULL DEFAULT 1,
  arquivo_url         VARCHAR(500),
  observacoes         TEXT,
  criado_em           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_docs_unidade    (unidade_id),
  INDEX idx_docs_vencimento (data_vencimento)
);
```

---

### GRUPO G — Usuários e Segurança

```sql
-- ============================================================
-- TB_USUARIOS
-- ============================================================
CREATE TABLE TB_USUARIOS (
  usuario_id          CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  nome                VARCHAR(200) NOT NULL,
  email               VARCHAR(200) NOT NULL UNIQUE,
  cpf                 CHAR(14)     NULL UNIQUE,
  telefone            VARCHAR(20)  NULL,
  perfil              ENUM('admin','gestor_sms','auditora',
                           'conselheiro_cms','contratada_scmc',
                           'contratada_indsh','central_regulacao',
                           'visualizador') NOT NULL,
  -- Acesso restrito por OSS para perfis 'contratada_*'
  oss_id              CHAR(36)     NULL REFERENCES TB_OSS(oss_id),
  -- NULL = acesso a todas as OSS (admin, gestor_sms, auditora, cms)
  senha_hash          VARCHAR(72)  NOT NULL,
  -- bcrypt com 12+ rounds
  token_2fa           VARCHAR(32)  NULL,
  ativo               TINYINT(1)   NOT NULL DEFAULT 1,
  data_criacao        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_acesso       DATETIME     NULL,
  deleted_at          DATETIME     NULL,   -- soft-delete (LGPD)
  atualizado_em       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_usuarios_perfil (perfil),
  INDEX idx_usuarios_oss    (oss_id)
);

-- ============================================================
-- TB_AUDITORIA_LOGS: Registro imutável de todas as operações
-- Retenção: 5 anos (TCESP Instrução 01/2020)
-- ============================================================
CREATE TABLE TB_AUDITORIA_LOGS (
  log_id              CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  usuario_id          CHAR(36)     NULL REFERENCES TB_USUARIOS(usuario_id),
  -- NULL = operação do sistema (job automático)
  tabela_afetada      VARCHAR(100) NOT NULL,
  registro_id         CHAR(36)     NULL,
  operacao            ENUM('INSERT','UPDATE','DELETE',
                           'SELECT','LOGIN','LOGOUT',
                           'EXPORT','APPROVE','REJECT') NOT NULL,
  dados_antes         JSON         NULL,
  dados_depois        JSON         NULL,
  ip_origem           VARCHAR(45)  NULL,
  user_agent          TEXT         NULL,
  data_operacao       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  descricao_mudanca   TEXT,

  -- SEM deleted_at — logs são permanentes (TCESP)
  INDEX idx_audit_usuario   (usuario_id),
  INDEX idx_audit_tabela    (tabela_afetada),
  INDEX idx_audit_data      (data_operacao),
  INDEX idx_audit_operacao  (operacao)
);
```

---

## Constraints e Validações

```sql
-- ============================================================
-- CONSTRAINTS ADICIONAIS
-- ============================================================

-- TB_ACOMPANHAMENTO_MENSAL: Consistência status × %
ALTER TABLE TB_ACOMPANHAMENTO_MENSAL
  ADD CONSTRAINT chk_status_cumprimento CHECK (
    status_cumprimento IN ('nao_aplicavel','aguardando')
    OR (status_cumprimento = 'cumprido'    AND percentual_cumprimento >= 100)
    OR (status_cumprimento = 'parcial'     AND percentual_cumprimento >= 85
                                           AND percentual_cumprimento < 100)
    OR (status_cumprimento = 'nao_cumprido' AND percentual_cumprimento < 85)
  );

-- TB_DESCONTOS_BLOCO: Percentuais válidos
ALTER TABLE TB_DESCONTOS_BLOCO
  ADD CONSTRAINT chk_perc_desc_bloco CHECK (percentual_desconto IN (0, 10, 30));

-- TB_METAS: Meta mínima <= meta mensal
ALTER TABLE TB_METAS
  ADD CONSTRAINT chk_metas_coerencia CHECK (
    meta_minima IS NULL OR meta_mensal IS NULL OR meta_minima <= meta_mensal
  );

-- TB_CONTRATOS: Data fim > início
ALTER TABLE TB_CONTRATOS
  ADD CONSTRAINT chk_contrato_datas CHECK (data_fim > data_inicio);

-- TB_INDICADORES: Peso total por unidade deve somar ≤ 100%
-- (validação no backend, não implementável como check constraint simples)
```

---

## Índices para Performance

```sql
-- Queries de acompanhamento mensal (mais frequentes)
CREATE INDEX idx_acomp_mes_indicador
  ON TB_ACOMPANHAMENTO_MENSAL (mes_referencia, indicador_id);

CREATE INDEX idx_acomp_mes_status
  ON TB_ACOMPANHAMENTO_MENSAL (mes_referencia, status_aprovacao);

-- Queries de repasse e desconto
CREATE INDEX idx_repasse_contrato_mes
  ON TB_REPASSE_MENSAL (contrato_id, mes_referencia);

CREATE INDEX idx_desc_bloco_repasse_mes
  ON TB_DESCONTOS_BLOCO (repasse_id, mes_referencia);

-- Queries de histórico e versionamento
CREATE INDEX idx_hist_contrato_vigencia
  ON TB_HISTORICO_CONTRATO (contrato_id, vigencia_inicio);

CREATE INDEX idx_metas_vigencia_ativa
  ON TB_METAS (indicador_id, vigencia_inicio, vigencia_fim);

-- Alertas (vencimentos de documentos)
CREATE INDEX idx_docs_vencimento_ativa
  ON TB_DOCUMENTOS_REGULATORIOS (data_vencimento, ativa);

-- Auditoria (queries TCESP)
CREATE INDEX idx_audit_data_usuario
  ON TB_AUDITORIA_LOGS (data_operacao, usuario_id);

CREATE INDEX idx_audit_data_tabela
  ON TB_AUDITORIA_LOGS (data_operacao, tabela_afetada);

-- Consolidações periódicas
CREATE INDEX idx_consol_ano_tipo
  ON TB_CONSOLIDACOES (ano, tipo_periodo, unidade_id);

-- Execução financeira
CREATE INDEX idx_exec_mes_rubrica
  ON TB_EXECUCAO_FINANCEIRA (mes_referencia, rubrica_id);

-- Indicadores por grupo e tipo
CREATE INDEX idx_ind_grupo_tipo
  ON TB_INDICADORES (grupo, tipo, ativo);
```

---

## View: Meta Vigente por Indicador

```sql
-- Retorna a meta vigente para cada indicador em uma data específica.
-- Usada por todo o sistema ao abrir preenchimento de um mês.
CREATE OR REPLACE VIEW VW_META_VIGENTE AS
SELECT
  m.indicador_id,
  m.meta_id,
  m.vigencia_inicio,
  m.vigencia_fim,
  m.meta_mensal,
  m.meta_anual,
  m.meta_valor_qualit,
  m.meta_minima,
  m.meta_parcial,
  m.unidade_medida,
  m.observacoes,
  m.versao
FROM TB_METAS m
WHERE m.vigencia_fim IS NULL
   OR m.vigencia_fim >= CURDATE();
-- Para obter meta vigente em data específica:
-- WHERE m.vigencia_inicio <= @data AND (m.vigencia_fim IS NULL OR m.vigencia_fim >= @data)
```

---

## Procedure: Aplicar Aditivo

```sql
-- Aplicar um aditivo cria snapshots históricos de tudo que mudou
-- e atualiza os valores vigentes nas tabelas principais.
DELIMITER $$
CREATE PROCEDURE sp_aplicar_aditivo(IN p_aditivo_id CHAR(36))
BEGIN
  DECLARE v_contrato_id  CHAR(36);
  DECLARE v_novo_valor   DECIMAL(15,2);
  DECLARE v_nova_data    DATE;
  DECLARE v_versao       INT;

  START TRANSACTION;

  -- 1. Buscar dados do aditivo
  SELECT contrato_id, COALESCE(novo_valor_mensal, 0), nova_data_fim
  INTO v_contrato_id, v_novo_valor, v_nova_data
  FROM TB_ADITIVOS WHERE aditivo_id = p_aditivo_id;

  -- 2. Obter próxima versão
  SELECT COALESCE(MAX(versao),0) + 1
  INTO v_versao
  FROM TB_HISTORICO_CONTRATO WHERE contrato_id = v_contrato_id;

  -- 3. Fechar versão anterior (setar vigencia_fim)
  UPDATE TB_HISTORICO_CONTRATO
  SET vigencia_fim = DATE_SUB((SELECT data_vigencia_inicio
                               FROM TB_ADITIVOS WHERE aditivo_id = p_aditivo_id), INTERVAL 1 DAY)
  WHERE contrato_id = v_contrato_id AND vigencia_fim IS NULL;

  -- 4. Criar snapshot da nova versão do contrato
  INSERT INTO TB_HISTORICO_CONTRATO
    (contrato_id, aditivo_id, versao, vigencia_inicio,
     valor_mensal_base, perc_fixo, perc_variavel,
     modelo_desconto_qual, motivo_versao)
  SELECT
    v_contrato_id, p_aditivo_id, v_versao,
    (SELECT data_vigencia_inicio FROM TB_ADITIVOS WHERE aditivo_id = p_aditivo_id),
    COALESCE(v_novo_valor, valor_mensal_base),
    perc_fixo, perc_variavel, modelo_desconto_qual,
    (SELECT CONCAT('Aditivo ', numero_aditivo, ': ', descricao_sumaria)
     FROM TB_ADITIVOS WHERE aditivo_id = p_aditivo_id)
  FROM TB_CONTRATOS WHERE contrato_id = v_contrato_id;

  -- 5. Atualizar TB_CONTRATOS com novos valores
  UPDATE TB_CONTRATOS
  SET
    valor_mensal_base = COALESCE(NULLIF(v_novo_valor,0), valor_mensal_base),
    data_fim          = COALESCE(v_nova_data, data_fim),
    numero_aditivos   = numero_aditivos + 1
  WHERE contrato_id = v_contrato_id;

  -- 6. Marcar aditivo como aplicado
  UPDATE TB_ADITIVOS
  SET aplicado = 1, aplicado_em = NOW()
  WHERE aditivo_id = p_aditivo_id;

  COMMIT;
END$$
DELIMITER ;
```

---

## Fórmulas e Triggers

```sql
-- ============================================================
-- TRIGGER: Calcular variação % ao inserir/atualizar acompanhamento
-- ============================================================
DELIMITER $$
CREATE TRIGGER trg_acomp_calcular_variacao
BEFORE INSERT ON TB_ACOMPANHAMENTO_MENSAL
FOR EACH ROW
BEGIN
  DECLARE v_realizado_ant DECIMAL(15,4);

  -- Buscar valor realizado do mês anterior para o mesmo indicador
  SELECT valor_realizado
  INTO   v_realizado_ant
  FROM   TB_ACOMPANHAMENTO_MENSAL
  WHERE  indicador_id   = NEW.indicador_id
    AND  mes_referencia = DATE_SUB(NEW.mes_referencia, INTERVAL 1 MONTH)
    AND  status_aprovacao = 'aprovado'
  LIMIT 1;

  -- Calcular variação percentual
  IF v_realizado_ant IS NOT NULL AND v_realizado_ant <> 0 THEN
    SET NEW.variacao_vs_mes_ant =
      ROUND(((NEW.valor_realizado - v_realizado_ant) / v_realizado_ant) * 100, 4);
  END IF;

  -- Definir status_cumprimento baseado em percentual
  IF NEW.valor_realizado IS NULL THEN
    SET NEW.status_cumprimento = 'aguardando';
  ELSEIF NEW.percentual_cumprimento >= 100 THEN
    SET NEW.status_cumprimento = 'cumprido';
  ELSEIF NEW.percentual_cumprimento >= 85 THEN
    SET NEW.status_cumprimento = 'parcial';
  ELSE
    SET NEW.status_cumprimento = 'nao_cumprido';
  END IF;

  -- Definir faixa de produção
  IF NEW.percentual_cumprimento >= 100 THEN
    SET NEW.faixa_producao = 'acima_meta';
  ELSEIF NEW.percentual_cumprimento >= 85 THEN
    SET NEW.faixa_producao = 'entre_85_100';
  ELSEIF NEW.percentual_cumprimento >= 70 THEN
    SET NEW.faixa_producao = 'entre_70_84';
  ELSEIF NEW.percentual_cumprimento IS NOT NULL THEN
    SET NEW.faixa_producao = 'abaixo_70';
  END IF;
END$$
DELIMITER ;
```

---

## Contagem de Tabelas: 22 Tabelas

| **Grupo** | **Tabelas** | **Propósito** |
|---|---|---|
| A – Organizacional | TB_OSS, TB_CONTRATOS, TB_HISTORICO_CONTRATO, TB_ADITIVOS, TB_UNIDADES, TB_BLOCOS_PRODUCAO, TB_HISTORICO_BLOCOS | Estrutura contratual com histórico completo |
| B – Indicadores | TB_INDICADORES, TB_HISTORICO_INDICADORES, TB_METAS | Catálogo e metas com versionamento |
| C – Acompanhamento | TB_ACOMPANHAMENTO_MENSAL, TB_NOTAS_EXPLICATIVAS, TB_CONSOLIDACOES, TB_CONSOLIDACAO_ITENS | Entrada de dados e análises periódicas |
| D – Financeiro | TB_REPASSE_MENSAL, TB_DESCONTOS_BLOCO, TB_DESCONTOS_INDICADOR | Cálculo de repasse e descontos |
| E – Rubricas | TB_RUBRICAS, TB_EXECUCAO_FINANCEIRA, TB_HISTORICO_RUBRICAS | Acompanhamento orçamentário |
| F – Operacional | TB_COMISSOES, TB_DOCUMENTOS_REGULATORIOS | Conformidade e controle |
| G – Segurança | TB_USUARIOS, TB_AUDITORIA_LOGS | Acesso e rastreabilidade |

---

## Notas Técnicas

- **Motor:** InnoDB (transações ACID) | **Charset:** utf8mb4 | **Collation:** utf8mb4_unicode_ci
- **UUIDs:** `DEFAULT (UUID())` disponível MySQL 8.0+ / MariaDB 10.6+
- **Soft-delete:** implementado em TB_OSS, TB_CONTRATOS, TB_INDICADORES, TB_USUARIOS
- **Histórico imutável:** tabelas `TB_HISTORICO_*` nunca recebem UPDATE — apenas INSERT
- **Gerados:** colunas GENERATED ALWAYS AS STORED para variação, repasse_final, percentual_retido
- **Backup:** incremental diário (03h) + completo semanal (02h segunda) + mensal (arquivo)
- **Retenção:** TB_AUDITORIA_LOGS = 5 anos mínimo (TCESP); demais dados = indefinido

---

**Versão:** 2.0 | **Tabelas:** 22 | **Views:** 1 | **Procedures:** 1 | **Triggers:** 1  
**Responsável:** Rodrigo Alexander Diaz Leon — SMS Americana
