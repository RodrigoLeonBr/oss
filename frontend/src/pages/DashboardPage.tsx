import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  ArcElement, BarElement, Tooltip, Legend,
} from 'chart.js'
import { Line, Doughnut, Bar } from 'react-chartjs-2'
import { Loader2, AlertCircle } from 'lucide-react'
import RelatorioFiltros, {
  type Filtros, PERIODOS, mesDefault, toQuery, escopoIncompleto,
} from '../components/RelatorioFiltros'
import { useApi, ApiError } from '../hooks/useApi'
import { formatCurrency, formatMesReferencia, formatNumber } from '../lib/formatters'
import type { StatusCumprimento } from '../types'
import IndicadoresDetalheModal, { type ContratoRel } from './IndicadoresDetalheModal'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, BarElement, Tooltip, Legend)

const TICK_COLOR = '#8e9cae'
const GRID_COLOR = 'rgba(142,156,174,0.12)'

// ── Tipos das respostas ─────────────────────────────────────────────────────────
interface Relatorio {
  janela: { inicio: string; fim: string; meses: number }
  resumo: { cumpridos: number; parciais: number; naoCumpridos: number; aguardando: number; total: number }
  contratos: ContratoRel[]
}
interface PontoSerie {
  mes: string; realizadoProducao: number; metaProducao: number; taxaCumprimento: number
}
interface Repasse {
  valor_mensal_base: number; desconto_total: number; repasse_final: number; percentual_retido: number
  desconto_producao_total: number; desconto_qualidade_total: number
  descontos_bloco?: unknown[]; descontos_indicador?: unknown[]
}

const unwrap = <T,>(raw: unknown): T => {
  if (raw && typeof raw === 'object' && 'data' in raw) return (raw as { data: T }).data
  return raw as T
}
const taxaCls = (t: number) => (t >= 85 ? 'text-status-ok' : t >= 70 ? 'text-status-warn' : 'text-status-bad')
const barCor = (t: number) => (t >= 85 ? '#0d7373' : t >= 70 ? '#b67810' : '#c04a45')

