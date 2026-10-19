import { useState, useEffect, useCallback, useMemo } from 'react'
import { FileDown, FileSpreadsheet, Printer, Loader2, AlertCircle } from 'lucide-react'
import StatusBadge from '../components/ui/StatusBadge'
import RelatorioFiltros, {
  type Filtros, PERIODOS, mesDefault, toQuery, escopoIncompleto,
} from '../components/RelatorioFiltros'
import { useApi, ApiError } from '../hooks/useApi'
import { formatNumber, formatPercent, formatMesReferencia } from '../lib/formatters'
import type { StatusCumprimento } from '../types'

// ── Tipos da resposta /relatorios/cms ───────────────────────────────────────────
interface Linha {
  indicadorId: string
  codigo: string
  nome: string
  tipo: 'quantitativo' | 'qualitativo'
  grupo: string
  unidadeMedida: string | null
  metaBase: number | null
  metaPeriodo: number | null
  realizadoAcum: number
  mesesComLancamento: number
  percentual: number | null
  status: StatusCumprimento
  faixa: string | null
}
interface UnidadeRel {
  unidadeId: string
  nome: string
  sigla: string
  tipo: string
  quantitativos: Linha[]
  qualitativos: Linha[]
}
interface ContratoRel {
  contratoId: string
  numero: string
  valorMensalBase: number
  unidades: UnidadeRel[]
}
interface Relatorio {
  periodo: string
  janela: { inicio: string; fim: string; meses: number; anual: boolean }
  resumo: { cumpridos: number; parciais: number; naoCumpridos: number; aguardando: number; total: number }
  contratos: ContratoRel[]
}

const unwrap = <T,>(raw: unknown): T => {
  if (raw && typeof raw === 'object' && 'data' in raw) return (raw as { data: T }).data
  return raw as T
}

