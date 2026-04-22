# Interface Design System — OSS Saúde Americana

## Direction

**Product:** Government healthcare contract management (Contratos de Gestão). Monthly reporting, financial repasse calculation, indicator tracking, audit compliance.

**Who:** Municipal health secretaries and auditors reviewing monthly contract performance — often in meetings or before signing payment orders.

**Feel:** Authoritative, institutional, data-dense but not overwhelming. Precise like a well-designed government report. IBM Plex Sans (body) + IBM Plex Mono (numbers).

---

## Depth Strategy

**Borders + subtle shadows.** Never mix.

- Cards: `border border-border-subtle shadow-sm`
- Hero/elevated cards: `border border-border-subtle shadow-md`
- Section headers inside cards: `bg-surface-alt` strip with `border-b border-border-subtle`
- Inputs: darker background than surroundings (inset feel)
- Sidebars: same `bg-surface` as main content, separated by `border-r border-border-subtle`

---

## Spacing

Base unit: **4px (0.25rem)**. Scale: 2, 4, 6, 8, 10, 12, 16, 20, 24.

- Micro (icon gaps, chip padding): `gap-1.5`, `px-3 py-1`
- Component (card padding): `p-4`, `p-5`
- Section separation: `space-y-6`
- Border-t dividers within cards: `mt-4 pt-4` or `mt-5 pt-4`

---

## Token Reference

All colors reference CSS custom properties — auto-switch light/dark.

```
Surfaces:     bg-canvas, bg-surface, bg-surface-alt, bg-hover
Borders:      border-border-subtle, border-border-default
Text:         text-text-primary, text-text-secondary, text-text-muted, text-text-faint
Status text:  text-status-ok, text-status-warn, text-status-bad
Status bg:    bg-status-ok-bg, bg-status-warn-bg, bg-status-bad-bg
Status border:border-status-ok-border, border-status-warn-border, border-status-bad-border
Brand:        text-primary, bg-primary/10 (static #1b3a66)
Mono font:    font-mono tabular-nums (IBM Plex Mono — use for all currency/numeric values)
```

---

## Section Label Pattern

Every major page section gets a label above it:

```tsx
<p className="mb-3 text-xs font-medium uppercase tracking-wider text-text-muted">
  Section Name
</p>
```

---

## Card Pattern

Standard card:

```tsx
<div className="overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-sm">
  {/* Optional header strip */}
  <div className="border-b border-border-subtle bg-surface-alt px-4 py-3">
    <h3 className="text-sm font-semibold text-text-primary">Title</h3>
    <p className="mt-0.5 text-xs text-text-muted">Subtitle</p>
  </div>
  <div className="p-4">
    {/* content */}
  </div>
</div>
```

Hero card (page-level anchor element):

```tsx
<div className="overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-md">
```

---

## Status Chip Pattern

Used for cumprido/parcial/não-cumprido inline summaries:

```tsx
<span className="inline-flex items-center gap-1.5 rounded-full border border-status-ok-border bg-status-ok-bg px-3 py-1 text-xs font-medium text-status-ok">
  <span className="h-1.5 w-1.5 rounded-full bg-status-ok" />
  {count} cumpridos
</span>
```

Replace `-ok-` with `-warn-` or `-bad-` for other states.

---

## Context Strip (Page Top)

Every page starts with contract/entity context — not a redundant page title (global Header already shows that):

```tsx
<div className="flex items-center gap-3">
  <div className="h-7 w-0.5 flex-none rounded-full bg-primary" />
  <div>
    <p className="text-xs font-medium uppercase tracking-widest text-text-muted">
      Referência {formatMesReferencia(mesRef)}
    </p>
    <h2 className="text-base font-semibold text-text-primary">
      Contrato {numero} — {ossNome}
    </h2>
  </div>
</div>
```

---

## Repasse Flow (Signature Pattern)

The financial narrative card — Base → Deductions → Final. Used on Dashboard.
Hero number is `text-3xl font-bold` mono. Discount pill uses status-bad triad.

Desktop: 3-column grid with `border-x border-border-subtle` on center column.
Mobile: stacked with inline connector lines.

```tsx
<div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-0">
  {/* Base — left */}
  <div className="sm:pr-5"> ... </div>
  {/* Discount — center with border-x */}
  <div className="sm:border-x sm:border-border-subtle sm:px-4"> ... </div>
  {/* Final — right, text-right on desktop */}
  <div className="sm:pl-5 sm:text-right">
    <p className="font-mono text-3xl font-bold tabular-nums text-text-primary">
      {formatCurrency(repasse_final)}
    </p>
  </div>
</div>
```

---

## Chart Defaults

```ts
const TICK_COLOR = '#8e9cae'   // --n-40
const GRID_COLOR = 'rgba(142,156,174,0.12)'

// Line chart
borderColor: '#1b3a66'          // brand-navy-700 = --accent (light)
backgroundColor: 'rgba(27,58,102,0.08)'
// Meta line
borderColor: '#8e9cae', borderDash: [4, 4], pointRadius: 0

// Bar / Doughnut status colors
cumprido:    '#0d7373'   // sem-teal-600
parcial:     '#b67810'   // sem-amber-600
nao_cumprido:'#c04a45'   // sem-coral-600
```

Doughnut: `cutout: '72%'`, legend hidden — show inline stat rows instead.
Bar: `indexAxis: 'y'`, `borderRadius: 3`, legend hidden.

---

## Typography Scale

Screens are small — base reading size is 14px (text-sm). Bump rule: xs→sm, sm→base.

```
Section labels:  text-sm font-medium uppercase tracking-wider text-text-muted
Card titles:     text-base font-semibold text-text-primary
Supporting text: text-sm text-text-muted
Context h2:      text-lg font-semibold text-text-primary
Hero numbers:    font-mono text-3xl font-bold tabular-nums text-text-primary
Secondary nums:  font-mono text-xl font-semibold tabular-nums text-text-primary
Data numbers:    font-mono text-base font-semibold tabular-nums
Currency labels: font-mono tabular-nums (all monetary values)
Chart ticks:     size: 13 (was 11); bar chart ticks: size: 12 (was 10)
```

---

## Border Radius

- Cards, modals: `rounded-xl`
- Chips, badges: `rounded-full`
- Buttons, inputs: `rounded-lg`
- Small indicators: `rounded-full` (dots, progress rings)
