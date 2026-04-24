# Manual de operação — domínio contratual e de desempenho

**Sistema:** SaúdeControl OSS (acompanhamento de contratos de gestão em saúde pública)  
**Município de referência:** Americana/SP  
**Versão do documento:** 1.1  
**Data:** 23 de abril de 2026  
**Público:** gestores, contratadas, equipe de TI e elaboradores de manuais de usuário final  

**Relaciona-se com:** `PRD_v2.md`, `ARQUITETURA_v2.md`, `banco_v2.md`, `erd_v2.md` e a spec [metas decomposição e pesos](superpowers/specs/2026-04-23-metas-decomposicao-pesos-design.md).

---

## 1. Objetivo deste documento

Explicar, em linguagem operacional, **o que** cada entidade do domínio representa na gestão de contratos de saúde, **como** se relacionam e **de que forma** o sistema trata cálculos de cumprimento de meta e (quando aplicável) impactos financeiros.  

Este texto é a **base conceitual** para o manual de operação: telas, botões e fluxos devem reutilizar a mesma terminologia (OSS, contrato, unidade, indicador, meta, meta agregada, componente, folha, escopo, etc.).

---

## 2. Visão geral: cadeia de encadeamento

A hierarquia lógica **obrigatória** para aferição de desempenho é:

```text
Organização Social (OSS)
    └── um ou mais Contratos de gestão
            └── uma ou mais Unidades de saúde
                    └── Indicadores (vinculados à unidade e, se existir, a um bloco de produção)
                            └── Metas (vigentes por período, com possível decomposição)
                                    └── Acompanhamento mensal (valor realizado) na meta **folha**
```

- **Não** existe meta sem indicador: toda meta referencia exatamente um `indicador_id` (tabela `tb_metas`).  
- A **unidade** entra no modelo **pela tabela de indicadores** (`tb_indicadores.unidade_id`), não pela meta diretamente.  
- **Usuários** de perfis “contratada” estão vinculados a uma **OSS** (`oss_id`); o sistema aplica **escopo próprio** para limitar a visão a contratos e dados daquela organização, conforme a matriz de permissões.

---

## 3. Organização social (OSS)

### 3.1 Objetivo

Representar a **pessoa jurídica** (ou entidade homologada) **contratada** pela administração pública para executar a gestão de unidades. É o nível agregador da **relação contratual** e, no sistema, do **vínculo de acesso** de usuários da contratada.

Tabela: `tb_oss` · chave: `oss_id`

### 3.2 Campos e uso típico

| Conceito        | Uso operacional |
|-----------------|-----------------|
| Nome, CNPJ      | Identificação oficial da OSS |
| Tipo de entidade| Classificação (fundação, associação, etc.) |
| Sede            | Endereço social e administrativo |
| `ativa`         | Indica se a OSS permanece no cadastro para operação e relatórios |

### 3.3 Relacionamentos

- **1 OSS → N contratos** (`tb_contratos.oss_id`).  
- **1 OSS → N usuários** com perfis `contratada_scmc` / `contratada_indsh` (e variantes) quando o desenho restringe acesso por OSS.  

### 3.4 Metodologia (regras de negócio)

- Uma **mesma** OSS pode manter **vários** contratos simultâneos (ex.: SCMC com hospital + UPAs e outro contrato somente com uma UPA).  
- A segregação de **dados e permissões** “só o que é da minha OSS” vem do **perfil** + **escopo** na matriz de permissões (`proprio` / `global`), não de regras duplicadas na tabela da OSS.

---

## 4. Contrato de gestão

### 4.1 Objetivo

Formalizar a **vigência**, o **objeto** e os **valores** do pacto entre o poder público (SMS) e a OSS, incluindo as regras de **repartição fixa/variável** e o **modelo de desconto** aplicável aos **indicadores de qualidade** (eixo que afeta a parcela variável conforme o plano de trabalho).

Tabela: `tb_contratos` · chave: `contrato_id`

### 4.2 Campos relevantes para cálculo e acompanhamento