export default function DashboardPage() {
  const { get } = useApi()

  const [filtros, setFiltros] = useState<Filtros>({
    mes: '', periodo: 'mes', escopo: 'todos', contratoId: '', unidadeId: '',
  })

  // Default = último mês com lançamento (dados vão só até certo mês)
  useEffect(() => {
    get<{ data: { mes: string | null } } | { mes: string | null }>('/relatorios/ultimo-mes')
      .then(r => {
        const m = unwrap<{ mes: string | null }>(r)?.mes
        setFiltros(f => ({ ...f, mes: m ? m.slice(0, 7) : mesDefault() }))
      })
      .catch(() => setFiltros(f => ({ ...f, mes: mesDefault() })))
  }, [get])
  const [rel, setRel] = useState<Relatorio | null>(null)
  const [serie, setSerie] = useState<PontoSerie[]>([])
  const [repasse, setRepasse] = useState<Repasse | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [cardStatus, setCardStatus] = useState<StatusCumprimento | null>(null)

  const fetchTudo = useCallback(async () => {
    if (!filtros.mes || escopoIncompleto(filtros)) { setRel(null); setSerie([]); setRepasse(null); return }
    setLoading(true)
    setErro(null)
    try {
      const [relRaw, serieRaw] = await Promise.all([
        get<{ data: Relatorio } | Relatorio>(`/relatorios/cms?${toQuery(filtros)}`),
        get<{ data: PontoSerie[] } | PontoSerie[]>(`/relatorios/serie-mensal?${toQuery(filtros, { meses: '8' })}`),
      ])
      setRel(unwrap<Relatorio>(relRaw))
      setSerie(unwrap<PontoSerie[]>(serieRaw) ?? [])

      // Repasse só faz sentido por contrato; 404 = ainda não calculado → oculta
      if (filtros.escopo === 'contrato' && filtros.contratoId) {
        try {
          const rRaw = await get<{ data: Repasse } | Repasse>(
            `/acompanhamento-mensal/repasse?mes=${filtros.mes}-01&contrato_id=${filtros.contratoId}`,
          )
          setRepasse(unwrap<Repasse>(rRaw))
        } catch { setRepasse(null) }
      } else {
        setRepasse(null)
      }
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao carregar o dashboard.')
      setRel(null); setSerie([])
    } finally {
      setLoading(false)
    }
  }, [get, filtros])

  useEffect(() => { fetchTudo() }, [fetchTudo])

  const taxa = rel && rel.resumo.total > 0 ? (rel.resumo.cumpridos / rel.resumo.total) * 100 : 0
  const periodoLabel = PERIODOS.find(p => p.v === filtros.periodo)?.label ?? filtros.periodo

  // Barras: taxa de cumprimento (% cumpridos) por unidade
  const porUnidade = useMemo(() => {
    const out: { nome: string; taxa: number }[] = []
    for (const c of rel?.contratos ?? []) {
      for (const u of c.unidades) {
        const linhas = [...u.quantitativos, ...u.qualitativos]
        if (!linhas.length) continue
        const cumpr = linhas.filter(l => l.status === 'cumprido').length
        out.push({ nome: u.nome, taxa: (cumpr / linhas.length) * 100 })
      }
    }
    return out.sort((a, b) => b.taxa - a.taxa)
  }, [rel])

  const trendProducao = {
    labels: serie.map(s => formatMesReferencia(s.mes)),
    datasets: [
      { label: 'Realizado', data: serie.map(s => s.realizadoProducao), borderColor: '#1b3a66', backgroundColor: 'rgba(27,58,102,0.08)', fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#1b3a66' },
      { label: 'Meta', data: serie.map(s => s.metaProducao), borderColor: '#8e9cae', backgroundColor: 'transparent', fill: false, tension: 0.4, borderDash: [4, 4], pointRadius: 0 },
    ],
  }
  const trendTaxa = {
    labels: serie.map(s => formatMesReferencia(s.mes)),
    datasets: [
      { label: 'Taxa de cumprimento', data: serie.map(s => s.taxaCumprimento), borderColor: '#0d7373', backgroundColor: 'rgba(13,115,115,0.1)', fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#0d7373' },
    ],
  }
  const doughnutData = {
    labels: ['Cumprido', 'Parcial', 'Não Cumprido', 'Aguardando'],
    datasets: [{
      data: rel ? [rel.resumo.cumpridos, rel.resumo.parciais, rel.resumo.naoCumpridos, rel.resumo.aguardando] : [],
      backgroundColor: ['#0d7373', '#b67810', '#c04a45', '#8e9cae'], borderWidth: 0, cutout: '72%',
    }],
  }
  const barUnidades = {
    labels: porUnidade.map(u => u.nome.slice(0, 26)),
    datasets: [{ label: 'Cumprimento %', data: porUnidade.map(u => u.taxa), backgroundColor: porUnidade.map(u => barCor(u.taxa)), borderRadius: 3 }],
  }

  const lineOpts = (max?: number, pctAxis = false) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const, align: 'end' as const, labels: { boxWidth: 12, boxHeight: 2, font: { size: 13 }, color: TICK_COLOR } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${pctAxis ? `${(ctx.parsed.y ?? 0).toFixed(1)}%` : (ctx.parsed.y ?? 0).toLocaleString('pt-BR')}` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 13 }, color: TICK_COLOR } },
      y: { max, grid: { color: GRID_COLOR }, ticks: { font: { size: 13 }, color: TICK_COLOR, callback: pctAxis ? (v: number | string) => `${v}%` : undefined } },
    },
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 print:hidden">
        <div className="h-7 w-0.5 flex-none rounded-full bg-primary" />
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-text-muted">Dashboard</p>
          <h2 className="text-lg font-semibold text-text-primary">{periodoLabel} · {formatMesReferencia(`${filtros.mes}-01`)}</h2>
        </div>
      </div>

      <RelatorioFiltros value={filtros} onChange={setFiltros}>
        {loading && <Loader2 size={18} className="mb-2 animate-spin text-primary" />}
      </RelatorioFiltros>

      {erro && (
        <div className="flex items-center gap-2 rounded-xl border border-status-bad-border bg-status-bad-bg px-4 py-3 text-sm text-status-bad">
          <AlertCircle size={16} />{erro}
        </div>
      )}

      {!rel || rel.resumo.total === 0 ? (
        !loading && (
          <div className="py-16 text-center text-sm text-text-muted">
            {escopoIncompleto(filtros) ? 'Selecione um item do escopo.' : 'Sem dados para os filtros selecionados.'}
          </div>
        )
      ) : (
        <>
          {/* Repasse — só quando calculado */}
          {repasse && (
            <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-md">
              <div className="border-b border-border-subtle bg-surface-alt px-4 py-2.5">
                <p className="text-sm font-medium uppercase tracking-wider text-text-muted">Demonstrativo de Repasse</p>
              </div>
              <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
                <div><p className="text-sm text-text-muted">Repasse Base</p>
                  <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-text-primary">{formatCurrency(repasse.valor_mensal_base)}</p></div>
                <div className="sm:border-x sm:border-border-subtle sm:px-3"><p className="text-sm text-text-muted">Descontos</p>
                  <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-status-bad">−{formatCurrency(repasse.desconto_total)}</p>
                  <p className="mt-0.5 text-xs text-status-bad opacity-70">{repasse.percentual_retido.toFixed(1)}% retido</p></div>
                <div className="sm:text-right"><p className="text-sm text-text-muted">Repasse Final</p>
                  <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-text-primary">{formatCurrency(repasse.repasse_final)}</p></div>
              </div>
            </div>
          )}

          {/* KPIs */}
          <section>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Kpi n={rel.resumo.cumpridos} label="Cumpridos" tom="ok" onClick={() => setCardStatus('cumprido')} />
              <Kpi n={rel.resumo.parciais} label="Parciais" tom="warn" onClick={() => setCardStatus('parcial')} />
              <Kpi n={rel.resumo.naoCumpridos} label="Não cumpridos" tom="bad" onClick={() => setCardStatus('nao_cumprido')} />
              <Kpi n={rel.resumo.aguardando} label="Aguardando" tom="muted" onClick={() => setCardStatus('aguardando')} />
            </div>
            <div className="mt-3 rounded-xl border border-border-subtle bg-surface p-3 shadow-sm">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs text-text-muted">Cumprimento geral · {rel.resumo.total} indicadores</span>
                <span className={`font-mono text-xs font-semibold tabular-nums ${taxaCls(taxa)}`}>{taxa.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-alt">
                <div className={`h-full rounded-full transition-all duration-500 ${taxa >= 85 ? 'bg-status-ok' : taxa >= 70 ? 'bg-status-warn' : 'bg-status-bad'}`} style={{ width: `${Math.min(taxa, 100)}%` }} />
              </div>
            </div>
          </section>

          {/* Tendência */}
          <section>
            <p className="mb-3 text-sm font-medium uppercase tracking-wider text-text-muted">Tendência — últimos 8 meses</p>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border-subtle bg-surface p-3 shadow-sm">
                <h3 className="text-base font-semibold text-text-primary">Produção</h3>
                <p className="mb-3 text-sm text-text-muted">Realizado vs. Meta (quantitativos)</p>
                <div className="h-56"><Line data={trendProducao} options={lineOpts()} /></div>
              </div>
              <div className="rounded-xl border border-border-subtle bg-surface p-3 shadow-sm">
                <h3 className="text-base font-semibold text-text-primary">Taxa de Cumprimento</h3>
                <p className="mb-3 text-sm text-text-muted">% de indicadores cumpridos/mês</p>
                <div className="h-56"><Line data={trendTaxa} options={lineOpts(100, true)} /></div>
              </div>
            </div>
          </section>

          {/* Distribuição + por unidade */}
          <section>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border-subtle bg-surface p-3 shadow-sm">
                <h3 className="text-base font-semibold text-text-primary">Distribuição de Cumprimento</h3>
                <p className="mb-3 text-sm text-text-muted">{rel.resumo.total} indicadores no período</p>
                <div className="mx-auto h-48 w-48"><Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom' as const, labels: { font: { size: 12 }, color: TICK_COLOR } } } }} /></div>
              </div>
              <div className="rounded-xl border border-border-subtle bg-surface p-3 shadow-sm">
                <h3 className="text-base font-semibold text-text-primary">Cumprimento por Unidade</h3>
                <p className="mb-3 text-sm text-text-muted">% de indicadores cumpridos</p>
                {porUnidade.length ? (
                  <div style={{ height: `${Math.max(176, porUnidade.length * 28)}px` }}>
                    <Bar data={barUnidades} options={{
                      responsive: true, maintainAspectRatio: false, indexAxis: 'y' as const,
                      scales: { x: { max: 100, grid: { color: GRID_COLOR }, ticks: { callback: (v: number | string) => `${v}%`, font: { size: 12 }, color: TICK_COLOR } }, y: { grid: { display: false }, ticks: { font: { size: 12 }, color: '#6a7688' } } },
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => `${(ctx.parsed.x ?? 0).toFixed(1)}%` } } },
                    }} />
                  </div>
                ) : <p className="py-8 text-center text-sm text-text-muted">Sem unidades no escopo</p>}
              </div>
            </div>
          </section>
        </>
      )}

      {cardStatus && rel && (
        <IndicadoresDetalheModal
          status={cardStatus}
          contratos={rel.contratos}
          filtros={filtros}
          multiMes={rel.janela.meses > 1}
          onClose={() => setCardStatus(null)}
        />
      )}
    </div>
  )
}

const KPI_TOM: Record<string, string> = {
  ok: 'text-status-ok', warn: 'text-status-warn', bad: 'text-status-bad', muted: 'text-text-muted',
}
function Kpi({ n, label, tom, onClick }: { n: number; label: string; tom: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="rounded-xl border border-border-subtle bg-surface p-3 text-center shadow-sm transition-colors hover:border-primary/40 hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary/40">
      <p className={`font-mono text-2xl font-bold tabular-nums ${KPI_TOM[tom] ?? ''}`}>{formatNumber(n)}</p>
      <p className="mt-0.5 text-xs text-text-muted">{label}</p>
    </button>
  )
}
