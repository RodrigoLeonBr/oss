# 📋 DOCUMENTO DE REQUISITOS DO PRODUTO (PRD)

## Sistema de Acompanhamento de Contratos de Gestão em Saúde Pública
### Município de Americana/SP — **SaúdeControl OSS**

**Versão:** 2.1  
**Data de Atualização:** 23 de abril de 2026  
**Responsável:** Rodrigo Alexander Diaz Leon, Diretor de Planejamento da SMS Americana  
**Status:** Documento fundacional alinhado aos planos em `docs/superpowers/plans/` e specs em `docs/superpowers/specs/` (auth/permissions, metas decomposição)  
**Contratos de Referência:** SCMC nº 009/2023 (6º TA) · INDSH Chamamento PMA nº 002/2025

---

## SUMÁRIO EXECUTIVO

O **SaúdeControl OSS** é um sistema de acompanhamento de contratos de gestão em saúde pública que centraliza, monitora e audita o desempenho operacional e financeiro de **quatro unidades de saúde** gerenciadas por **duas organizações sociais distintas** no Município de Americana/SP:

| **Unidade** | **OSS** | **Repasse Mensal** | **Contrato** |
|---|---|---|---|
| Hospital Municipal Dr. Waldemar Tebaldi (HMA) | SCMC – Grupo Chavantes | componente do total SCMC | SCMC nº 009/2023 – 6º TA |
| UNACON – Alta Complexidade Oncológica | SCMC – Grupo Chavantes | componente do total SCMC | SCMC nº 009/2023 – 6º TA |
| UPA 24h Avenida de Cillos (UPA Cillos) | SCMC – Grupo Chavantes | componente do total SCMC | SCMC nº 009/2023 – 6º TA |
| UPA 24h Dona Rosa | SCMC – Grupo Chavantes | R$ 1.600.982,91/mês | Contrato 066/2024 – 2º TA |
| UPA 24h Antônio Zanaga | INDSH | R$ 1.479.452,60/mês | Chamamento PMA 002/2025 |

> **Nota:** O repasse total do contrato SCMC 009/2023 (6º TA) abrange HMA + UNACON + UPA Cillos conjuntamente, com cálculo de desconto por bloco de produção (HMA) e indicadores qualitativos aplicados ao conjunto.

---

## 1. VISÃO E OBJETIVOS ESTRATÉGICOS

### 1.1 Visão do Produto

Desenvolver um **sistema integrado de acompanhamento de contratos de gestão de saúde pública** que centraliza, monitora e audita o desempenho operacional e financeiro das unidades de saúde gerenciadas por organizações sociais, garantindo transparência, rastreabilidade e conformidade com normas municipais, estaduais e federais.

### 1.2 Objetivo Geral

O sistema deve automatizar e integrar os seguintes processos críticos:

- **Monitoramento de Desempenho:** Acompanhamento mensal de indicadores quantitativos e qualitativos nas 5 unidades (HMA, UNACON, UPA Cillos, UPA Dona Rosa, UPA Zanaga), com periodicidades distintas (mensal, bimestral, quadrimestral)
- **Cálculo Automático de Repasse:** Aplicação das regras de repasse (90% fixo + 10% variável para SCMC; estrutura proporcional por pesos para INDSH) com descontos automáticos por produção insuficiente ou não cumprimento de metas de qualidade
- **Análise Periódica:** Suporte a análises trimestrais e quadrimestrais com consolidação automática dos dados mensais
- **Auditoria Completa:** Registro rastreável de todas as operações, decisões e mudanças no sistema, conforme exigências do TCESP e LGPD
- **Suporte à Governança:** Geração de relatórios e dashboards para o Conselho Municipal de Saúde, Secretaria de Saúde e Central de Regulação

### 1.3 Públicos-Alvo (Stakeholders)

| **Público-Alvo** | **Função** | **Necessidades Principais** |
|---|---|---|
| **Conselho Municipal de Saúde (CMS)** | Órgão deliberativo e fiscalizador | Relatórios consolidados, indicadores de desempenho, conformidade regulatória |
| **Secretaria de Saúde (SMS)** | Ente contratante, gestor | Entrada de dados, validação, aprovação de repasses, auditoria de descontos |
| **Rodrigo Alexander Diaz Leon** | Diretor de Planejamento | Visão executiva, relatórios estratégicos, alertas de risco, análise de tendências |
| **Central de Regulação (Mariana)** | Coordenadora de acesso | Dados de produção, referência/contrarreferência, fluxos assistenciais |
| **SCMC – Grupo Chavantes** | Contratada (HMA, UNACON, UPA Cillos, UPA Dona Rosa) | Consulta de desempenho, alertas de risco, métricas de seus contratos |
| **INDSH** | Contratada (UPA Zanaga) | Consulta de desempenho, alertas de risco, métricas do seu contrato |
| **Auditora (SMS)** | Validadora de dados e descontos | Auditoria de cálculos, validação de indicadores, parecer técnico |
| **TCESP** | Órgão de fiscalização | Exportação de dados completos, auditoria de repasses, conformidade regulatória |

### 1.4 Benefícios Esperados

**Transparência:** Visibilidade total do desempenho contratual; acesso a dados em tempo real; relatórios padronizados e comparáveis entre unidades e entre OSS diferentes.

**Rastreabilidade:** Auditoria completa de quem fez o quê, quando e por quê; histórico de mudanças com snapshots antes/depois; conformidade TCESP (5 anos de retenção).

**Redução de Erros:** Validações automáticas de entrada; cálculos padronizados sem erros manuais; alertas de inconsistências.

