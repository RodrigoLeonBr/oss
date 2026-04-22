import { useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line, Doughnut, Bar } from 'react-chartjs-2'
import AlertaDesconto from '../components/ui/AlertaDesconto'
import {
  mockContratos,
  mockUnidades,
  mockBlocos,
  mockAcompanhamentos,
  mockRepasse,
  mockHistorico,
  mockIndicadores,
} from '../data/mock'
import { formatCurrency, formatMesReferencia } from '../lib/formatters'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, BarElement, Tooltip, Legend)

const TICK_COLOR = '#8e9cae'
const GRID_COLOR = 'rgba(142,156,174,0.12)'

export default function DashboardPage() {
  const [mesRef] = useState('2026-03')
  const contrato = mockContratos[0]
  const oss = mockContratos[0].organizacao

  const cumpridos    = mockAcompanhamentos.filter(a => a.status_cumprimento === 'cumprido').length
  const parciais     = mockAcompanhamentos.filter(a => a.status_cumprimento === 'parcial').length
  const naoCumpridos = mockAcompanhamentos.filter(a => a.status_cumprimento === 'nao_cumprido').length
  const totalIndicadores = mockAcompanhamentos.length
  const taxaCumprimento  = (cumpridos / totalIndicadores) * 100

  const trendData = {
    labels: mockHistorico.map(h => formatMesReferencia(h.mes)),
    datasets: [
      {
        label: 'Realizado',
        data: mockHistorico.map(h => h.realizado),
        borderColor: '#1b3a66',
        backgroundColor: 'rgba(27,58,102,0.08)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: '#1b3a66',
      },
      {
        label: 'Meta',
        data: mockHistorico.map(h => h.meta),
        borderColor: '#8e9cae',
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.4,
        borderDash: [4, 4],
        pointRadius: 0,
      },
    ],
  }

  const doughnutData = {
    labels: ['Cumprido', 'Parcial', 'Não Cumprido'],
    datasets: [
      {
        data: [cumpridos, parciais, naoCumpridos],
        backgroundColor: ['#0d7373', '#b67810', '#c04a45'],
        borderWidth: 0,
        cutout: '72%',
      },
    ],
  }

  const allDescontos = [
    ...(mockRepasse.descontos_bloco ?? []),
    ...(mockRepasse.descontos_indicador ?? []),
  ]

  return (
    <div className="space-y-5">
      {/* Context strip */}
      <div className="flex items-center gap-3">
        <div className="h-7 w-0.5 flex-none rounded-full bg-primary" />
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-text-muted">
            Referência {formatMesReferencia(mesRef)}
          </p>
          <h2 className="text-lg font-semibold text-text-primary">
            Contrato {contrato.numero} — {oss?.nome ?? 'N/A'}
          </h2>
        </div>
      </div>

      {/* ── HERO: Repasse Flow ─────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-md">
        <div className="border-b border-border-subtle bg-surface-alt px-4 py-2.5">
          <p className="text-sm font-medium uppercase tracking-wider text-text-muted">
            Demonstrativo de Repasse
          </p>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-0">
            {/* Base value */}
            <div className="sm:pr-4">
              <p className="text-sm text-text-muted">Repasse Base</p>
              <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-text-primary">
                {formatCurrency(contrato.valor_mensal_base)}
              </p>
              <p className="mt-0.5 text-sm text-text-muted">valor contratual mensal</p>
            </div>

            {/* Discount — center connector */}
            <div className="sm:border-x sm:border-border-subtle sm:px-3">
              {/* Desktop */}
              <div className="hidden sm:flex sm:h-full sm:flex-col sm:items-center sm:justify-center sm:gap-2">
                <div className="h-px w-full bg-border-default" />
                <div className="rounded-lg border border-status-bad-border bg-status-bad-bg px-3 py-2 text-center">
                  <p className="text-xs uppercase tracking-wide text-text-muted">Descontos</p>
                  <p className="mt-0.5 font-mono text-base font-semibold tabular-nums text-status-bad">
                    −{formatCurrency(mockRepasse.desconto_total)}
                  </p>
                  <p className="mt-0.5 text-xs text-status-bad opacity-70">
                    {mockRepasse.percentual_retido.toFixed(1)}% retido
                  </p>
                </div>
                <div className="h-px w-full bg-border-default" />
              </div>
              {/* Mobile */}
              <div className="flex items-center gap-3 sm:hidden">
                <div className="h-px flex-1 bg-border-default" />
                <div className="rounded-lg border border-status-bad-border bg-status-bad-bg px-3 py-2">
                  <p className="text-sm text-text-muted">Descontos aplicados</p>
                  <p className="font-mono text-base font-semibold tabular-nums text-status-bad">
                    −{formatCurrency(mockRepasse.desconto_total)}{' '}
                    <span className="text-xs opacity-70">({mockRepasse.percentual_retido.toFixed(1)}%)</span>
                  </p>
                </div>
                <div className="h-px flex-1 bg-border-default" />
              </div>
            </div>

            {/* Final — hero number */}
            <div className="sm:pl-4 sm:text-right">
              <p className="text-sm text-text-muted">Repasse Final</p>
              <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-text-primary">
                {formatCurrency(mockRepasse.repasse_final)}
              </p>
              <p className="mt-0.5 text-sm text-text-muted">
                a transferir — {formatMesReferencia(mesRef)}
              </p>
            </div>
          </div>

          {/* Status chips */}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-status-ok-border bg-status-ok-bg px-3 py-0.5 text-sm font-medium text-status-ok">
              <span className="h-1.5 w-1.5 rounded-full bg-status-ok" />
              {cumpridos} cumpridos
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-status-warn-border bg-status-warn-bg px-3 py-0.5 text-sm font-medium text-status-warn">
              <span className="h-1.5 w-1.5 rounded-full bg-status-warn" />
              {parciais} parciais
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-status-bad-border bg-status-bad-bg px-3 py-0.5 text-sm font-medium text-status-bad">
              <span className="h-1.5 w-1.5 rounded-full bg-status-bad" />
              {naoCumpridos} não cumpridos
            </span>
            <span className="ml-auto hidden text-sm text-text-muted sm:inline">
              {totalIndicadores} indicadores acompanhados
            </span>
          </div>

          {/* Cumprimento progress bar */}
          <div className="mt-4 border-t border-border-subtle pt-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs text-text-muted">Cumprimento geral do período</span>
              <span className={`font-mono text-xs font-semibold tabular-nums ${
                taxaCumprimento >= 85 ? 'text-status-ok' :
                taxaCumprimento >= 70 ? 'text-status-warn' : 'text-status-bad'
              }`}>{taxaCumprimento.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-alt">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  taxaCumprimento >= 85 ? 'bg-status-ok' :
                  taxaCumprimento >= 70 ? 'bg-status-warn' : 'bg-status-bad'
                }`}
                style={{ width: `${Math.min(taxaCumprimento, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Análise de Desempenho ─────────────────────────────────────── */}
      <section>
        <p className="mb-3 text-sm font-medium uppercase tracking-wider text-text-muted">
          Análise de Desempenho
        </p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Trend */}
          <div className="rounded-xl border border-border-subtle bg-surface p-3 shadow-sm">
            <div className="mb-3">
              <h3 className="text-base font-semibold text-text-primary">Tendência de Produção</h3>
              <p className="text-sm text-text-muted">Realizado vs. Meta — últimos 6 meses</p>
            </div>
            <div className="h-56">
              <Line
                data={trendData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'top' as const,
                      align: 'end' as const,
                      labels: { boxWidth: 12, boxHeight: 2, font: { size: 13 }, color: TICK_COLOR },
                    },
                    tooltip: {
                      callbacks: { label: ctx => `${ctx.dataset.label}: ${(ctx.parsed.y ?? 0).toLocaleString('pt-BR')}` },
                    },
                  },
                  scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 13 }, color: TICK_COLOR } },
                    y: { grid: { color: GRID_COLOR }, ticks: { font: { size: 13 }, color: TICK_COLOR } },
                  },
                }}
              />
            </div>
          </div>

          {/* Doughnut + inline stats */}
          <div className="rounded-xl border border-border-subtle bg-surface p-3 shadow-sm">
            <div className="mb-3">
              <h3 className="text-base font-semibold text-text-primary">Distribuição de Cumprimento</h3>
              <p className="text-sm text-text-muted">{totalIndicadores} indicadores no período</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-40 w-40 flex-none">
                <Doughnut
                  data={doughnutData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                      legend: { display: false },
                      tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed}` } },
                    },
                  }}
                />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {(
                  [
                    { label: 'Cumprido',     count: cumpridos,    dotCls: 'bg-status-ok',   textCls: 'text-status-ok' },
                    { label: 'Parcial',      count: parciais,     dotCls: 'bg-status-warn', textCls: 'text-status-warn' },
                    { label: 'Não cumprido', count: naoCumpridos, dotCls: 'bg-status-bad',  textCls: 'text-status-bad' },
                  ] as const
                ).map(({ label, count, dotCls, textCls }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-text-secondary">
                      <span className={`h-2 w-2 rounded-full ${dotCls}`} />
                      {label}
                    </span>
                    <span className={`font-mono text-base font-semibold tabular-nums ${textCls}`}>
                      {count}
                    </span>
                  </div>
                ))}
                <div className="mt-0.5 border-t border-border-subtle pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-muted">Taxa de cumprimento</span>
                    <span className={`font-mono text-base font-bold tabular-nums ${
                      taxaCumprimento >= 85 ? 'text-status-ok' :
                      taxaCumprimento >= 70 ? 'text-status-warn' : 'text-status-bad'
                    }`}>
                      {taxaCumprimento.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Unidades de Saúde ─────────────────────────────────────────── */}
      <section>
        <p className="mb-3 text-sm font-medium uppercase tracking-wider text-text-muted">
          Desempenho por Unidade de Saúde
        </p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {mockUnidades.filter(u => u.contrato_id === contrato.contrato_id).map(unidade => {
            const blocosUnidade = mockBlocos.filter(b => b.unidade_id === unidade.unidade_id)
            const indUnidade    = mockIndicadores.filter(i => i.unidade_id === unidade.unidade_id)
            const acompsUnidade = mockAcompanhamentos.filter(
              a => indUnidade.some(i => i.indicador_id === a.indicador_id),
            )

            const barData = {
              labels: acompsUnidade.map(a => {
                const ind = mockIndicadores.find(i => i.indicador_id === a.indicador_id)
                return ind?.nome?.slice(0, 20) ?? `Ind ${a.indicador_id}`
              }),
              datasets: [
                {
                  label: 'Cumprimento %',
                  data: acompsUnidade.map(a => a.percentual_cumprimento ?? 0),
                  backgroundColor: acompsUnidade.map(a =>
                    (a.percentual_cumprimento ?? 0) >= 85 ? '#0d7373'
                    : (a.percentual_cumprimento ?? 0) >= 70 ? '#b67810'
                    : '#c04a45'
                  ),
                  borderRadius: 3,
                },
              ],
            }

            return (
              <div
                key={unidade.unidade_id}
                className="overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-sm"
              >
                <div className="border-b border-border-subtle bg-surface-alt px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-text-primary">{unidade.nome}</h3>
                    <span className="flex-none font-mono text-sm tabular-nums text-text-muted">
                      {formatCurrency(unidade.valor_mensal_unidade ?? 0)}/mês
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-text-muted">
                    {unidade.tipo} · {blocosUnidade.length} bloco(s)
                  </p>
                </div>
                <div className="p-3">
                  {acompsUnidade.length > 0 ? (
                    <div className="h-44">
                      <Bar
                        data={barData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          indexAxis: 'y' as const,
                          scales: {
                            x: {
                              max: 110,
                              grid: { color: GRID_COLOR },
                              ticks: { callback: v => `${v}%`, font: { size: 12 }, color: TICK_COLOR },
                            },
                            y: {
                              grid: { display: false },
                              ticks: { font: { size: 12 }, color: '#6a7688' },
                            },
                          },
                          plugins: {
                            legend: { display: false },
                            tooltip: { callbacks: { label: ctx => `${(ctx.parsed.x ?? 0).toFixed(1)}%` } },
                          },
                        }}
                      />
                    </div>
                  ) : (
                    <p className="py-8 text-center text-base text-text-muted">Sem dados de produção</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Descontos Aplicados ───────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium uppercase tracking-wider text-text-muted">
            Descontos Aplicados
          </p>
          <span className="text-sm text-text-muted">{formatMesReferencia(mesRef)}</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-sm">
          {allDescontos.length > 0 ? (
            <div className="space-y-1.5 p-3">
              {allDescontos.map(d => (
                <AlertaDesconto key={'desc_bloco_id' in d ? d.desc_bloco_id : d.desc_ind_id} desconto={d} />
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-base text-text-muted">Nenhum desconto aplicado</p>
          )}
          <div className="flex items-center justify-between border-t border-border-default bg-surface-alt px-3 py-2.5">
            <span className="text-base font-medium text-text-secondary">Total retido neste período</span>
            <span className="font-mono text-lg font-bold tabular-nums text-status-bad">
              −{formatCurrency(mockRepasse.desconto_total)}
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
