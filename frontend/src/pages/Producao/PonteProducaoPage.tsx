import { useState, useEffect, useCallback, useMemo } from 'react'
import { FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react'
import RelatorioFiltros, {
  type Filtros, PERIODOS, mesDefault, toQuery, escopoIncompleto,
} from '../../components/RelatorioFiltros'
import { useApi, ApiError } from '../../hooks/useApi'
import type { ConfrontoPeriodo, LinhaConfronto } from './types'
import { unwrap, fmtNum } from './types'

const fmtMes = (ymd: string) => {
  const [y, m] = ymd.split('-')
  return `${m}/${y}`
}

function celDiverg(l: LinhaConfronto) {
  if (l.divergenciaPerc == null) return <span className="text-text-faint">—</span>
  const alto = Math.abs(l.divergenciaPerc) > 10
  return <span className={alto ? 'font-bold text-status-bad' : ''}>{l.divergenciaPerc.toFixed(1)}%</span>
}

export default function PonteProducaoPage() {
  const { get } = useApi()
  const [filtros, setFiltros] = useState<Filtros>({
    mes: '', periodo: 'mes', escopo: 'todos', contratoId: '', unidadeId: '',
  })
  const [data, setData] = useState<ConfrontoPeriodo | null>(null)
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

  const fetchData = useCallback(async () => {
    if (!filtros.mes || escopoIncompleto(filtros)) { setData(null); return }
    setLoading(true); setErro(null)
    try {
      const r = await get<{ data: ConfrontoPeriodo } | ConfrontoPeriodo>(
        `/ponte-producao/periodo?${toQuery(filtros)}`,
      )
      setData(unwrap<ConfrontoPeriodo>(r))
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao gerar confronto.')
      setData(null)
    } finally { setLoading(false) }
  }, [get, filtros])

  useEffect(() => { fetchData() }, [fetchData])

  const linhasFlat = useMemo(
    () => (data?.contratos ?? []).flatMap(c => c.unidades.flatMap(u =>
      u.linhas.map(l => ({ ...l, contrato: c.numero, unidade: u.nome })))),
    [data],
  )

  const exportarExcel = () => {
    const head = ['Contrato', 'Unidade', 'Código', 'Indicador', 'Informado', 'Apurado', 'Diferença', 'Divergência %']
    const rows = linhasFlat.map(l => [
      l.contrato, l.unidade, l.codigo, l.nome,
      l.informado ?? '', l.registrado ?? '', l.diferenca ?? '',
      l.divergenciaPerc != null ? l.divergenciaPerc.toFixed(1) : '',
    ].join('\t'))
    const tsv = [head.join('\t'), ...rows].join('\n')
    const url = URL.createObjectURL(new Blob([tsv], { type: 'text/tab-separated-values' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `confronto-producao-${filtros.mes}-${filtros.periodo}.tsv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const periodoLabel = PERIODOS.find(p => p.v === filtros.periodo)?.label ?? filtros.periodo
  const janelaTxt = data
    ? (data.janela.meses === 1 ? fmtMes(data.janela.inicio)
      : `${fmtMes(data.janela.inicio)} – ${fmtMes(data.janela.fim)}`)
    : ''

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Confronto de Produção</h1>
          <p className="text-sm text-text-muted">
            Apresentado na prestação de contas × apurado no faturamento (SIA/SIH). Produção pode ter
            defasagem de competência.
          </p>
        </div>
        {data && linhasFlat.length > 0 && (
          <button type="button" onClick={exportarExcel}
            className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm font-medium text-text-secondary hover:bg-hover">
            <FileSpreadsheet size={16} />Excel
          </button>
        )}
      </div>

      <RelatorioFiltros value={filtros} onChange={setFiltros}>
        {loading && <Loader2 size={18} className="mb-2 animate-spin text-primary" />}
      </RelatorioFiltros>

      {erro && (
        <div className="flex items-center gap-2 rounded-xl border border-status-bad-border bg-status-bad-bg px-4 py-3 text-sm text-status-bad">
          <AlertCircle size={16} />{erro}
        </div>
      )}

      {data && (
        <>
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm">
            <span className="text-text-muted">{periodoLabel} · {janelaTxt}</span>
            <span className="ml-auto">Informado: <strong className="font-mono">{fmtNum(data.totais.informado)}</strong></span>
            <span>Apurado: <strong className="font-mono">{fmtNum(data.totais.registrado)}</strong></span>
            <span>Diferença: <strong className={`font-mono ${data.totais.diferenca !== 0 ? 'text-status-bad' : ''}`}>{fmtNum(data.totais.diferenca)}</strong></span>
          </div>

          {data.contratos.length === 0 && !loading && (
            <div className="py-16 text-center text-sm text-text-muted">
              {escopoIncompleto(filtros) ? 'Selecione um item do escopo.' : 'Nenhum indicador quantitativo no escopo.'}
            </div>
          )}

          {data.contratos.map(c => (
            <div key={c.contratoId} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">Contrato {c.numero}</h2>
              {c.unidades.map(u => (
                <div key={u.unidadeId} className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-sm">
                  <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
                    <span className="text-sm font-semibold text-text-primary">{u.nome}</span>
                    <span className="text-xs text-text-muted">
                      {u.semCnes ? 'sem CNES — apurado indisponível' : `CNES ${u.cnes}`}
                    </span>
                  </div>
                  <table className="w-full text-sm" style={{ minWidth: 760 }}>
                    <thead className="bg-primary/5 text-text-secondary">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Código</th>
                        <th className="px-4 py-2 text-left font-medium">Indicador</th>
                        <th className="px-4 py-2 text-right font-medium">Informado</th>
                        <th className="px-4 py-2 text-right font-medium">Apurado</th>
                        <th className="px-4 py-2 text-right font-medium">Diferença</th>
                        <th className="px-4 py-2 text-right font-medium">Divergência</th>
                      </tr>
                    </thead>
                    <tbody>
                      {u.linhas.map(l => (
                        <tr key={l.indicadorId} className="border-b border-border-subtle">
                          <td className="px-4 py-2 font-mono text-text-muted">{l.codigo}</td>
                          <td className="px-4 py-2">
                            {l.nome}
                            {l.semMapeamento && (
                              <span className="ml-2 rounded-full bg-surface-alt px-1.5 py-0.5 text-[10px] text-text-muted">sem mapeamento</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right font-mono">{fmtNum(l.informado)}</td>
                          <td className="px-4 py-2 text-right font-mono">{fmtNum(l.registrado)}</td>
                          <td className="px-4 py-2 text-right font-mono">{fmtNum(l.diferenca)}</td>
                          <td className="px-4 py-2 text-right font-mono">{celDiverg(l)}</td>
                        </tr>
                      ))}
                      <tr className="bg-surface-alt/40 font-semibold">
                        <td className="px-4 py-2" />
                        <td className="px-4 py-2 text-right text-text-muted">Subtotal</td>
                        <td className="px-4 py-2 text-right font-mono">{fmtNum(u.subtotais.informado)}</td>
                        <td className="px-4 py-2 text-right font-mono">{fmtNum(u.subtotais.registrado)}</td>
                        <td className="px-4 py-2 text-right font-mono">{fmtNum(u.subtotais.diferenca)}</td>
                        <td className="px-4 py-2" />
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