**Eficiência Operacional:** Redução de 80% no tempo de cálculo de descontos; eliminação de planilhas soltas; decisões baseadas em dados.

**Conformidade Regulatória:** Resolução 183 MS/GM (2023); Portaria GM/MS nº 1.429/2023 (UNACON); Portaria GM 10/2017 (UPA Porte II); LGPD; TCESP Instrução 01/2020.

---

## 2. ESCOPO FUNCIONAL — MÓDULOS PRINCIPAIS

### 2.1 Módulo de Gestão de Contratos

**Objetivo:** Centralizar informações de todos os contratos de gestão ativos e históricos.

**Funcionalidades:**
- Cadastro de contratos (número, data início/fim, valor mensal/anual, organização social)
- Rastreamento de termos aditivos (número, data, conteúdo, impacto financeiro, vigência)
- Controle de vigência (alertas de vencimento próximo — 90, 60, 30 dias)
- Histórico completo de modificações
- Status do contrato (Ativo, Encerrado, Suspenso, Rompido)
- Reajuste pelo IPCA (campo para aplicação de reajuste anual, com histórico)

**Contratos Ativos (referência inicial):**

| **Contrato** | **OSS** | **Unidades** | **Valor Mensal Base** | **Vigência** |
|---|---|---|---|---|
| SCMC nº 009/2023 – 6º TA | SCMC/Grupo Chavantes | HMA + UNACON + UPA Cillos | R$ 10.855.769,19* | 2026 (a confirmar) |
| Contrato 066/2024 – 2º TA | SCMC/Grupo Chavantes | UPA Dona Rosa | R$ 1.600.982,91 | 12 meses a partir da assinatura |
| Chamamento PMA 002/2025 | INDSH | UPA Zanaga | R$ 1.479.452,60 | 12 meses a partir da assinatura |

*Valor estimado conforme PRD v1.0; a confirmar na formalização.

**Campos Adicionais (dados das planilhas):**
- CNES da unidade (HMA: identificar; UPA Cillos: 7471777; UPA Dona Rosa: 4777220; UPA Zanaga: a confirmar)
- Classificação da unidade (Hospital Porte II; UPA Porte II Opção V; UNACON)
- Especialidades in loco por unidade

---

### 2.2 Módulo de Indicadores

**Objetivo:** Gerenciar o catálogo flexível de indicadores (CRUD completo) com suporte para adicionar/remover/modificar sem impactar históricos.

**Funcionalidades:**
- CRUD completo com versionamento
- Classificação: tipo (Quantitativo / Qualitativo), grupo (Auditoria Operacional / Qualidade Assistencial / Transversal), unidade, bloco de produção, periodicidade
- Pesos individuais (para indicadores com pontuação proporcional — ex: INDSH)
- Fórmulas de cálculo armazenadas em texto
- Suporte a indicadores com diferentes regras por OSS (ver 2.2.3)

#### 2.2.1 Indicadores do Contrato SCMC (HMA, UNACON, UPA Cillos)

**Grupo I — Auditoria Operacional (HMA — 18 indicadores)**

| Nº | Indicador | Meta | Periodicidade | Pontuação |
|---|---|---|---|---|
| 1 | Funcionamento Comissão Revisão Prontuários | 100% | Mensal | 10% |
| 1 | Funcionamento Comissão Avaliação/Revisão Óbitos | 100% | Mensal | 10% |
| 1 | Funcionamento CCIH | 100% | Mensal | 10% |
| 1 | Funcionamento NSP (Núcleo Segurança do Paciente) | 100% | Mensal | 10% |
| 2 | Funcionamento do SAU | 100% | Mensal | 3% |
| 3 | Resolubilidade da Ouvidoria | ≥90% | Mensal | 3% |
| 4 | Acompanhamento Plano Educação Permanente + CIPA | ≥80% | Mensal | 3% |
| 5 | PPRA + PCMSO | 100% | Quadrimestral | 3% |
| 6 | Atualização CNES | 100% | Mensal | 3% |
| 7 | Alimentação Sistemas Informatizados (SIH/SIA) | 100% | Mensal | 3% |
| 8 | Registros Órgãos de Classe | 100% | Quadrimestral | 3% |
| 9 | POPs Assistenciais/Administrativos | 100% | Quadrimestral | 3% |
| 10 | Grupo de Trabalho em Humanização (GTH) | 100% | Mensal | 5% |
| 11 | Entrega Relatórios/Prestações de Contas | 100% | Mensal | 9% |
| 12 | Documentação Regulatória | 100% | Mensal | 9% |
| 13 | Qualidade na Atenção (múltiplos sub-indicadores) | ≥85% | Mensal | 5% |
| 14 | Complexidade Cirúrgica (70% média / 30% alta) | — | Mensal | 2% |

**Grupo II — Qualidade da Atenção (HMA — 10 indicadores, 10% cada)**

| Nº | Indicador | Fórmula | Meta |
|---|---|---|---|
| 1 | % Óbitos analisados Comissão | ∑ óbitos analisados / ∑ óbitos >24h × 100 | 100% |
| 2 | Média permanência UTI Adulto | ∑ pacientes-dia / Nº saídas | ≤10 dias |
| 3 | Média permanência Clínica Médica | ∑ pacientes-dia / Nº saídas | ≤8 dias |
| 4 | Média permanência Clínica Cirúrgica | ∑ pacientes-dia / Nº saídas | ≤5 dias |
| 5 | Taxa Mortalidade Institucional | ∑ óbitos >24h / Nº saídas × 100 | <4% |
| 6 | Média permanência UTI Neonatal | ∑ pacientes-dia / Nº saídas | ≤20 dias |
| 7 | Taxa de Ocupação Hospitalar | ∑ pacientes-dia / ∑ leitos-dia × 100 | ≥85% |
| 8 | Taxa de Cesarianas | Nº partos cesárea / Nº total partos × 100 | ≤33% |
| 9 | Taxa Acolhimento c/ Classificação de Risco | ∑ pac. classificados / Nº atendidos × 100 | ≥90% |
| 10 | Taxa Satisfação do Usuário | ∑ "satisfeito/muito satisfeito" / total × 100 | ≥85% |

