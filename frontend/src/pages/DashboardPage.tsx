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
import { DollarSign, TrendingDown, CheckCircle, AlertTriangle } from 'lucide-react'
import CardMetrica from '../components/ui/CardMetrica'
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

export default function DashboardPage() {
  const [mesRef] = useState('2026-03')
  const contrato = mockContratos[0]
  const oss = mockContratos[0].organizacao

  const cumpridos = mockAcompanhamentos.filter(a => a.status_cumprimento === 'cumprido').length
  const parciais = mockAcompanhamentos.filter(a => a.status_cumprimento === 'parcial').length
  const naoCumpridos = mockAcompanhamentos.filter(a => a.status_cumprimento === 'nao_cumprido').length
  const totalIndicadores = mockAcompanhamentos.length

  const trendData = {
    labels: mockHistorico.map(h => formatMesReferencia(h.mes)),
    datasets: [
      {
        label: 'Realizado',
        data: mockHistorico.map(h => h.realizado),
        borderColor: '#1E40AF',
        backgroundColor: 'rgba(30,64,175,0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Meta',
        data: mockHistorico.map(h => h.meta),
        borderColor: '#6B7280',
        backgroundColor: 'rgba(107,114,128,0.1)',
        fill: false,
        tension: 0.4,
        borderDash: [5, 5],
      },
    ],
  }

  const doughnutData = {
    labels: ['Cumprido', 'Parcial', 'Não Cumprido'],
    datasets: [
      {
        data: [cumpridos, parciais, naoCumpridos],
        backgroundColor: ['#059669', '#D97706', '#DC2626'],
        borderWidth: 0,
      },
    ],
  }

  const allDescontos = [
    ...(mockRepasse.descontos_bloco ?? []),
    ...(mockRepasse.descontos_indicador ?? []),
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Dashboard Executivo — {formatMesReferencia(mesRef)}
          </h2>
          <p className="text-sm text-slate-500">
            Contrato {contrato.numero} — {oss?.nome ?? 'N/A'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CardMetrica
          titulo="Repasse Final"
          valor={formatCurrency(mockRepasse.repasse_final)}
          subtitulo={`Base: ${formatCurrency(contrato.valor_mensal_base)}`}
          icone={<DollarSign size={20} />}
        />
        <CardMetrica
          titulo="Total Descontos"
          valor={`-${formatCurrency(mockRepasse.desconto_total)}`}
          subtitulo={`-${mockRepasse.percentual_retido.toFixed(1)}% do repasse base`}
          icone={<TrendingDown size={20} />}
          status="nao_cumprido"
        />
        <CardMetrica
          titulo="Indicadores Cumpridos"
          valor={`${cumpridos}/${totalIndicadores}`}
          percentual={(cumpridos / totalIndicadores) * 100}
          status={cumpridos >= totalIndicadores * 0.85 ? 'cumprido' : cumpridos >= totalIndicadores * 0.7 ? 'parcial' : 'nao_cumprido'}
          icone={<CheckCircle size={20} />}
        />
        <CardMetrica
          titulo="Alertas Críticos"
          valor={String(naoCumpridos)}
          subtitulo={`${parciais} parciais`}
          icone={<AlertTriangle size={20} />}
          status={naoCumpridos > 0 ? 'nao_cumprido' : 'cumprido'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {mockUnidades.filter(u => u.contrato_id === contrato.contrato_id).map(unidade => {
          const blocosUnidade = mockBlocos.filter(b => b.unidade_id === unidade.unidade_id)
          const indUnidade = mockIndicadores.filter(i => i.unidade_id === unidade.unidade_id)
          const acompsUnidade = mockAcompanhamentos.filter(
            a => indUnidade.some(i => i.indicador_id === a.indicador_id),
          )

          const barLabels = acompsUnidade.map(a => {
            const ind = mockIndicadores.find(i => i.indicador_id === a.indicador_id)
            return ind?.nome?.slice(0, 20) ?? `Ind ${a.indicador_id}`
          })

          const barData = {
            labels: barLabels,
            datasets: [
              {
                label: 'Cumprimento %',
                data: acompsUnidade.map(a => a.percentual_cumprimento ?? 0),
                backgroundColor: acompsUnidade.map(a =>
                  (a.percentual_cumprimento ?? 0) >= 85 ? '#059669'
                  : (a.percentual_cumprimento ?? 0) >= 70 ? '#D97706'
                  : '#DC2626'
                ),
                borderRadius: 4,
              },
            ],
          }

          return (
            <div
              key={unidade.unidade_id}
              className="rounded-xl border border-border-light bg-surface-light p-4 dark:border-border-dark dark:bg-surface-dark"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  {unidade.nome}
                </h3>
                <span className="text-xs text-slate-500">
                  {formatCurrency(unidade.valor_mensal_unidade ?? 0)}/mês
                </span>
              </div>
              <p className="mb-3 text-xs text-slate-500">{unidade.tipo} · {blocosUnidade.length} bloco(s)</p>
              {acompsUnidade.length > 0 ? (
                <div className="h-48">
                  <Bar
                    data={barData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      indexAxis: 'y',
                      scales: {
                        x: { max: 110, ticks: { callback: v => `${v}%` } },
                      },
                      plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: ctx => `${(ctx.parsed.x ?? 0).toFixed(1)}%` } },
                      },
                    }}
                  />
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-slate-400">Sem dados de produção</p>
              )}
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border-light bg-surface-light p-4 dark:border-border-dark dark:bg-surface-dark">
          <h3 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">
            Tendência — Últimos 6 Meses
          </h3>
          <div className="h-64">
            <Line
              data={trendData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  tooltip: {
                    callbacks: { label: ctx => `${ctx.dataset.label}: ${(ctx.parsed.y ?? 0).toLocaleString('pt-BR')}` },
                  },
                },
              }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border-light bg-surface-light p-4 dark:border-border-dark dark:bg-surface-dark">
          <h3 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">
            Distribuição de Status
          </h3>
          <div className="mx-auto h-64 max-w-xs">
            <Doughnut
              data={doughnutData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'bottom' },
                },
              }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border-light bg-surface-light p-4 dark:border-border-dark dark:bg-surface-dark">
        <h3 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">
          Descontos Aplicados — {formatMesReferencia(mesRef)}
        </h3>
        {allDescontos.length > 0 ? (
          <div className="space-y-2">
            {allDescontos.map((d) => (
              <AlertaDesconto key={'desc_bloco_id' in d ? d.desc_bloco_id : d.desc_ind_id} desconto={d} />
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-slate-400">Nenhum desconto aplicado</p>
        )}
        <div className="mt-4 flex items-center justify-between border-t border-border-light pt-3 dark:border-border-dark">
          <span className="font-medium text-slate-700 dark:text-slate-300">Total Descontos</span>
          <span className="text-lg font-bold text-nao-cumprido">
            -{formatCurrency(mockRepasse.desconto_total)}
          </span>
        </div>
      </div>
    </div>
  )
}
