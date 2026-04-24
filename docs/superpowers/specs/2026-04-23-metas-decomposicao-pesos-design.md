# Metas — decomposição por indicador, pesos e cumprimento ponderado

**Data:** 2026-04-23  
**Status:** Approved  

**Plano de implementação:** [docs/superpowers/plans/2026-04-23-metas-decomposicao-pesos.md](../plans/2026-04-23-metas-decomposicao-pesos.md)

---

## 1. Objetivos

1. Garantir que toda **meta** continue **sempre** ligada a um **indicador** (já é regra no modelo atual; manter e reforçar na UX/API).
2. Permitir **várias metas (linhas) para o mesmo indicador** na forma de **decomposição**: meta **pai (agregada)** + N metas **filhas (componentes)**, com nomes/linhas (ex.: cirurgias ortopédicas, cirurgias gerais, consultas).
3. O **total planejado** no eixo de **volume** (produção) segue a regra: **soma dos valores** das filhas = referência do **agregado** (meta pai), alinhada ao **indicador** como “padrão” numérico agregado.
4. O **resultado** no eixo de **“objetivo atingido”** não reduz tudo a `soma(realizados) / soma(metas)`: cada filha tem **peso** \(w_i > 0\); o **cumprimento global** é uma **média ponderada** dos fatores de linha, para que uma linha de alto peso puxe o índice para baixo ainda que outra (ex.: consultas) tenha muito volume.
5. **Entrada de realizado (B):** o lançamento é **por meta folha** (sub-meta **ou** meta avulsa sem decomposição). O agregado do indicador soma `valor_realizado` das folhas (mesmo mês) para **produção total**; o **indicador de cumprimento global ponderado** usa a fórmula da seção 5.
6. **Indicadores qualitativos:** neste desenho, **não** há decomposição com soma e peso como no quantitativo; metas qualitativas permanecem **modelo de linha única** (sem árvore), até decisão explícita futura.

---

## 2. Contexto do sistema atual (relevante)

- `tb_metas.indicador_id` é **NOT NULL** (FK a `tb_indicadores`); a unidade entra **via** `tb_indicadores.unidade_id`.
- `MetaService` incrementa `versao` por `indicador_id` a cada criação; o desenho de “pacote” pai+filhas deve alinhar versão e vigência (ver seção 4).
- `tb_acompanhamento_mensal` referencia `indicador_id` e `meta_id` e contém `valor_realizado` por linha de acompanhamento.

---

## 3. Modelo de dados

### 3.1 Colunas novas em `tb_metas`

| Campo            | Tipo        | Nulo  | Regra |
|-----------------|-------------|-------|--------|
| `parent_meta_id`| CHAR(36) FK | Sim   | `NULL` = raiz: meta **agregada** (pai) **ou** meta **avulsa** sem decomposição. |
| `papel`         | ENUM        | Não   | Valores: `agregada` \| `componente` \| `avulsa` (semântica abaixo). |
| `peso`          | DECIMAL(10,4) | Sim | Obrigatório quando `papel = componente` (**> 0**). `NULL` para `agregada` e `avulsa`. |

- **FK `parent_meta_id`:** referencia `tb_metas(meta_id)`; **ON UPDATE CASCADE**, **ON DELETE RESTRICT** (ou política alinhada a negócio: não excluir pai com filhas sem tratamento).
- **Índice** em `parent_meta_id` para listagens em árvore.
- **Constraint lógica (aplicada no serviço e, se possível, trigger/check):**  
  - `papel = agregada` ⇒ `parent_meta_id IS NULL` e, se existem filhas, o indicador é o **mesmo** em todas.  
  - `papel = componente` ⇒ `parent_meta_id` **NOT NULL** e `peso` **NOT NULL** e `peso > 0`.  
  - `papel = avulsa` ⇒ `parent_meta_id IS NULL`, sem `peso`.

### 3.2 Semântica

- **Avulsa:** comportamento idêntico ao meta atual: uma meta por “versão lógica” sem filhos.
- **Agregada:** contém **vigência/versão** do pacote; valores numéricos de meta na agregada podem ser **iguais à soma** das filhas (recomendado: **mantidos consistentes** por validação no write, não por triggers obrigatórios na v1, para simplificar).
- **Componente:** linha de decomposição; **título** de linha: usar `observacoes` ou novo campo `rotulo` (opcional v2); v1 pode usar `observacoes` ou campo curto se já existir no payload.

### 3.3 Indicadores qualitativos

- Criação de meta com `papel` ≠ `avulsa` **rejeitada** se o indicador for `qualitativo` (validação no serviço).

---

## 4. Regras de validação (backend)

- **Soma (volume):** para um mesmo **pai** e mesma janela de meta relevante,  
  `sum(filha.meta_mensal)` deve coincidir com `pai.meta_mensal` (e análogo para anual) dentro de **tolerância de arredondamento** fixa (ex. ±0,0001) ou 4 casas decimais alinhadas ao `DECIMAL(15,4)`.
