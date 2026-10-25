import { useEffect, useMemo, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Line } from 'react-chartjs-2'
import { useApi } from '../hooks/useApi'
import { toQuery, type Filtros } from '../components/RelatorioFiltros'
import { formatMesReferencia, formatNumber, statusLabel } from '../lib/formatters'
import type { StatusCumprimento } from '../types'

// Linha de indicador do relatório CMS (campos já devolvidos por /relatorios/cms).
export interface Linha {
  indicadorId: string
  codigo: string
  nome: string
  tipo: 'quantitativo' | 'qualitativo'
  unidadeMedida: string | null
  metaPeriodo: number | null
  realizadoAcum: number
  percentual: number | null
  status: StatusCumprimento
}
export interface UnidadeRel { unidadeId: string; nome: string; quantitativos: Linha[]; qualitativos: Linha[] }
export interface ContratoRel { contratoId: string; numero: string; unidades: UnidadeRel[] }

interface Ponto { mes: string; realizado: number | null; meta: number | null }
type Matriz = Record<string, Ponto[]>

const unwrap = <T,>(raw: unknown): T => {
  if (raw && typeof raw === 'object' && 'data' in raw) return (raw as { data: T }).data
  return raw as T
}

const TICK_COLOR = '#8e9cae'
const GRID_COLOR = 'rgba(142,156,174,0.12)'
const num = (v: number | null | undefined) => (v == null ? '—' : formatNumber(v))

interface Props {
  status: StatusCumprimento
  contratos: ContratoRel[]
  filtros: Filtros
  /** período com mais de 1 mês → mostra tabela mensal + gráfico */
  multiMes: boolean
  onClose: () => void
}