**Indicadores UNACON (Qualitativos)**

| Nº | Indicador | Meta | Periodicidade | Pontuação |
|---|---|---|---|---|
| 1 | Atualização CNES | 100% | Mensal | 10% |
| 2 | Alimentação Sistemas Informatizados MS | 100% | Mensal | 10% |
| 3 | Registros Órgãos de Classe | 100% | Mensal | 10% |
| 4 | POPs Assistenciais/Administrativos | 100% | Mensal | 10% |
| 5 | Entrega Relatórios/Prestações de Contas | 100% | Mensal | 10% |
| 6 | Documentação Regulatória | 100% | Mensal | 10% |
| 7 | Qualidade tratamento oncológico (múltiplos) | Variável | Mensal | 40% |

**Indicadores UPA Cillos (Qualitativos)**

| Nº | Indicador | Meta | Periodicidade | Pontuação |
|---|---|---|---|---|
| 1 | Funcionamento SAU | 100% | Mensal | 10% |
| 2 | Comissão Revisão Prontuário + Óbitos | 100% | Mensal | 20% |
| 3 | Atualização CNES | 100% | Mensal | 10% |
| 4 | Alimentação Sistemas MS | 100% | Mensal | 10% |
| 5 | Registros Órgãos de Classe | 100% | Sempr. que houver | 9% |
| 6 | Entrega Relatórios/Prestações de Contas | 100% | Mensal | 9% |
| 7 | Documentação Regulatória | 100% | Mensal | 9% |
| 8 | Resolubilidade Ouvidoria | ≥90% | Mensal | 3% |

#### 2.2.2 Indicadores Contrato UPA Dona Rosa (SCMC)

Segue estrutura idêntica à UPA Cillos acima, com periodicidades iguais.

Indicadores qualitativos de qualidade assistencial adicionais:
- Taxa Mortalidade Institucional (<4%)
- Média Permanência na Observação (24 horas)
- Taxa Acolhimento c/ Classificação de Risco (>90%)
- Taxa Satisfação do Usuário (>85%)

#### 2.2.3 Indicadores Contrato UPA Zanaga (INDSH)

Sistema de pesos proporcional (total = 100%):

| Nº | Indicador | Meta | Periodicidade | Peso |
|---|---|---|---|---|
| 1 | Constituição do SAU | 100% | 90 dias do contrato | 3% |
| 2 | Funcionamento do SAU | 100% | Mensal | 6% |
| 3 | Implantação Comissão Prontuários | 100% | 60 dias do contrato | 3% |
| 4 | Acomp. Mensal Comissão Prontuários | 100% | Mensal | 6% |
| 5 | Implantação Comissão de Óbitos | 100% | 60 dias do contrato | 3% |
| 6 | Acomp. Mensal Comissão de Óbitos | 100% | Mensal | 6% |
| 7 | Implantação Comissão Ética Médica | 100% | 60 dias do contrato | 3% |
| 8 | Acomp. Mensal Comissão Ética Médica | 100% | Mensal | 6% |
| 9 | Cadastro Profissionais CNES | 100% | Mensal | 6% |
| 10 | Total profissional médico exercício >95% | 100% | Mensal | 8% |
| 11 | Implantação Acolhimento c/ Classif. Risco | 100% | 60 dias do contrato | 6% |
| 12 | Acomp. Classificação por Cor | 100% | Mensal | 9% |
| 13 | Relatórios Assistenciais e Financeiros | 100% | Mensal (até 20º dia útil) | 11% |
| 14 | Satisfação Usuário ≥80% (Bom/Ótimo, 2% usuários) | 100% | Mensal | 15% |
| 15 | Taxa Atividade Educação Permanente | 100% | Mensal | 9% |
| **TOTAL** | | | | **100%** |

> **Diferença crítica:** No INDSH, o desconto qualitativo é proporcional ao **peso específico do indicador** (não flat 1% por indicador como no SCMC). Indicador não cumprido = perda do % do seu peso × 10% variável.

---

### 2.3 Módulo de Metas Quantitativas

**Objetivo:** Gerenciar metas anuais e mensais, com flexibilidade para variação anual.

**Extensão aprovada (abril/2026) — decomposição e cumprimento ponderado**

Referência: [Metas — decomposição, pesos e cumprimento global](superpowers/specs/2026-04-23-metas-decomposicao-pesos-design.md).

- Indicador **quantitativo** pode ter **pacote** de metas: linha **agregada** (referência de volume) + N linhas **componente** com **peso** &gt; 0; soma dos volumes das componentes = referência do agregado.  
- **Cumprimento** agregado no indicador: **média ponderada** de fatores por linha (não substituir por simples `soma(realizados)/soma(metas)`); abaixo de `meta_mínima`, aplica-se **teto (cap)** configurável no produto para o fator de linha.  
- **Entrada de realizado:** sempre por **meta folha** (avulsa ou componente). Meta agregada **não** recebe lançamento direto de realizado.  
- **Unicidade:** um registro de acompanhamento por par (**meta folha**, **mês**). Indicadores **qualitativos** permanecem com meta em **linha única** (sem decomposição).

#### Metas por Unidade (referência 2026):

**HMA — Indicadores Quantitativos por Bloco**

