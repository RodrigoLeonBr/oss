import { useState, useEffect, useMemo, useCallback } from 'react'
import { CheckCircle, RotateCcw, RefreshCw, Loader2, ShieldCheck, AlertCircle } from 'lucide-react'
import StatusBadge from '../components/ui/StatusBadge'
import { useApi, ApiError } from '../hooks/useApi'
import { usePermission } from '../hooks/usePermission'
import { formatNumber, formatPercent, formatMesReferencia, aprovacaoLabel } from '../lib/formatters'
import type { StatusCumprimento, StatusAprovacao } from '../types'

// ── Tipos da API ──────────────────────────────────────────────────────────────
interface Row {
  acomp_id: string
  mes_referencia: string
  status_aprovacao: StatusAprovacao
  status_cumprimento: string
  valor_realizado?: number | null
  meta_vigente_mensal?: number | null
  meta_vigente_qualit?: number | null
  percentual_cumprimento?: number | null
  indicador?: {
    nome?: string
    codigo?: string
    tipo?: string
    unidade?: { nome?: string; tipo?: string }
  }
}

const SC_CONHECIDOS = ['cumprido', 'parcial', 'nao_cumprido', 'nao_aplicavel', 'aguardando']
const scSafe = (s: string): StatusCumprimento =>
  (SC_CONHECIDOS.includes(s) ? s : 'aguardando') as StatusCumprimento

const mesKey = (ref: string) => (ref || '').slice(0, 7) // "2026-01"
const estaPendente = (s: StatusAprovacao) => s !== 'aprovado'