export default function RelatoriosCMSPage() {
  const { get } = useApi()

  const [filtros, setFiltros] = useState<Filtros>({
    mes: '', periodo: 'mes', escopo: 'todos', contratoId: '', unidadeId: '',
  })
  const [rel, setRel] = useState<Relatorio | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Default = último mês com lançamento
  useEffect(() => {
    get<{ data: { mes: string | null } } | { mes: string | null }>('/relatorios/ultimo-mes')
      .then(r => {
        const m = unwrap<{ mes: string | null }>(r)?.mes
        setFiltros(f => ({ ...f, mes: m ? m.slice(0, 7) : mesDefault() }))
      })
      .catch(() => setFiltros(f => ({ ...f, mes: mesDefault() })))
  }, [get])

  const fetchRel = useCallback(async () => {
    if (!filtros.mes || escopoIncompleto(filtros)) { setRel(null); return }
    setLoading(true)
    setErro(null)
    try {
      const r = await get<{ data: Relatorio } | Relatorio>(`/relatorios/cms?${toQuery(filtros)}`)
      setRel(unwrap<Relatorio>(r))
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao gerar relatório.')
      setRel(null)
    } finally {
      setLoading(false)
    }
  }, [get, filtros])

  useEffect(() => { fetchRel() }, [fetchRel])

  const todasLinhas = useMemo(
    () => (rel?.contratos ?? []).flatMap(c => c.unidades.flatMap(u => [...u.quantitativos, ...u.qualitativos]
      .map(l => ({ ...l, contrato: c.numero, unidade: u.nome })))),
    [rel],
  )

  const handleExportExcel = () => {
    const headers = ['Contrato', 'Unidade', 'Código', 'Indicador', 'Tipo', 'Meta período', 'Realizado', '%', 'Status']
    const rows = todasLinhas.map(l => [
      l.contrato, l.unidade, l.codigo, l.nome, l.tipo,
      l.metaPeriodo ?? '', l.realizadoAcum,
      l.percentual != null ? `${l.percentual.toFixed(1)}%` : '',
      l.status,
    ].join('\t'))
    const tsv = [headers.join('\t'), ...rows].join('\n')
    const url = URL.createObjectURL(new Blob([tsv], { type: 'text/tab-separated-values' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-cms-${filtros.mes}-${filtros.periodo}.tsv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const periodoLabel = PERIODOS.find(p => p.v === filtros.periodo)?.label ?? filtros.periodo
  const janelaTxt = rel
    ? (rel.janela.meses === 1
      ? formatMesReferencia(rel.janela.inicio)
      : `${formatMesReferencia(rel.janela.inicio)} – ${formatMesReferencia(rel.janela.fim)}`)
    : ''

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Relatório CMS</h2>
          <p className="text-sm text-slate-500">Pauta para o Conselho Municipal de Saúde</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-border-light px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-border-dark dark:text-slate-300 dark:hover:bg-slate-800">
            <FileDown size={16} />PDF
          </button>
          <button onClick={handleExportExcel} className="inline-flex items-center gap-2 rounded-lg border border-border-light px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-border-dark dark:text-slate-300 dark:hover:bg-slate-800">
            <FileSpreadsheet size={16} />Excel
          </button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-border-light px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-border-dark dark:text-slate-300 dark:hover:bg-slate-800">
            <Printer size={16} />Imprimir
          </button>
        </div>
      </div>

      <RelatorioFiltros value={filtros} onChange={setFiltros}>
        {loading && <Loader2 size={18} className="mb-2 animate-spin text-primary" />}
      </RelatorioFiltros>

      {erro && (
        <div className="flex items-center gap-2 rounded-xl border border-nao-cumprido/30 bg-nao-cumprido/10 px-4 py-3 text-sm text-nao-cumprido print:hidden">
          <AlertCircle size={16} />{erro}
        </div>
      )}

      {rel && rel.resumo.total > 0 ? (
        <div className="space-y-6 rounded-xl border border-border-light bg-surface-light p-6 print:border-0 print:p-0 dark:border-border-dark dark:bg-surface-dark">
          <div className="border-b border-border-light pb-4 text-center dark:border-border-dark">
            <h3 className="text-lg font-bold text-primary">PAUTA — CONSELHO MUNICIPAL DE SAÚDE</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">{periodoLabel} · {janelaTxt}</p>
            <p className="text-xs text-slate-500">Secretaria Municipal de Saúde — Americana/SP</p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">Conformidade dos Indicadores</h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Resumo n={rel.resumo.cumpridos} total={rel.resumo.total} label="Cumpridos" tom="cumprido" />
              <Resumo n={rel.resumo.parciais} total={rel.resumo.total} label="Parciais" tom="parcial" />
              <Resumo n={rel.resumo.naoCumpridos} total={rel.resumo.total} label="Não Cumpridos" tom="nao-cumprido" />
              <Resumo n={rel.resumo.aguardando} total={rel.resumo.total} label="Aguardando" tom="na" />
            </div>
          </div>

          {rel.contratos.map(c => (
            <div key={c.contratoId}>
              <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">Contrato {c.numero}</h4>
              {c.unidades.map(u => (
                <div key={u.unidadeId} className="mb-4">
                  <h5 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">{u.nome}</h5>
                  {(['quantitativos', 'qualitativos'] as const).map(secao => (
                    u[secao].length > 0 && (
                      <Tabela key={secao}
                        titulo={secao === 'quantitativos' ? 'Produção (quantitativo)' : 'Qualidade (qualitativo)'}
                        linhas={u[secao]} />
                    )
                  ))}
                </div>
              ))}
            </div>
          ))}

          <div className="border-t border-border-light pt-4 text-center text-xs text-slate-500 dark:border-border-dark">
            <p>Documento gerado automaticamente pelo Sistema OSS Saúde Americana</p>
            <p className="mt-1">Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
          </div>
        </div>
      ) : !loading && (
        <div className="py-16 text-center text-sm text-slate-400">
          {escopoIncompleto(filtros) ? 'Selecione um item do escopo.' : 'Nenhum indicador para os filtros selecionados.'}
        </div>
      )}
    </div>
  )
}

const TOM: Record<string, { box: string; num: string }> = {
  cumprido: { box: 'border-cumprido/30 bg-cumprido/5', num: 'text-cumprido' },
  parcial: { box: 'border-parcial/30 bg-parcial/5', num: 'text-parcial' },
  'nao-cumprido': { box: 'border-nao-cumprido/30 bg-nao-cumprido/5', num: 'text-nao-cumprido' },
  na: { box: 'border-na/30 bg-na/5', num: 'text-na' },
}

function Resumo({ n, total, label, tom }: { n: number; total: number; label: string; tom: string }) {
  const pct = total > 0 ? (n / total) * 100 : 0
  const c = TOM[tom] ?? TOM.na
  return (
    <div className={`rounded-lg border p-3 text-center ${c.box}`}>
      <p className={`text-2xl font-bold ${c.num}`}>{n}</p>
      <p className="text-xs text-slate-600 dark:text-slate-400">{label} ({formatPercent(pct)})</p>
    </div>
  )
}

function Tabela({ titulo, linhas }: { titulo: string; linhas: Linha[] }) {
  return (
    <div className="mb-3 overflow-x-auto">
      <p className="mb-1 text-xs font-medium text-slate-500">{titulo}</p>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border-light dark:border-border-dark">
            <th className="px-2 py-2 font-medium text-slate-600 dark:text-slate-400">Código</th>
            <th className="px-2 py-2 font-medium text-slate-600 dark:text-slate-400">Indicador</th>
            <th className="px-2 py-2 text-right font-medium text-slate-600 dark:text-slate-400">Meta período</th>
            <th className="px-2 py-2 text-right font-medium text-slate-600 dark:text-slate-400">Realizado</th>
            <th className="px-2 py-2 text-right font-medium text-slate-600 dark:text-slate-400">%</th>
            <th className="px-2 py-2 font-medium text-slate-600 dark:text-slate-400">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-light dark:divide-border-dark">
          {linhas.map(l => (
            <tr key={l.indicadorId}>
              <td className="px-2 py-1.5 font-mono text-slate-500">{l.codigo}</td>
              <td className="px-2 py-1.5 text-slate-900 dark:text-slate-200">
                {l.nome}
                {l.mesesComLancamento === 0 && <span className="ml-1 text-[10px] text-na">(sem lançamento)</span>}
              </td>
              <td className="px-2 py-1.5 text-right font-mono text-slate-600 dark:text-slate-400">{l.metaPeriodo != null ? formatNumber(l.metaPeriodo) : '—'}</td>
              <td className="px-2 py-1.5 text-right font-mono text-slate-900 dark:text-slate-200">{formatNumber(l.realizadoAcum)}</td>
              <td className="px-2 py-1.5 text-right font-mono font-bold">{l.percentual != null ? formatPercent(l.percentual) : '—'}</td>
              <td className="px-2 py-1.5"><StatusBadge status={l.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