| Campo / conceito | Significado operacional |
|------------------|-------------------------|
| `oss_id`         | A qual organização o contrato pertence |
| `numero`, `tipo` | Identificação e natureza (contrato de gestão, chamamento, etc.) |
| `data_inicio`, `data_fim` | Janela de vigência; alertas e relatórios usam estes limites |
| `valor_mensal_base` | Valor de referência mensal (repasse base) do pacto |
| `perc_fixo` / `perc_variavel` | Normalmente 90% / 10%: parte condicionada a metas (variável) depende do modelo de desconto |
| `modelo_desconto_qual` | `flat` (ex.: desconto por indicador de qualidade com percentual fixo no contrato SCMC) ou `ponderado` (pesos no indicador no contrato INDSH) — **direciona a lógica de cálculo de desconto na parcela de qualidade** |
| `status`         | Se o contrato está ativo, encerrado, suspenso ou rompido |

**Termos aditivos** e **histórico de versão** do contrato (quando implementados de ponta a ponta) permitem rastrear mudança de valor e vigência sem apagar o passado.

### 4.3 Relacionamentos

- **N contratos → 1 OSS**.  
- **1 contrato → N unidades** (`tb_unidades.contrato_id`).  
- **1 contrato → N rubricas** orçamentárias, **N repasses** mensais calculados, etc., conforme módulo financeiro.

### 4.4 Metodologia (dois modelos de desconto na qualidade)

- **Flat:** perda de impacto em etapas fixas por indicador não cumprido (conforme plano: ex. −1% do valor de referência por indicador, até teto de indicadores).  
- **Ponderado:** o **peso** do indicador (`peso_perc` em `tb_indicadores`) entra no cálculo: indicador não cumprido implica perda de **sua** fatia do **montante variável** proporcional.  

*O motor detalhado de repasse e tabelas de desconto por bloco/unidade consta do PRD e documentos técnicos; neste manual basta a distinção: o **contrato** “escolhe” o algoritmo de qualidade.*

---

## 5. Unidades de saúde

### 5.1 Objetivo

Localizar a **produção assistencial** no território: hospital, UPA, UNACON, etc. Toda ficha de desempenho e meta é **rastreável a uma unidade** via indicador, exceto desenhos “transversais” se previstos (indicador sem unidade, conforme regra de negócio).

Tabela: `tb_unidades` · chave: `unidade_id`

### 5.2 Campos típicos

- Identificação: nome, sigla, **CNES**, endereço, porte, capacidade, especialidades.  
- **Vínculo único a um contrato** (`contrato_id`): a unidade “nasce” na esteira daquele contrato.  
- Valores de **custeio** atribuídos à unidade no contrato (quando existir no cadastro) auxiliam relatórios e simulações.

### 5.3 Blocos de produção (quando houver)

Em hospitais com **blocos** (urgência, internação, SADT, etc.), tabela `tb_blocos_producao` segmenta o orçamento e as metas de **produção** por bloco. O indicador pode referenciar `bloco_id` para aproximar a medição do **lugar** da produção no estabelecimento.

### 5.4 Relacionamentos

- **N unidades → 1 contrato**  
- **1 unidade → N blocos** (opcional)  
- **1 unidade → N indicadores** (via `unidade_id` em `tb_indicadores`)

---

## 6. Indicadores

### 6.1 Objetivo

Definir **o quê** medir: o critério de desempenho associado a uma linha de cuidado ou gestão. Ex.: “atendimentos de urgência/mês”, “taxa de ocupação”, “funcionamento do SAU em 100%”.

Tabela: `tb_indicadores` · chave: `indicador_id`

### 6.2 Classificação usada no sistema