| Bloco | Indicador | Meta Mensal | Meta Anual |
|---|---|---|---|
| Bloco 1 – Urgência/Emergência | Atendimentos Urgência/Emergência | 12.000 | 144.000 |
| Bloco 2 – Cirurgias CC | Partos e Nascimentos (incl. cesárea) | 90 | 1.080 |
| Bloco 2 – Cirurgias CC | Cirurgia Geral/Ap. Digestivo | 70 | 840 |
| Bloco 2 – Cirurgias CC | Cirurgia Sistema Osteomuscular | 70 | 840 |
| Bloco 2 – Cirurgias CC | Cirurgia Ap. Geniturinário | 50 | 600 |
| Bloco 2 – Cirurgias CC | Demais cirurgias CC | Ver planilha | — |
| Bloco 3 – SADT Interno | RX com/sem contraste | 3.500 | 42.000 |
| Bloco 3 – SADT Interno | Exames Laboratoriais | 26.000 | 312.000 |
| Bloco 3 – SADT Interno | Tomografia | 300 | 3.600 |
| Bloco 3 – SADT Externo | Mamografia | 200 | 2.400 |
| Bloco 3 – SADT Externo | Ultrassonografia Externo | 450 | 5.400 |
| Bloco 4 – Pequenas Cirurgias | Pele Subcutânea | 100 | 1.200 |
| Internações | Taxa Ocupação Clínica Médica | 85% | — |
| Internações | Taxa Ocupação UTI Adulto | 90% | — |
| Internações | Taxa Ocupação UTI Neonatal | 90% | — |
| Hemodiálise | Atendimento Ambulatorial | 120 | 1.440 |
| Banco de Sangue | Doadores (Int. + Ext.) | 350 | 4.200 |

**UNACON — Metas Quantitativas**

| Indicador | Meta Mensal | Meta Anual |
|---|---|---|
| Sessões de Quimioterapia ⭐ | 354 | 4.248 |
| Cirurgias Oncológicas (Baixa/Média) | 44 | 528 |
| Cirurgia Reparadora | 5 | 60 |
| Ultrassonografia | 50 | 600 |
| Tomografia com Contraste | 250 | 3.000 |

**UPA Cillos — Metas Quantitativas**

| Indicador | Meta Mensal | Meta Anual |
|---|---|---|
| Atendimentos Médicos | 6.750 | 81.000 |
| RX sem Contraste (referência) | 1.000 | 12.000 |
| Exames Laboratoriais (referência) | 2.260 | 27.120 |

**UPA Dona Rosa — Metas Quantitativas**

| Indicador | Meta Mensal | Meta Anual |
|---|---|---|
| Atendimentos Médicos | 6.750 | 81.000 |
| RX sem Contraste | 1.450 | 17.400 |
| Exames Laboratoriais | 3.000 | 36.000 |
| Total SADT | 4.450 | 53.400 |

**UPA Zanaga — Metas Quantitativas**

| Indicador | Meta Mensal | Meta Anual |
|---|---|---|
| Atendimentos Médicos | 6.750 | 81.000 |
| Classificação de Risco | 6.750 | 81.000 |
| Procedimentos de Enfermagem | 20.000 | 240.000 |
| Total Proc. Enfermagem | 26.750 | 321.000 |
| RX sem Contraste | 1.000 | 12.000 |
| Exames Laboratoriais | 3.000 | 36.000 |
| Total SADT | 4.000 | 48.000 |

---

### 2.4 Módulo de Acompanhamento Mensal

**Objetivo:** Plataforma de entrada de dados mensais com validação em tempo real.

**Funcionalidades:**
- Formulário de entrada por indicador/mês/unidade
- Suporte a entrada agrupada (múltiplos indicadores da mesma unidade na mesma sessão)
- Validações automáticas:
  - Valores negativos rejeitados
  - Indicadores de qualidade: apenas 0-100%
  - Alertas para desvios suspeitos (zero quando meta esperada >80%)
- Cálculos automáticos:
  - % Cumprimento = (Realizado / Meta Mensal) × 100
  - Status: ≥100% Cumprido | 85–99% Parcial | <85% Não Cumprido
  - Variação % vs mês anterior
  - Desconto estimado em tempo real
- Fluxo de aprovação: Rascunho → Submissão → Auditoria → Aprovado → Bloqueado
- **Análise Trimestral Automática:** Consolidação automática a cada 3 meses com cálculo de faixa (≥85% sem desconto / 70–84,9% –10% / <70% –30%)
- **Análise Quadrimestral Automática:** Consolidação automática a cada 4 meses (referência para indicadores quadrimestrais como PPRA, PCMSO, POPs)

**Interfaces por Público:**
- **SMS (Gestor):** Entrada de dados + validação + aprovação
- **CMS:** Visualização de consolidados trimestrais/quadrimestrais, alertas
- **Central de Regulação (Mariana):** Dados de produção por unidade, referência/contrarreferência
- **Contratada SCMC:** Consulta de desempenho das suas unidades (HMA, UNACON, UPA Cillos, UPA Dona Rosa)
- **Contratada INDSH:** Consulta de desempenho da UPA Zanaga

---

### 2.5 Módulo de Cálculo de Repasse

**Objetivo:** Automatizar o cálculo de descontos e definir valor final de repasse mensal por contrato.

#### 2.5.1 Regras de Repasse — Contrato SCMC (HMA + UNACON + UPA Cillos)

**Estrutura Geral:**
- 90% fixo: pago independentemente
- 10% variável: condicionado ao Grupo II (Qualidade da Atenção)

**Desconto por Produção (4 Blocos HMA):**

