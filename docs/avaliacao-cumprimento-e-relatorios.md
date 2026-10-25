# Avaliação de Cumprimento e Relatórios (CMS / Dashboard)

> Como o sistema avalia cumprimento de metas e como os módulos de Relatório CMS e
> Dashboard agregam os dados. Atualizado em out/2026.

## 1. Avaliação de cumprimento (direção + faixas)

Cada **meta** (`tb_metas`) define como é avaliada:

- **Direção** — `meta_tipo`:
  - `maior_igual` — "quanto maior, melhor" (padrão).
  - `menor_igual` — "quanto menor, melhor" (ex.: taxa de infecção, tempo de espera).
- **Faixas** — `meta_minima` e `meta_parcial`, **percentuais (0–100) da base**
  (base = `meta_mensal` para produção, `meta_valor_qualit` para qualidade).
  Editáveis no módulo **Metas** (`MetasFormModal`). Em branco ⇒ usa os padrões.

### Regra (fonte única)

`src/helper/avaliacaoCumprimento.js`:

```
pct = realizado / base * 100
faixasEfetivas(meta) → { tipo, cumprido, parcial }   // em %
nivelCumprimento(pct, faixas) → 'cumprido' | 'parcial' | 'nao_cumprido' | 'aguardando'
```

| Direção | cumprido | parcial | não cumprido | Padrão (cumprido/parcial) |
|---|---|---|---|---|
| `maior_igual` | `pct ≥ cumprido` | `pct ≥ parcial` | resto | `meta_parcial`?100 / `meta_minima`?85 |
| `menor_igual` | `pct ≤ cumprido` | `pct ≤ parcial` | resto | `meta_minima`?100 / `meta_parcial`?115 |

> Exemplo: "≥80% cumpriu, 75–80% parcial, <75% não" → `maior_igual`,
> `meta_parcial = 80`, `meta_minima = 75`.

### Onde é aplicada

- `AcompanhamentoService.calcularStatusCumprimento(pct, meta)` — grava `status_cumprimento`
  em `criarOuAtualizar`.
- `RelatorioCmsService.linhaIndicador` — status no CMS, Dashboard e na taxa da série.
- Entrada Mensal (`AcompanhamentosService`) mantém seu enum de UI
  (`atingido/parcial/nao_atingido/pendente`) mas **grava o conjunto de exibição**
  (`cumprido/...`) na coluna compartilhada.
- `calcularFaixaProducao` (faixa para desconto de bloco) permanece "maior-melhor"
  de propósito — é cálculo financeiro separado.

### Avaliação viva

Ao editar uma meta, `MetaService.atualizar` chama
`AcompanhamentoService.recomputarStatusDaMeta(metaId)`, que **reavalia os meses já
lançados** com a config atual e re-snapshota `meta_tipo_snap`/`meta_minima`/`meta_parcial`
(absolutos). Assim Aprovação/CMS/Dashboard refletem a nova regra sem relançamento.

## 2. Relatório CMS

`GET /api/relatorios/cms` (permissão `relatorios.view`):

| Param | Valores |
|---|---|
| `mes` | `YYYY-MM-01` (obrigatório) |
| `periodo` | `mes` · `acumulado` · `trimestre` · `quadrimestre` · `ano` |
| `escopo` | `todos` · `contrato` (+`contrato_id`) · `unidade` (+`unidade_id`) |

Janela (`src/helper/periodoRelatorio.js`, **móvel**):

| período | janela (mês ref = R) | meta do período |
|---|---|---|
| mes | só R | base × 1 |
| acumulado | Jan(ano R) → R | base × nº meses |
| trimestre | R-2 … R | base × 3 |
| quadrimestre | R-3 … R | base × 4 |
| ano | Jan → Dez | **não proporcional** (meta anual cheia) |

Agrega on-the-fly de `tb_acompanhamento_mensal` (todos os lançamentos):
`realizadoAcum = Σ valor_realizado`; `metaPeriodo = base × meses` (ou anual);
`percentual` e `status` pela regra acima. Resposta agrupa contrato → unidade →
`{ quantitativos[], qualitativos[] }` + `resumo`.

## 3. Dashboard

Reusa `/relatorios/cms` (KPIs, doughnut, cumprimento por unidade) e:

`GET /api/relatorios/serie-mensal?mes=YYYY-MM-01&meses=8&escopo=…` → série dos últimos
N meses: `realizadoProducao` (Σ quantitativos), `metaProducao` (Σ `meta_vigente_mensal`),
`taxaCumprimento` (% cumpridos). Alimenta as linhas de tendência (produção e taxa).

Seção de **repasse/descontos** só aparece quando há cálculo em `tb_repasse_mensal`
(hoje vazio — `calcularDescontos` ainda não rodou). Zero mock.

Filtros (mês/período/escopo) = componente `frontend/src/components/RelatorioFiltros.tsx`
compartilhado por Dashboard e Relatório CMS.

## Verificação rápida

```
node src/helper/avaliacaoCumprimento.js   # self-check regra
node src/helper/periodoRelatorio.js        # self-check janelas
npx mocha specs/acompanhamentos/status-cumprimento.spec.js
```