- **Pesos:** em componentes, `peso > 0`. Não exigir que os pesos somem 1 ou 100; a normalização ocorre na fórmula (seção 5).
- **Indicador:** todas as filhas e o pai compartilham o **mesmo** `indicador_id`.
- **Acompanhamento:** apenas **metas folha** ( `avulsa` **ou** `componente` ) recebem linhas de acompanhamento com `valor_realizado`. Meta **agregada** **não** recebe `valor_realizado` próprio na v1 (derivado: soma das folhas).

---

## 5. Fator de cumprimento por linha \(f_i\) — decisão (2) penalidade suave

**Princípio:** abaixo de `meta_minima`, o fator **não** zera; continua **crescendo** com o `realizado`, mas com **teto (cap)** de contribuição para o agregado ponderado (ex. **0,5**), para refletir “atendimento parcial do objetivo” se o mínimo não foi atingido.

### 5.1 Construção (quantitativo, `meta_tipo` = `maior_igual`)

1. `r_i = valor_realizado_i / meta_vigente_mensal_i` (se meta mensal nula, definir regra: usar snapshot do acomp ou bloquear; v1: usar campos do acomp `meta_vigente_mensal` na linha).
2. `f_i_raw = min(1, r_i)` (linear até 100% da meta; faixas adicionais podem reutilizar regras já existentes de status).
3. **Se** `realizado_i < meta_minima_i` (quando `meta_minima` existir) **e** a linha estiver nessa condição, então:  
   `f_i = min(f_i_raw, 0,5)`  
   onde **0,5** é o **cap padrão** configurável por constante de produto (ex.: `META_FATOR_CAP_SUBMIN` no backend), **não** por coluna no banco na v1.
4. **Se** `meta_minima` for nula, `f_i = f_i_raw` (sem corte por mínimo).
5. **Indicador `menor_igual` e outros `meta_tipo`:** fórmula análoga com inversão/mesa definida no plano de implementação (não detalhada neste spec; deve espelhar a semântica já usada no domínio).

**Observação:** `meta_parcial` e faixas de desconto existentes no `acompanhamento_mensal` podem continuar a alimentar **status** e **UI**; o \(f_i\) acima é **somente** para o **indice global ponderado** e relatórios que expliquem “nota/penalidade”.

### 5.2 Cumprimento global do grupo (mês m)

\[
F = \frac{\sum_i w_i \cdot f_i}{\sum_i w_i}
\]

para todas as filhas `componente` do **mesmo** pai com meta vigente naquele mês. **Exibição sugerida:** percentual `F * 100` com label “Cumprimento global ponderado”.

### 5.3 Volume agregado (eixo distinto)

- `realizado_indicador_mes = sum(valor_realizado_i)` (folhas do grupo).  
- `meta_indicador_mes` de referência = `pai.meta_mensal` (ou `sum(filhas)`) coerente com a validação 4.1.  
- **Não** confundir `realizado` somado com **F**; ambos na UI ao lado do outro.

---

## 6. API e UI (visão)

- **Listar/GET meta:** retornar hierarquia (pai + `children` ou lista plana com `parentMetaId` + `papel` + `peso`).
- **Criar/atualizar:** transação para “pacote” agregada + N componentes; validar soma e pesos.
- **Metas (página /metas):** exibir grupo recolhível; colunas: linha, meta, peso, % avanço da linha, **F** global.
- **Entrada mensal:** tabela por **folha**; totalizador = soma; opcional card com **F**.

---

## 7. Fora de escopo (v1)

- Peso e cap **por indicador** diferentes do default (apenas constante global).
- Múltiplos níveis (árvore > 1 profundidade de pai → filha).
- Qualitativo decomposto.

---

## 8. Testes a cobrir (aceite)

- Criar avulsa: inalterado.
- Criar pai + 2 filhas: soma bate; pesos obrigatórios; qualitativo bloqueia.
- Acomp: 2 folhas com realizado; `F` bate com fórmula; caso abaixo de mín numa linha com cap 0,5 puxa `F` para baixo vs caso sem mín.
- Soma de `valor_realizado` = agregado de volume.

---

## 9. Riscos

- Versão: hoje a versão sobe a cada POST de meta no indicador; pacotes agregada+filhas devem compartilhar **uma** versão lógica (ajuste no `MetaService` no plano).
- Relatórios legados que assumem **uma** `meta` por `indicador`/`mês` precisam de migração de leitura (priorizar **folha**).

---

## Referência de cumprimento (decisão do produto)

| Tema | Decisão |
|------|---------|
| Onde entra o realizado | **B** — por sub-meta (folha); agregado soma. |
| Mínima não atingida | **(2)** — \(f_i\) continua crescendo com o realizado, com **teto (ex. 0,5)** enquanto abaixo do mínimo. |
| Peso | Por **meta filha**; `F` = média ponderada dos \(f_i\). |
| Qualitativo | **Sem** decomposição neste spec. |
