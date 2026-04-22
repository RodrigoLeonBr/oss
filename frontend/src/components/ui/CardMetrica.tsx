import { useMemo } from 'react'
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { StatusCumprimento } from '../../types'

ChartJS.register(ArcElement, Tooltip)

const getCssVar = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

// Static map: status → CSS variable name (string, not the resolved value)
const STATUS_CSS_VAR: Record<StatusCumprimento, string> = {
  cumprido:      '--status-ok',
  parcial:       '--status-warn',
  nao_cumprido:  '--status-bad',
  nao_aplicavel: '--sem-slate-500',
  aguardando:    '--sem-slate-500',
}

interface Props {
  titulo: string
  valor: string
  subtitulo?: string
  percentual?: number
  status?: StatusCumprimento
  icone?: React.ReactNode
  variacao?: number
}

export default function CardMetrica({
  titulo,
  valor,
  subtitulo,
  percentual,
  status = 'nao_aplicavel',
  icone,
  variacao,
}: Props) {
  // Memoized: getComputedStyle is called only when `status` changes, not on every render
  const cor = useMemo(() => getCssVar(STATUS_CSS_VAR[status]), [status])
  const trackColor = useMemo(() => getCssVar('--n-15'), [])
  const restante = percentual != null ? Math.max(0, 100 - Math.min(percentual, 100)) : 100

  const chartData = {
    datasets: [
      {
        data: percentual != null ? [Math.min(percentual, 100), restante] : [0, 100],
        backgroundColor: [cor, trackColor],
        borderWidth: 0,
        cutout: '75%',
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { tooltip: { enabled: false } },
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            {titulo}
          </p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{valor}</p>
          {subtitulo && (
            <p className="mt-0.5 text-xs text-text-muted">{subtitulo}</p>
          )}
          {variacao != null && (
            <div className={`mt-1 flex items-center gap-1 text-xs font-medium ${
              variacao > 0 ? 'text-cumprido' : variacao < 0 ? 'text-nao-cumprido' : 'text-na'
            }`}>
              {variacao > 0 ? <TrendingUp size={12} /> : variacao < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
              {variacao > 0 ? '+' : ''}{variacao}% vs mês anterior
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-1">
          {percentual != null ? (
            <div className="relative h-14 w-14">
              <Doughnut data={chartData} options={chartOptions} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold" style={{ color: cor }}>
                  {Math.round(percentual)}%
                </span>
              </div>
            </div>
          ) : (
            icone && (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {icone}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