| Faixa de Produção | Desconto |
|---|---|
| ≥ 100% ou 85–100% | 0% (100% do orçamento do bloco) |
| 70–84,9% | −10% do orçamento do bloco |
| < 70% | −30% do orçamento do bloco |

**Desconto por Qualidade (Grupo II — HMA):**
- Cada indicador não cumprido = −1% do variável (10% do total)
- Valor unitário: −R$ 108.557,69/indicador (baseado em R$ 10.855.769,19 total)
- Máximo: 10 indicadores × 1% = perda total do variável

**Exemplo de Cálculo Consolidado (referência):**
```
Orçamento Base Mensal: R$ 10.855.769,19

DESCONTOS POR PRODUÇÃO (Blocos HMA):
- Urgência: 75% → Desconto 10% = −R$ 239.654,89
- Internações: 80% → Desconto 10% = −R$ 199.295,74
- SADT: 72% → Sem desconto (>70%) = R$ 0,00
- Cirurgias: 90% → Sem desconto = R$ 0,00
SUBTOTAL: −R$ 438.950,63

DESCONTOS POR QUALIDADE:
- Taxa de Cesarianas 36% (meta ≤33%) → −1% = −R$ 108.557,69
- Taxa de Ocupação 80% (meta ≥85%) → −1% = −R$ 108.557,69
SUBTOTAL: −R$ 217.115,38

REPASSE FINAL: R$ 10.855.769,19 − R$ 656.066,01 = R$ 10.199.703,18
```

#### 2.5.2 Regras de Repasse — UPA Dona Rosa (SCMC)

- Repasse Mensal Base: R$ 1.600.982,91
- Parcela Fixa (90%): R$ 1.440.884,62
- Parcela Variável (10%): R$ 160.098,29
- Desconto por produção: mesma tabela de faixas (≥85% sem desconto / 70–84,9% −10% / <70% −30%)
- Desconto qualitativo: proporcional aos indicadores não cumpridos (flat −1% por indicador não cumprido)
- Número de indicadores com impacto financeiro: a definir na formalização contratual

#### 2.5.3 Regras de Repasse — UPA Zanaga (INDSH)

- Repasse Mensal Base (Custeio): R$ 1.479.452,60
- Parcela Fixa (90%): R$ 1.331.507,34
- Parcela Variável (10%): R$ 147.945,26
- **Desconto por produção:** mesma tabela de faixas
- **Desconto qualitativo proporcional ao peso individual:**
  - Indicador não cumprido = perda de seu % de peso × 10% variável
  - Exemplo: SAU Funcionamento (peso 6%) não cumprido = −6% × R$ 147.945,26 = −R$ 8.876,72
  - Exemplo: Satisfação do Usuário (peso 15%) não cumprido = −15% × R$ 147.945,26 = −R$ 22.191,79
  - Máximo: todos os indicadores não cumpridos = perda de 100% do variável = −R$ 147.945,26

> **Diferença crítica de implementação:** O sistema deve suportar dois modelos de desconto qualitativo:
> - **Modelo SCMC:** flat −1% por indicador (máximo 10%)
> - **Modelo INDSH:** proporcional ao peso do indicador (máximo 100% do variável)

---

### 2.6 Módulo de Relatórios e Dashboards

**Objetivo:** Gerar visualizações e exportações para diferentes públicos.

#### Dashboard Executivo (CMS e Secretaria)
- Visão comparativa das 5 unidades (lado a lado)
- Status semafórico por unidade (Verde/Amarelo/Vermelho)
- Descontos estimados no mês corrente e acumulados no período
- Tendências: gráficos de linha 3 e 6 meses
- Total de repasse estimado vs máximo possível

#### Pauta Mensal do Conselho Municipal de Saúde (CMS)
- Resumo executivo (1 página por contrato)
- Tabelas de desempenho por unidade
- Análise trimestral consolidada
- Conformidade regulatória (checklist: CNES, alvarás, licenças)
- Impacto financeiro total (todos os contratos)
- Parecer técnico da Secretaria

#### Relatório de Análise Trimestral / Quadrimestral
- Consolidação automática por período
- Comparativo de faixas de produção (≥85% / 70–84,9% / <70%)
- Evolução de indicadores qualitativos por trimestre
- Projeção de desconto anual baseada na tendência atual

#### Relatório de Auditoria
- Listagem de todos os descontos aplicados por contrato
- Validação de cálculos (log de fórmulas usadas)
- Conformidade com regras contratuais por OSS
- Parecer formal de auditoria (com espaço para assinatura digital)

#### Relatório Financeiro
- Demonstrativo de repasses por contrato (previsto vs realizado)
- Impacto de descontos por bloco/indicador
- Análise de tendências e projeção até o fim do exercício
- Comparativo entre OSS (SCMC vs INDSH)

#### Relatório para Contratada
- Visão exclusiva de seus próprios contratos/unidades
- Alertas de indicadores em risco (pré-desconto)
- Projção de desconto para o mês em curso

**Formatos de Saída:** PDF (padrão oficial) · Excel (análise adicional) · Dashboard Web · CSV (integração)

---

### 2.7 Módulo de Gestão de Usuários

**Perfis de Usuário:**

| **Perfil** | **Permissões** | **Contratos Visíveis** |
|---|---|---|
| Admin | CRUD completo, gestão de usuários, configurações | Todos |
| Gestor_SMS | Entrada/validação de dados, aprovação de repasses, auditoria | Todos |
| Auditora | Validação de descontos, parecer técnico, exportação | Todos |
| Conselheiro_CMS | Visualização de relatórios, dashboards, pautas | Todos |
| Contratada_SCMC | Visualização dos seus dados (HMA, UNACON, UPA Cillos, UPA Dona Rosa) | SCMC apenas |
| Contratada_INDSH | Visualização dos seus dados (UPA Zanaga) | INDSH apenas |
| Central_Regulacao | Visualização de dados de produção/acesso | Todos (read-only produção) |
| Visualizador | Leitura apenas | Restrito por configuração |