| Atributo        | Valores (exemplos) | Papel no manual |
|-----------------|--------------------|-----------------|
| `tipo`          | `quantitativo` / `qualitativo` | Determina se a medida é numérica (volume, taxa) ou aderência/norma |
| `grupo`         | ex.: `auditoria_operacional`, `qualidade_atencao`, `transversal`, `rh` | Organiza painéis e, no desconto, o **conjunto** de indicadores (ex.: “qualidade”) |
| `periodicidade` | `mensal`, `bimestral`, `trimestral`, `quadrimestral`, `unico` | Com que frequência a meta deve ser verificada |
| `meta_tipo`     | `maior_igual`, `menor_igual`, etc. | Define se “melhor” é crescer ou reduzir o valor em relação à meta (impacta cálculo de status e fatores) |
| `peso_perc`     | percentual 0–100 | No contrato **ponderado**, importância relativa do indicador no total de pesos (100% somando os indicadores do escopo) |
| `tipo_implantacao` / `prazo_dias_impl` | metas de prazo único (ex. INDSH) | Diferenciam mês a mês de “implantar até data X” |

### 6.3 Relacionamentos

- **1 indicador → 1 unidade** (pode ser nulo se o desenho permitir indicador “transversal”).  
- **0 ou 1 bloco** por indicador.  
- **1 indicador → N metas** ao longo do tempo (novas versões, vigências).  
- **1 indicador → N acompanhamentos** mensais (cada um amarrado a uma **meta** e um **mês** — ver secção 7).

### 6.4 Metodologia (cumprimento no indicador)

- Para **qualidade** e **produção**, o plano de trabalho e o contrato definem as **faixas** (ex.: parcial, não cumprido) a partir do **percentual** ou regra ad hoc (implantação concluída ou não).  
- O desconto na **variável** usa o **modelo do contrato** (flat x ponderado) e os **pesos** onde couber.

---

## 7. Metas e decomposição

### 7.1 Objetivo

Registrar **valores alvo** (e faixas como mínima/parcial, quando houver) **vigentes** num período, para o **indicador** escolhido. Toda evolução contratual relevante (novo aditivo, reajuste de meta) produz **nova versão lógica** de meta sem apagar a histórico.

Tabela: `tb_metas` · chave: `meta_id`

### 7.2 Campos centrais

- `indicador_id` — **obrigatório**; amarra a meta ao indicador (e, por ele, à unidade).  
- `versao` — incrementa por lógica de negócio ao publicar um novo “pacote” de metas para o mesmo indicador.  
- `vigencia_inicio`, `vigencia_fim` — janela em que aquela configuração vale.  
- `meta_mensal`, `meta_anual`, `meta_valor_qualit` — eixos de meta conforme tipo de indicador.  
- `meta_minima`, `meta_parcial` — usados para **faixas** e para o **fator** da linha (ver 7.5).  
- `papel` — `avulsa` | `agregada` | `componente` (decomposição; ver abaixo).  
- `parent_meta_id` — ponte para a **meta agregada** quando `papel = componente`.  
- `peso` — **obrigatório** e &gt; 0 para `componente`; alimenta a **média ponderada** do cumprimento agregado.

### 7.3 Três papeis de meta

| Papel         | Papel no manual de operação |
|---------------|-------------------------------|
| **avulsa**    | Uma meta por linha, sem filhos. Compatível com o fluxo clássico (um valor de referência por indicador e vigência). |
| **agregada**  | “Total de referência” de um **pacote** (ex.: soma de linhas de produção). Não recebe, na regra v1, **valor realizado** direto; o realizado vem **só nas folhas**. |
| **componente** | Sub-meta (linha) com `peso` e volume que soma ao agregado; recebe acompanhamento e entra no **F** global. |

**Indicadores qualitativos** não usam, neste desenho, decomposição em pacote (a API/validador recusa criação de pacote).

### 7.4 Relacionamentos

- **N metas → 1 indicador**.  
- **0 ou 1 pai** — auto-relacionamento em `tb_metas` (`parent_meta_id`).  
- **Acompanhamento:** cada linha em `tb_acompanhamento_mensal` aponta para **uma** `meta_id` (a **folha**), com **unicidade** `(meta_id, mes_referencia)`.

### 7.5 Metodologia de cálculo — cumprimento global ponderado (F)

Usado quando existe **decomposição** com componentes. Ideia: não substituir o desempenho por `soma(realizados) / soma(metas)`.

