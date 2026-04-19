import { useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { AlertTriangle, TrendingDown, CheckCircle } from 'lucide-react'
import CardMetrica from '../components/ui/CardMetrica'
import StatusBadge from '../components/ui/StatusBadge'
import AlertaDesconto from '../components/ui/AlertaDesconto'
import { useAuth } from '../contexts/AuthContext'
import {
  mockUnidades,
  mockAcompanhamentos,
  mockRepasse,
  mockIndicadores,
} from '../data/mock'
import { formatCurrency, formatNumber, formatPercent, formatMesReferencia } from '../lib/formatters'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

export default function PerfilOSSPage() {
  const { user } = useAuth()
  const [mesRef] = useState('2026-03')

  const unidade = mockUnidades.find(u => u.unidade_id === (user?.oss_id ? mockUnidades.find(un => un.contrato_id !== '')?.unidade_id : mockUnidades[0].unidade_id)) ?? mockUnidades[0]

  const indUnidade = mockIndicadores.filter(i => i.unidade_id === unidade.unidade_id)
  const meusDados = mockAcompanhamentos.filter(a => indUnidade.some(i => i.indicador_id === a.indicador_id))

  const allDescontos = [
    ...(mockRepasse.descontos_bloco ?? []),
    ...(mockRepasse.descontos_indicador ?? []),
  ]
  const meusDescontos = allDescontos.filter(d => {
    if ('bloco_id' in d) {
      return indUnidade.some(i => i.bloco_id === d.bloco_id)
    }
    if ('indicador_id' in d) {
      return indUnidade.some(i => i.indicador_id === d.indicador_id)
    }
    return false
  })

  const cumpridos = meusDados.filter(d => d.status_cumprimento === 'cumprido').length
  const emRisco = meusDados.filter(d =>
    (d.percentual_cumprimento ?? 0) < 85 && d.status_cumprimento !== 'cumprido',
  )
  const totalDescontos = meusDescontos.reduce((acc, d) => acc + d.valor_desconto, 0)

  const barData = {
    labels: meusDados.map(d => {
      const ind = mockIndicadores.find(i => i.indicador_id === d.indicador_id)
      return ind?.nome?.slice(0, 20) || `Ind ${d.indicador_id}`
    }),
    datasets: [
      {
        label: 'Meta',
        data: meusDados.map(d => d.meta_vigente_mensal ?? 0),
        backgroundColor: '#94A3B8',
        borderRadius: 4,
      },
      {
        label: 'Realizado',
        data: meusDados.map(d => d.valor_realizado ?? 0),
        backgroundColor: meusDados.map(d =>
          d.status_cumprimento === 'cumprido' ? '#059669'
          : d.status_cumprimento === 'parcial' ? '#D97706'
          : '#DC2626'
        ),
        borderRadius: 4,
      },
    ],
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Perfil OSS — {unidade.nome} — {formatMesReferencia(mesRef)}
        </h2>
        <p className="text-sm text-slate-500">
          {unidade.tipo} · {unidade.sigla} · Valor mensal: {formatCurrency(unidade.valor_mensal_unidade ?? 0)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CardMetrica
          titulo="Cumprimento"
          valor={`${cumpridos}/${meusDados.length}`}
          percentual={(cumpridos / (meusDados.length || 1)) * 100}
          status={cumpridos >= meusDados.length * 0.85 ? 'cumprido' : 'parcial'}
          icone={<CheckCircle size={20} />}
        />
        <CardMetrica
          titulo="Em Risco"
          valor={String(emRisco.length)}
          subtitulo="Indicadores abaixo de 85%"
          icone={<AlertTriangle size={20} />}
          status={emRisco.length > 0 ? 'nao_cumprido' : 'cumprido'}
        />
        <CardMetrica
          titulo="Descontos Projetados"
          valor={`-${formatCurrency(totalDescontos)}`}
          icone={<TrendingDown size={20} />}
          status={totalDescontos > 0 ? 'nao_cumprido' : 'cumprido'}
        />
      </div>

      <div className="rounded-xl border border-border-light bg-surface-light p-4 dark:border-border-dark dark:bg-surface-dark">
        <h3 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">
          Meta vs Realizado
        </h3>
        <div className="h-64">
          <Bar
            data={barData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: { x: { ticks: { maxRotation: 45, minRotation: 30, font: { size: 10 } } } },
              plugins: {
                legend: { position: 'top' },
              },
            }}
          />
        </div>
      </div>

      {emRisco.length > 0 && (
        <div className="rounded-xl border border-parcial/30 bg-parcial/5 p-4">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-parcial">
            <AlertTriangle size={18} />
            Indicadores em Risco
          </h3>
          <div className="space-y-2">
            {emRisco.map(a => {
              const ind = mockIndicadores.find(i => i.indicador_id === a.indicador_id)
              return (
                <div
                  key={a.acomp_id}
                  className="flex items-center justify-between rounded-lg bg-white p-3 dark:bg-surface-dark"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                      {ind?.nome}
                    </p>
                    <p className="text-xs text-slate-500">
                      Meta: {formatNumber(a.meta_vigente_mensal ?? 0)} · Realizado: {formatNumber(a.valor_realizado ?? 0)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold">
                      {formatPercent(a.percentual_cumprimento ?? 0)}
                    </span>
                    <StatusBadge status={a.status_cumprimento} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {meusDescontos.length > 0 && (
        <div>
          <h3 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">
            Descontos Projetados/Aplicados
          </h3>
          <div className="space-y-2">
            {meusDescontos.map(d => (
              <AlertaDesconto key={'desc_bloco_id' in d ? d.desc_bloco_id : d.desc_ind_id} desconto={d} />
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border-light bg-surface-light p-4 dark:border-border-dark dark:bg-surface-dark">
        <h3 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">
          Detalhamento Completo
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-light dark:border-border-dark">
              <tr>
                <th className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400">Indicador</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-600 dark:text-slate-400">Meta</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-600 dark:text-slate-400">Realizado</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-600 dark:text-slate-400">%</th>
                <th className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {meusDados.map(a => {
                const ind = mockIndicadores.find(i => i.indicador_id === a.indicador_id)
                return (
                  <tr key={a.acomp_id}>
                    <td className="px-3 py-2 text-slate-900 dark:text-slate-200">{ind?.nome}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">{formatNumber(a.meta_vigente_mensal ?? 0)}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-900 dark:text-slate-200">{formatNumber(a.valor_realizado ?? 0)}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold">{formatPercent(a.percentual_cumprimento ?? 0)}</td>
                    <td className="px-3 py-2"><StatusBadge status={a.status_cumprimento} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