**Autorização no produto (implementação):** matriz persistida em `tb_permissoes_perfil` (módulos: dashboard, metas, usuários, permissões, entrada mensal, etc.) com ações `can_view/insert/update/delete` e **escopo** `global` ou `proprio` (filtra dados pela OSS vinculada ao usuário). Carregada após o login; UI e middleware de API utilizam a mesma fonte de verdade. Perfis *contratada_* exigem `oss_id` no cadastro.

### 2.8 Módulo Admin — usuários e matriz de permissões

- Listagem/criação/edição de usuários (com regras: ex. *gestor_sms* não cria privilegiados; contratadas com OSS obrigatório).  
- Tela de **matriz** de permissões por perfil (somente *admin* ou conforme política).  
- Endpoints e frontend alinhados ao plano [auth-permissions](superpowers/plans/2026-04-23-auth-permissions.md).

---

## 3. REQUISITOS FUNCIONAIS ESPECÍFICOS

### 3.1 Multi-OSS e Multi-Contrato

- ✅ Suportar **2+ OSS** com regras de repasse distintas (SCMC e INDSH)
- ✅ Cada OSS tem CNPJ próprio, regras de desconto próprias, relatórios segregados
- ✅ Dashboard comparativo entre OSS (com perfil Admin/SMS apenas)
- ✅ Possibilidade de adicionar novas OSS/contratos sem modificação de código
- ✅ Um contrato pode abranger múltiplas unidades (ex: SCMC 009/2023 abrange 3 unidades)

### 3.2 Múltiplas Periodicidades de Avaliação

O sistema deve suportar avaliações em 4 periodicidades distintas conforme os planos de trabalho:

| Periodicidade | Indicadores | Geração de Análise |
|---|---|---|
| **Mensal** | Maioria dos indicadores qualitativos e todos os quantitativos | Automática no 6º dia útil |
| **Bimestral** | Atuação da CIPA (UPA Zanaga) | Automática a cada 2 meses |
| **Trimestral** | Análise de produção por bloco | Automática: T1=Mar, T2=Jun, T3=Set, T4=Dez |
| **Quadrimestral** | PPRA, PCMSO, POPs, Registros Órgãos Classe (SCMC) | Automática: Q1=Abr, Q2=Ago, Q3=Dez |

### 3.3 Blocos de Produção HMA

- ✅ Suportar 4 blocos com orçamento alocado e % de peso específico
- ✅ Bloco 1 – Urgência/Emergência: meta 12.000/mês
- ✅ Bloco 2 – Internações: múltiplas especialidades + taxas de ocupação
- ✅ Bloco 3 – SADT: interno + externo (rede pública), com notas de compensação (ex: "comp. 20 retirado UNACON")
- ✅ Bloco 4 – Procedimentos Cirúrgicos: CC + pequenas cirurgias, com distinção complexidade
- ✅ Campo "Observação/Compensação" por indicador (para registrar transferências entre unidades)

### 3.4 Indicadores de Implantação (Prazo Único)

O contrato INDSH possui indicadores com prazo único de implantação (não mensais):
- ✅ Indicadores tipo "Implantação" devem ter campo de data-limite e status (Não Iniciado / Em Prazo / Cumprido / Vencido)
- ✅ Após cumprimento inicial, torna-se indicador mensal de "Funcionamento"
- ✅ Alertas automáticos para prazos vencidos ou próximos do vencimento

### 3.5 Nota Explicativa e Justificativa de Desvios

Baseado na Nota Explicativa do 2º TA UPA Dona Rosa:
- ✅ Cada indicador abaixo da meta deve ter campo obrigatório de justificativa
- ✅ Sistema de "Notas Explicativas" formais (com data, responsável, validação)
- ✅ Histórico de notas por indicador (para auditoria e CMS)
- ✅ Suporte a mudanças de metas com registro de motivo (ex: incremento histórico de RX de 1.000 → 1.450 na UPA Dona Rosa)

### 3.6 Orçamento por Rubrica

Baseado nas planilhas de custo (UPA Dona Rosa: 14 grupos; UPA Zanaga: 12 grupos):
- ✅ Módulo de acompanhamento financeiro por rubrica orçamentária
- ✅ Campos: Rubrica | Valor Orçado Mensal | Valor Realizado | Variação
- ✅ Grupos principais: Recursos Humanos, Serviços Médicos, Gastos Adm., Material Hospitalar, Medicamentos, Manutenção, Locação, Utilidades, Serviços Terceiros
- ✅ Subgrupos: linhas detalhadas (ex: "Salários e Ordenados", "FGTS", "13º Salário")
- ✅ Relação com cronograma de desembolso mensal (previsto vs realizado)

---

## 4. REQUISITOS NÃO-FUNCIONAIS

### 4.1 Escalabilidade

- ✅ Sistema deve suportar crescimento de 5 para 50+ contratos
- ✅ Arquitetura preparada para microserviços (V3)
- ✅ Banco de dados particionado por ano para grandes volumes

### 4.2 Flexibilidade de Modelo de Desconto

- ✅ Motor de cálculo de desconto configurável por contrato (sem hardcode)
- ✅ Parâmetros configuráveis: % fixo, % variável, modelo de desconto (flat vs ponderado)
- ✅ Faixas de produção configuráveis por bloco
- ✅ Histórico versionado de regras de cálculo (para auditoria retroativa)