1. **Por linha (componente ou avulsa em modo quantitativo `maior_igual` típico):**  
   - Calcular a razão \(r_i = \text{realizado}_i / \text{meta referência}_i\) (com snapshot da meta no acompanhamento).  
   - Fator bruto: \(f_{i,\text{raw}} = \min(1, r_i)\).  
2. **Abaixo da meta mínima (quando houver `meta_minima`):** aplica-se um **teto (cap)** ao fator, para “penalidade suave” (constante de produto, ex. 0,5) — o operador vê o **F** refletir esforço parcial sem anular tudo.  
3. **Global:**  
   \[
   F = \frac{\sum_i w_i \cdot f_i}{\sum_i w_i}
   \]  
   onde \(w_i\) é o `peso` do componente (não exige somar 100; a fórmula **normaliza** pelos pesos).  

**Meta agregada** pode exibir, para conferência, a **soma** dos realizados das folhas no mesmo mês, alinhada ao eixo de volume do indicador.

---

## 8. Acompanhamento mensal (ligação com metas e indicador)

- **Uma** linha por **meta folha** e **mês** (primeiro dia do mês em `mes_referencia`).  
- Guarda **snapshot** da meta no momento do lançamento (`meta_vigente_mensal` / qualitativos), `valor_realizado` e desdobramentos de **status** e **faixa** conforme regras já usadas (parcial, cumprido, etc.).  
- A **não** utilização de meta agregada para `valor_realizado` evita **dupla contagem** e mantém a rastreabilidade por **linha operacional** (cirurgias vs consultas, etc.).

---

## 9. Fluxo de tela

Este capítulo descreve **como o operador percorre o produto** (rotas e agrupamento do menu) em alinhamento com a cadeia OSS → contrato → unidade → indicador → meta. Nomes de caminhos refletem o frontend (React + React Router) na data deste documento; pequenos ajustes de URL podem ocorrer sem alterar a lógica.

### 9.1 Entrada no sistema e navegação geral

1. **Login** (`/login`) — o usuário autentica-se com e-mail e senha. O backend devolve tokens JWT; o cliente carrega a **matriz de permissões** do perfil (`can_view/insert/update/delete` por módulo e `escopo` global ou próprio).  
2. **Redirecionamento pós-login** — se o usuário acessa uma rota inexistente ou a raiz, o app envia para o **primeiro módulo** que o perfil **pode visualizar** (função *first accessible path*), e não necessariamente sempre ao *dashboard*.  
3. **Layout autenticado** — após o login, as telas principais usam **menu lateral** (`SidebarMenu`) + **cabeçalho** e área de conteúdo. Itens de menu **só aparecem** se o módulo tiver `can_view`.  
4. **Proteção por módulo** — cada rota de negócio passa por `ProtectedRoute` com um `modulo` (ex.: `oss`, `contratos`, `metas`). Se o perfil não tiver visualização daquele módulo, o fluxo de tela nega acesso de forma coerente com a política do produto.

### 9.2 Ordem sugerida de cadastro (setup do domínio)

Para que indicadores e metas existam de forma consistente, o percurso natural no sistema segue a **cadeia de dependência**:

| Passo | Tela / rota (padrão) | Módulo de permissão | O que o operador faz |
|-------|----------------------|----------------------|------------------------|
| 1 | OSS — `/oss/*` | `oss` | Inclui ou consulta a **organização social** (CNPJ, sede, status). |
| 2 | Contratos — `/contratos/*` | `contratos` | Vincula o **contrato** à OSS, vigência, valores e **modelo de desconto** (flat/ponderado) quando cadastrado na tela. |
| 3 | Unidades — `/unidades/*` | `unidades` | Cadastra a **unidade** sob o contrato (CNES, nome, endereço, etc.). |
| 4 | Indicadores — `/indicadores` → escolhe unidade → `/indicadores/:unidadeId/*` | `indicadores` | No *hub* lista-se unidades; na lista por unidade, cadastra-se o **indicador** (tipo, periodicidade, peso, vínculo a bloco se aplicável). |
| 5 | Metas — `/metas` → escolhe indicador → `/metas/:indicadorId/*` | `metas` | No *hub* acessa-se a árvore por indicador; na lista, cria-se **meta avulsa** ou **pacote** (agregada + componentes) para indicadores **quantitativos** — conforme validações da API. |