export default function AprovacaoPage() {
  const { get, put } = useApi()
  const { canUpdate } = usePermission('aprovacao')

  const [dados, setDados] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [mesSel, setMesSel] = useState<string>('')      // "YYYY-MM"
  const [tocado, setTocado] = useState(false)           // usuário já escolheu manualmente?
  const [acaoLoading, setAcaoLoading] = useState(false)

  // ── Carrega todos os acompanhamentos (base para dropdown + detalhe) ─────────
  const fetchDados = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const res = await get<{ data: Row[] } | Row[]>('/acompanhamento-mensal')
      const list = Array.isArray(res) ? res : res.data ?? []
      setDados(list)
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao carregar dados.')
      setDados([])
    } finally {
      setLoading(false)
    }
  }, [get])

  useEffect(() => { fetchDados() }, [fetchDados])

  // ── Resumo por mês ──────────────────────────────────────────────────────────
  const meses = useMemo(() => {
    const map = new Map<string, { total: number; pendentes: number; aprovados: number }>()
    for (const d of dados) {
      const k = mesKey(d.mes_referencia)
      if (!k) continue
      const m = map.get(k) ?? { total: 0, pendentes: 0, aprovados: 0 }
      m.total += 1
      if (estaPendente(d.status_aprovacao)) m.pendentes += 1
      else m.aprovados += 1
      map.set(k, m)
    }
    return [...map.entries()]
      .map(([mes, v]) => ({ mes, ...v }))
      .sort((a, b) => a.mes.localeCompare(b.mes))
  }, [dados])

  // ── Default: mês mais antigo com pendências; senão último aprovado ──────────
  const mesPadrao = useMemo(() => {
    if (meses.length === 0) return ''
    const comPendencia = meses.find(m => m.pendentes > 0)
    if (comPendencia) return comPendencia.mes
    const aprovados = meses.filter(m => m.aprovados > 0)
    return (aprovados.length ? aprovados[aprovados.length - 1] : meses[meses.length - 1]).mes
  }, [meses])

  // Aplica default só enquanto o usuário não escolheu manualmente
  useEffect(() => {
    if (!tocado && mesPadrao) setMesSel(mesPadrao)
  }, [mesPadrao, tocado])

  // ── Linhas do mês selecionado, agrupadas por unidade ────────────────────────
  const linhasMes = useMemo(
    () => dados.filter(d => mesKey(d.mes_referencia) === mesSel),
    [dados, mesSel],
  )
  const resumoMes = useMemo(() => {
    const pend = linhasMes.filter(d => estaPendente(d.status_aprovacao)).length
    const aprov = linhasMes.length - pend
    return { pend, aprov, total: linhasMes.length }
  }, [linhasMes])

  const porUnidade = useMemo(() => {
    const g = new Map<string, Row[]>()
    for (const d of linhasMes) {
      const u = d.indicador?.unidade?.nome ?? 'Sem unidade'
      if (!g.has(u)) g.set(u, [])
      g.get(u)!.push(d)
    }
    return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [linhasMes])

  // ── Ações ────────────────────────────────────────────────────────────────────
  const aplicar = useCallback(async (acao: 'aprovar' | 'revogar', ids: string[]) => {
    if (ids.length === 0) return
    setAcaoLoading(true)
    setErro(null)
    try {
      for (const id of ids) {
        await put(`/acompanhamento-mensal/${id}/${acao}`, {})
      }
      await fetchDados()
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : `Erro ao ${acao}.`)
    } finally {
      setAcaoLoading(false)
    }
  }, [put, fetchDados])

  const aprovarMes = () =>
    aplicar('aprovar', linhasMes.filter(d => estaPendente(d.status_aprovacao)).map(d => d.acomp_id))
  const revogarMes = () =>
    aplicar('revogar', linhasMes.filter(d => d.status_aprovacao === 'aprovado').map(d => d.acomp_id))

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header + dropdown */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Aprovação Auditoria</h2>
            <p className="text-sm text-slate-500">
              {loading ? 'Carregando…'
                : mesSel ? `${formatMesReferencia(mesSel)} · ${resumoMes.pend} pendente(s) · ${resumoMes.aprov} aprovado(s)`
                : 'Nenhum dado para aprovar'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="mes" className="text-sm text-slate-500">Mês/Ano</label>
          <select
            id="mes"
            value={mesSel}
            onChange={e => { setTocado(true); setMesSel(e.target.value) }}
            disabled={loading || meses.length === 0}
            className="rounded-xl border border-border-light bg-surface-light px-3 py-2 text-sm text-slate-900 dark:border-border-dark dark:bg-surface-dark dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {meses.length === 0 && <option value="">—</option>}
            {meses.map(m => (
              <option key={m.mes} value={m.mes}>
                {formatMesReferencia(m.mes)}{m.pendentes > 0 ? ` (${m.pendentes} pend.)` : ' ✓'}
              </option>
            ))}
          </select>
          <button
            onClick={fetchDados}
            disabled={loading}
            aria-label="Recarregar"
            className="rounded-xl border border-border-light bg-surface-light p-2.5 text-slate-500 hover:text-slate-900 dark:border-border-dark dark:bg-surface-dark dark:hover:text-slate-100 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {erro && (
        <div className="flex items-center gap-2 rounded-xl border border-nao-cumprido/30 bg-nao-cumprido/10 px-4 py-3 text-sm text-nao-cumprido">
          <AlertCircle size={16} />{erro}
        </div>
      )}

      {/* Ações de mês */}
      {!loading && mesSel && canUpdate && (resumoMes.pend > 0 || resumoMes.aprov > 0) && (
        <div className="flex flex-wrap items-center gap-3">
          {resumoMes.pend > 0 && (
            <button
              onClick={aprovarMes}
              disabled={acaoLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cumprido px-4 py-2 text-sm font-medium text-white hover:bg-cumprido/90 disabled:opacity-50"
            >
              {acaoLoading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
              Aprovar mês ({resumoMes.pend})
            </button>
          )}
          {resumoMes.aprov > 0 && (
            <button
              onClick={revogarMes}
              disabled={acaoLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-parcial/40 bg-parcial/10 px-4 py-2 text-sm font-medium text-parcial hover:bg-parcial hover:text-white disabled:opacity-50"
            >
              {acaoLoading ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
              Revogar aprovação do mês ({resumoMes.aprov})
            </button>
          )}
        </div>
      )}

      {/* Lista por unidade */}
      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">Carregando acompanhamentos…</div>
      ) : linhasMes.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-400">
          {meses.length === 0 ? 'Nenhum acompanhamento alimentado no banco.' : 'Nenhum dado para o mês selecionado.'}
        </div>
      ) : (
        <div className="space-y-5">
          {porUnidade.map(([unidade, linhas]) => (
            <div key={unidade}>
              <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">{unidade}</h4>
              <div className="overflow-hidden rounded-xl border border-border-light dark:border-border-dark">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Indicador</th>
                      <th className="px-3 py-2 text-right font-medium">Meta</th>
                      <th className="px-3 py-2 text-right font-medium">Realizado</th>
                      <th className="px-3 py-2 text-right font-medium">%</th>
                      <th className="px-3 py-2 text-left font-medium">Cumprimento</th>
                      <th className="px-3 py-2 text-left font-medium">Aprovação</th>
                      <th className="px-3 py-2 text-right font-medium">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((d, i) => {
                      const meta = d.meta_vigente_mensal ?? d.meta_vigente_qualit ?? null
                      const aprovado = d.status_aprovacao === 'aprovado'
                      return (
                        <tr
                          key={d.acomp_id}
                          className={`border-t border-border-light dark:border-border-dark ${i % 2 ? 'bg-slate-50/40 dark:bg-slate-800/20' : ''}`}
                        >
                          <td className="px-3 py-2">
                            <p className="font-medium text-slate-900 dark:text-slate-200">{d.indicador?.nome ?? '—'}</p>
                            <p className="text-xs text-slate-400">{d.indicador?.codigo ?? ''}</p>
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{meta != null ? formatNumber(meta) : '—'}</td>
                          <td className="px-3 py-2 text-right font-mono">{d.valor_realizado != null ? formatNumber(d.valor_realizado) : '—'}</td>
                          <td className="px-3 py-2 text-right font-mono">{d.percentual_cumprimento != null ? formatPercent(d.percentual_cumprimento) : '—'}</td>
                          <td className="px-3 py-2"><StatusBadge status={scSafe(d.status_cumprimento)} /></td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${aprovado ? 'bg-cumprido/10 text-cumprido' : 'bg-parcial/10 text-parcial'}`}>
                              {aprovacaoLabel(d.status_aprovacao)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {canUpdate && (
                              aprovado ? (
                                <button
                                  onClick={() => aplicar('revogar', [d.acomp_id])}
                                  disabled={acaoLoading}
                                  className="inline-flex items-center gap-1 rounded-lg border border-parcial/40 px-2.5 py-1 text-xs font-medium text-parcial hover:bg-parcial hover:text-white disabled:opacity-50"
                                >
                                  <RotateCcw size={13} /> Revogar
                                </button>
                              ) : (
                                <button
                                  onClick={() => aplicar('aprovar', [d.acomp_id])}
                                  disabled={acaoLoading}
                                  className="inline-flex items-center gap-1 rounded-lg border border-cumprido/40 px-2.5 py-1 text-xs font-medium text-cumprido hover:bg-cumprido hover:text-white disabled:opacity-50"
                                >
                                  <CheckCircle size={13} /> Aprovar
                                </button>
                              )
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