### 4.3 Performance

- ✅ Query < 2 segundos para dashboard
- ✅ Análise trimestral/quadrimestral gerada em < 3 segundos
- ✅ Relatório PDF gerado em < 10 segundos

### 4.4 Segurança

- ✅ HTTPS/TLS para todas as comunicações
- ✅ Autenticação multi-fator (2FA recomendado; campos de token 2FA previstos no modelo de usuário)
- ✅ **RBAC** com segregação por OSS e **permissões por módulo** persistidas (`tb_permissoes_perfil` + `escopo`)
- ✅ Sessão JWT; validade de token tratada no cliente para evitar acesso com credencial expirada
- ✅ Auditoria de todos os acessos e operações
- ✅ Retenção de 5 anos (TCESP)
- ✅ Conformidade LGPD

---

## 5. CASOS DE USO PRINCIPAIS

*(Os 5 casos do PRD v1.0 são mantidos e enriquecidos:)*

### UC-01: Gestor SMS Inserir Valor Realizado Mensalmente (Multi-Unidade)
- Seleciona **contrato** (SCMC 009/2023 ou INDSH 002/2025), depois **unidade**
- Para SCMC: campos adicionais de bloco de produção, compensações SADT
- Para INDSH: indicadores de implantação exibem status especial

### UC-02: Sistema Calcular Desconto com Modelos Diferentes por Contrato
- Para SCMC: aplica flat −1%/indicador Grupo II
- Para INDSH: aplica −peso%/indicador × variável
- Exibe simulação "se cumprir todos os indicadores, repasse será R$ X"

### UC-03: Rodrigo Gerar Pauta CMS Consolidada (Todos os Contratos)
- Pauta única com seções por contrato
- Resumo comparativo SCMC vs INDSH
- Impacto financeiro total do município

### UC-04: Auditora Validar Indicadores com Nota Explicativa
- Indicadores abaixo da meta exibem nota explicativa obrigatória
- Auditora pode aceitar ou rejeitar a justificativa
- Registro do parecer associado ao log de auditoria

### UC-05: OSS Consultar Performance e Simular Desconto Futuro
- SCMC vê todas as suas 4 unidades em painel unificado
- INDSH vê a UPA Zanaga com seus 15 indicadores ponderados
- Simulador: "se eu atingir X%, qual será meu repasse?"

### UC-06: Sistema Gerar Análise Trimestral/Quadrimestral Automática
- No 1º dia útil após o fim de cada trimestre/quadrimestre
- Consolida meses do período, classifica faixas, calcula impacto financeiro acumulado
- Alerta para blocos em faixa de desconto há mais de 2 períodos consecutivos

---

## 6. FLUXO DE NEGÓCIO MENSAL

```
1º–5º DIA ÚTIL (Coleta de Dados)
├─ Gestor SMS preenche valores realizados por unidade/contrato
├─ Sistema valida em tempo real
├─ Dados armazenados em rascunho

6º DIA ÚTIL (Cálculo Automático)
├─ SCMC 009/2023: calcula descontos por bloco (HMA) + qualidade Grupo II
├─ SCMC 066/2024: calcula descontos UPA Dona Rosa
├─ INDSH 002/2025: calcula descontos ponderados UPA Zanaga
├─ Alertas gerados (email: Gestor, Auditora, Rodrigo)

7º–10º DIA ÚTIL (Auditoria)
├─ Auditora valida dados, notas explicativas e descontos
├─ Gera parecer técnico por contrato
├─ Aprova ou rejeita (com comentários registrados)

11º–14º DIA ÚTIL (Aprovação Final)
├─ Gestor SMS aprova repasse de cada contrato
├─ Sistema calcula valor a pagar por OSS
├─ Dados exportados para tesouraria

15º DIA ÚTIL (Repasse)
├─ SCMC recebe pagamento (SCMC 009/2023 + 066/2024)
├─ INDSH recebe pagamento (002/2025)

16º–30º DIA ÚTIL (Relatórios e Análise)
├─ Pauta consolidada CMS gerada
├─ Análise trimestral/quadrimestral (se período)
├─ Relatórios arquivados (TCESP)
```

---

## 7. RESTRIÇÕES E ROADMAP

### V1 (Abr–Dez 2026): Sistema Base
- Coleta de dados manual (formulários web)
- Cálculo automático de descontos (ambos os modelos: SCMC e INDSH)
- Análises trimestrais e quadrimestrais automáticas
- Relatórios PDF/Excel semi-automáticos
- Nenhuma integração externa (dados manuais)

### V2 (2027): Aplicação Web Completa
- Dashboard interativo e responsivo
- Integração com SIASUS/SIH-SUS (CSV/webhook)
- Sincronização de profissionais CNES
- Cache de performance (Redis)

### V3 (2028+): Arquitetura Avançada
- Microserviços e event-driven
- Machine learning (previsão de desempenho)
- Integração total com SUS e tesouraria
- Mobile app nativa

---

## 8. MÉTRICAS DE SUCESSO

| **Métrica** | **Meta** | **Período** |
|---|---|---|
| % dados preenchidos até 5º dia útil | ≥95% | Mensal |
| Tempo médio cálculo desconto (ambos os modelos) | <1 segundo | Mensal |
| Tempo de auditoria por mês (5 unidades) | <4 horas | Mensal |
| Taxa de erro nos cálculos | 0% | Mensal |
| Disponibilidade do sistema | ≥99% | Mensal |
| Redução tempo geração pauta CMS | De 2 dias → <1 hora | — |
| Divergências auditoria manual vs sistema | 0 (zero) | — |