*Perfis com **escopo próprio** (contratada) enxergam, em cada módulo, apenas dados da **OSS** do usuário — o fluxo de telas é o mesmo, com listas filtradas no backend.*

### 9.3 Entrada de dados de desempenho (mês a mês)

- **Módulo** `entrada_mensal` — o operador acessa **Entrada mensal** (`/entrada-mensal`), escolhe contexto (visão geral) e, ao detalhar, abre a lista por unidade: `/entrada-mensal/:unidadeId`.  
- Aqui o foco operacional é **preencher realizado** em linhas de acompanhamento vinculadas a **metas folha** (conforme secção 7 e 8), não à meta agregada, quando houver decomposição.  
- **Aprovação** — rota `/aprovacao` (módulo `aprovacao`), para perfis com permissão, compõe o fluxo *preenchimento → conferência / aprovação* do ciclo mensal (detalhe de regras de status no PRD e telas de aprovação).

### 9.4 Demais módulos do menu

- **Dashboard** (`/dashboard`, `dashboard`) — visão sintética acordada com o produto.  
- **Relatórios** (`/relatorios`, `relatorios`) — leitura e exportações para CMS/conselho, conforme implementação.  
- **Perfil da OSS** (`/perfil-oss`, `perfil_oss`) — informações resumidas da organização vinculada (útil a contratadas com escopo próprio).  
- **Administração** — `usuarios`: `/admin/usuarios`; `permissoes`: `/admin/permissoes` (matriz módulo × ações por perfil). Acessíveis só a perfis com `can_view` nesses módulos (tipicamente `admin` ou conforme *seed* e política).

### 9.5 Diagrama resumido (navegação lógica)

```text
[Login] → (primeiro módulo permitido)
     │
     ├─ Menu: OSS, Contratos, Unidades, Indicadores, Metas, Entrada mensal, …
     │
     ├─ Indicadores: /indicadores → /indicadores/:unidadeId
     ├─ Metas:       /metas       → /metas/:indicadorId
     └─ Entrada:     /entrada-mensal → /entrada-mensal/:unidadeId
```

O manual de operação *por perfil* pode restringir ainda mais “quem usa qual passo com que frequência” (ex.: contratada prioriza *Entrada mensal* e *Perfil OSS*; gestor prioriza *Contratos* e *Metas*), sem mudar a ordem lógica de **cadastro** acima.

---

## 10. Síntese: quem responde a quê (para o manual de telas)

| Pergunta do operador | Onde está a resposta no modelo |
|----------------------|----------------------------------|
| “De quem é este contrato?” | `contrato` → `oss` |
| “Em qual UPA/ hospital caiu?” | `indicador` → `unidade` |
| “O volume é de qual bloco?” | `indicador` → `bloco` (se preenchido) |
| “Qual o alvo do mês?” | `meta` vigente (e **filhas** se pacote) |
| “O que digitamos de realizado?” | **Apenas nas metas folha** (avulsa ou componente) |
| “O contratado vê tudo do município?” | Não, se `escopo` = `proprio` e o usuário tem `oss_id` |

---

## 11. Referências internas

| Documento | Conteúdo |
|-----------|-----------|
| [PRD_v2.md](PRD_v2.md) | Requisitos, perfis, regras de repasse, matrizes de indicadores reais |
| [banco_v2.md](banco_v2.md) / [erd_v2.md](erd_v2.md) | Esquema e ERD |
| [2026-04-23-metas-decomposicao-pesos-design.md](superpowers/specs/2026-04-23-metas-decomposicao-pesos-design.md) | Especificação formal de metas decompostas e F |

---

**Documento** preparado para servir de **base** ao manual de operação. Versões futuras podem acrescentar **capturas de tela** e detalhar, por tela, botões (salvar, validar, submeter) e estados (rascunho, enviado, aprovado) sem alterar a hierarquia e o fluxo descritos acima.