export default function IndicadoresDetalheModal({ status, contratos, filtros, multiMes, onClose }: Props) {
  const { get } = useApi()
  const [matriz, setMatriz] = useState<Matriz>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', handler); document.body.style.overflow = '' }
  }, [onClose])

  // Matriz mensal só quando o período tem vários meses.
  useEffect(() => {
    if (!multiMes) { setMatriz({}); return }
    setLoading(true)
    get<{ data: Matriz } | Matriz>(`/relatorios/cms-mensal?${toQuery(filtros)}`)
      .then(r => setMatriz(unwrap<Matriz>(r) ?? {}))
      .catch(() => setMatriz({}))
      .finally(() => setLoading(false))
  }, [get, filtros, multiMes])

  // Agrupa por unidade → quantitativos/qualitativos, filtrando pelo status do card.
  const grupos = useMemo(() => {
    const out: { unidadeId: string; nome: string; quant: Linha[]; qual: Linha[] }[] = []
    for (const c of contratos) {
      for (const u of c.unidades) {
        const quant = u.quantitativos.filter(l => l.status === status)
        const qual = u.qualitativos.filter(l => l.status === status)
        if (quant.length || qual.length) out.push({ unidadeId: u.unidadeId, nome: u.nome, quant, qual })
      }
    }
    return out
  }, [contratos, status])

  const total = useMemo(() => grupos.reduce((s, g) => s + g.quant.length + g.qual.length, 0), [grupos])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4"
      role="dialog" aria-modal="true" aria-labelledby="detalhe-modal-title"
      onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-2xl"
        onClick={e => e.stopPropagation()}>
        {/* Header fixo */}
        <div className="flex flex-none items-center justify-between border-b border-border-subtle bg-surface px-6 py-4">
          <div>
            <h2 id="detalhe-modal-title" className="text-base font-semibold text-text-primary">
              Indicadores — {statusLabel(status)}
            </h2>
            <p className="text-xs text-text-muted">{total} indicador(es) no período</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar"
            className="rounded-lg p-1.5 text-text-faint transition-colors hover:bg-hover hover:text-text-secondary">
            <X size={20} />
          </button>
        </div>

        {/* Corpo rolável */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Loader2 size={16} className="animate-spin text-primary" /> Carregando detalhe mensal…
            </div>
          )}

          {!grupos.length && !loading && (
            <p className="py-10 text-center text-sm text-text-muted">Nenhum indicador neste status.</p>
          )}

          {grupos.map(g => (
            <section key={g.unidadeId} className="space-y-3">
              <h3 className="sticky top-0 z-10 -mx-6 bg-surface-alt px-6 py-2 text-sm font-semibold text-text-primary">
                {g.nome}
              </h3>
              {g.quant.length > 0 && (
                <TipoBloco titulo="Quantitativos" linhas={g.quant} matriz={matriz} multiMes={multiMes} />
              )}
              {g.qual.length > 0 && (
                <TipoBloco titulo="Qualitativos" linhas={g.qual} matriz={matriz} multiMes={multiMes} />
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

function TipoBloco({ titulo, linhas, matriz, multiMes }: {
  titulo: string; linhas: Linha[]; matriz: Matriz; multiMes: boolean
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{titulo}</p>
      {linhas.map(l => (
        <IndicadorCard key={l.indicadorId} linha={l} pontos={matriz[l.indicadorId]} multiMes={multiMes} />
      ))}
    </div>
  )
}

function IndicadorCard({ linha, pontos, multiMes }: { linha: Linha; pontos?: Ponto[]; multiMes: boolean }) {
  const unidade = linha.unidadeMedida ? ` ${linha.unidadeMedida}` : ''
  const pct = linha.percentual != null ? `${linha.percentual.toFixed(1)}%` : '—'
  // Gráfico em ordem cronológica (pontos vêm decrescentes).
  const cron = pontos ? [...pontos].reverse() : []

  const chartData = {
    labels: cron.map(p => formatMesReferencia(`${p.mes}-01`)),
    datasets: [
      { label: 'Realizado', data: cron.map(p => p.realizado), borderColor: '#1b3a66', backgroundColor: 'rgba(27,58,102,0.08)', fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#1b3a66' },
      { label: 'Meta', data: cron.map(p => p.meta), borderColor: '#8e9cae', backgroundColor: 'transparent', fill: false, tension: 0.4, borderDash: [4, 4], pointRadius: 0 },
    ],
  }
  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const, align: 'end' as const, labels: { boxWidth: 12, boxHeight: 2, font: { size: 12 }, color: TICK_COLOR } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${(ctx.parsed.y ?? 0).toLocaleString('pt-BR')}` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 12 }, color: TICK_COLOR } },
      y: { grid: { color: GRID_COLOR }, ticks: { font: { size: 12 }, color: TICK_COLOR } },
    },
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-3 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-text-primary">{linha.nome}</p>
          <p className="font-mono text-xs text-text-muted">{linha.codigo}</p>
        </div>
        <div className="flex gap-4 text-right text-sm">
          <div><p className="text-xs text-text-muted">Meta</p><p className="font-mono tabular-nums text-text-primary">{num(linha.metaPeriodo)}{unidade}</p></div>
          <div><p className="text-xs text-text-muted">Realizado</p><p className="font-mono tabular-nums text-text-primary">{num(linha.realizadoAcum)}{unidade}</p></div>
          <div><p className="text-xs text-text-muted">%</p><p className="font-mono tabular-nums font-semibold text-text-primary">{pct}</p></div>
        </div>
      </div>

      {multiMes && pontos && pontos.length > 0 && (
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-xs text-text-muted">
                  <th className="py-1 pr-3 text-left font-medium">Mês</th>
                  <th className="py-1 px-3 text-right font-medium">Realizado</th>
                  <th className="py-1 pl-3 text-right font-medium">Meta</th>
                </tr>
              </thead>
              <tbody>
                {pontos.map(p => (
                  <tr key={p.mes} className="border-b border-border-subtle/50">
                    <td className="py-1 pr-3 text-text-secondary">{formatMesReferencia(`${p.mes}-01`)}</td>
                    <td className="py-1 px-3 text-right font-mono tabular-nums text-text-primary">{num(p.realizado)}</td>
                    <td className="py-1 pl-3 text-right font-mono tabular-nums text-text-muted">{num(p.meta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="h-44"><Line data={chartData} options={chartOpts} /></div>
        </div>
      )}
    </div>
  )
}