---

## 9. CRONOGRAMA DE DESENVOLVIMENTO

| **Fase** | **Período** | **Deliverables** |
|---|---|---|
| Descoberta & Design | Abr–Mai 2026 | PRD v2.0, Especificação BD, Mockups com 5 unidades |
| Desenvolvimento Backend | Jun–Ago 2026 | APIs, BD, Cálculos (ambos modelos), Auditoria |
| Desenvolvimento Frontend | Jul–Set 2026 | Interfaces, Dashboards, Relatórios multi-contrato |
| Testes & Validação | Set–Out 2026 | UAT com SMS, Auditora, SCMC e INDSH |
| Go-Live | Nov 2026 | Produção, Treinamento, Suporte 24h |

---

## 10. APROVAÇÃO DO PRD

| **Função** | **Nome** | **Assinatura** | **Data** |
|---|---|---|---|
| Diretor de Planejamento | Rodrigo Alexander Diaz Leon | ________________ | ___/___/___ |
| Secretário de Saúde | ________________ | ________________ | ___/___/___ |
| Presidente CMS | ________________ | ________________ | ___/___/___ |
| Coordenador de TI | ________________ | ________________ | ___/___/___ |

---

## APÊNDICE A1: DOCUMENTOS TÉCNICOS RECENTES (superpowers)

| Documento | Conteúdo |
|---|---|
| [2026-04-23-metas-decomposicao-pesos-design.md](superpowers/specs/2026-04-23-metas-decomposicao-pesos-design.md) | Decomposição de metas, pesos, F ponderado, cap sub-meta |
| [2026-04-23-metas-decomposicao-pesos.md](superpowers/plans/2026-04-23-metas-decomposicao-pesos.md) | Plano de implementação (migrations, serviços, testes) |
| [2026-04-23-auth-permissions.md](superpowers/plans/2026-04-23-auth-permissions.md) | Permissões por perfil, rotas, seeds |

---

## APÊNDICE A: GLOSSÁRIO

| **Termo** | **Definição** |
|---|---|
| **OSS** | Organização Social de Saúde — entidade privada sem fins lucrativos que gerencia unidade pública de saúde via Contrato de Gestão |
| **Bloco de Produção** | Agrupamento de atividades assistenciais (Urgência, Internações, SADT, Cirurgias) para fins de medição e cálculo de desconto |
| **Desconto Flat** | Modelo SCMC: −1% por indicador Grupo II não cumprido (máximo 10%) |
| **Desconto Ponderado** | Modelo INDSH: −peso% por indicador não cumprido (máximo 100% do variável) |
| **Indicador de Implantação** | Indicador com prazo único (ex: 60 dias do contrato) em vez de periodicidade recorrente |
| **Análise Trimestral** | Consolidação de T1 (Jan–Mar), T2 (Abr–Jun), T3 (Jul–Set), T4 (Out–Dez) |
| **Análise Quadrimestral** | Consolidação de Q1 (Jan–Abr), Q2 (Mai–Ago), Q3 (Set–Dez) |
| **Nota Explicativa** | Justificativa formal para desvio de meta, com data, responsável e aprovação |
| **Repasse** | Transferência de recursos financeiros da SMS para OSS (90% fixo + 10% variável) |
| **Soft-Delete** | Exclusão lógica — dados marcados como deletados, mas retidos para auditoria |
| **Meta agregada / componente** | Papel da linha em `tb_metas`: agregada = referência do pacote; componente = sub-meta com peso para o índice F |
| **Escopo (permissão)** | `proprio` = dados filtrados pela OSS do usuário; `global` = sem filtro de OSS nesse módulo |
| **SCMC** | Santa Casa de Misericórdia de Chavantes / Grupo Chavantes |
| **INDSH** | Instituto Nacional de Desenvolvimento Social e Humano |

---

## APÊNDICE B: MAPEAMENTO PLANOS → SISTEMA

| **Plano de Trabalho** | **Planilha Gerada** | **Contratos/Regras** |
|---|---|---|
| 6º TA SCMC – Plano HMA/UNACON/UPA Cillos | Indicadores_SCMC_SMS_Americana_v2.xlsx | SCMC 009/2023; blocos HMA; Grupos I e II |
| 2º TA UPA Dona Rosa | UPA_DRosa_2026.xlsx | SCMC 066/2024; modelo flat; RX 1.450/Lab 3.000 |
| Chamamento PMA 002/2025 – PA Zanaga | PA_Zanaga.xlsx | INDSH; modelo ponderado (15 indicadores/100%); Proc. Enf. 20.000 |

---

## APÊNDICE C: REFERÊNCIAS NORMATIVAS

- Lei 8.080/90 – Lei Orgânica da Saúde
- Lei 8.142/90 – Controle Social do SUS
- Lei 13.709/2018 – LGPD
- Resolução 183 MS/GM – Parâmetros de Desempenho para Hospitais
- Portaria GM/MS nº 1.429/2023 – UNACON
- Portaria GM 10/2017 – UPAs 24h (estrutura e modelo assistencial)
- Portaria 2.616/98 MS – Prevenção e Controle de Infecção Hospitalar
- TCESP Instrução 01/2020 – Repasses a Terceiro Setor
- RDC 50/2002 – Projetos Físicos de Estabelecimentos Assistenciais
- NR 32/2005 – Segurança no Trabalho em Saúde

---

**Documento Atualizado:** 23 de abril de 2026 | **Versão:** 2.1  
**Status:** Inclui requisitos de decomposição de metas e matriz de permissões alinhados às entregas de abril/2026; contratos de referência inalterados (SCMC 009/2023, 066/2024, INDSH 002/2025)
