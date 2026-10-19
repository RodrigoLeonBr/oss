import { useState, useEffect, useCallback } from 'react'
import { useApi } from '../../hooks/useApi'
import type { Comparacao } from './types'
import { unwrap, fmtNum } from './types'
import type { UnidadeRecord } from '../Unidades/types'

// competência default = mês anterior, formato AAAAMM
function competenciaPadrao(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
}
// <input type="month"> usa AAAA-MM; converte dos dois lados
const toMonthInput = (c: string) => `${c.slice(0, 4)}-${c.slice(4, 6)}`
const fromMonthInput = (m: string) => m.replace('-', '')

export default function PonteProducaoPage() {
  const { get } = useApi()
  const [unidades, setUnidades] = useState<{ id: string; nome: string }[]>([])
  const [unidadeId, setUnidadeId] = useState('')
  const [competencia, setCompetencia] = useState(competenciaPadrao())
  const [data, setData] = useState<Comparacao | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    get<UnidadeRecord[] | { data: UnidadeRecord[] }>('/unidades?ativo=1')
      .then(r => setUnidades(unwrap(r).map(u => ({ id: u.id, nome: u.nome }))))
      .catch(() => setUnidades([]))
  }, [get])

  const comparar = useCallback(async () => {
    if (!unidadeId) return
    setLoading(true); setErro('')
    try {
      const r = await get<Comparacao | { data: Comparacao }>(
        `/ponte-producao?unidadeId=${unidadeId}&competencia=${competencia}`,
      )
      setData(unwrap(r))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao comparar')
      setData(null)
    } finally { setLoading(false) }
  }, [get, unidadeId, competencia])

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-bold text-text-primary">Ponte de Produção</h1>
      <p className="text-sm text-text-muted">
        Compara o informado na prestação com a produção registrada (SIA/SIH). A produção pode ter
        defasagem de competência — ajuste o mês se necessário.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-text-secondary">Unidade</span>
          <select value={unidadeId} onChange={e => setUnidadeId(e.target.value)}
            className="rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm">
            <option value="">Selecione…</option>
            {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-text-secondary">Competência</span>
          <input type="month" value={toMonthInput(competencia)}
            onChange={e => setCompetencia(fromMonthInput(e.target.value))}
            className="rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm" />
        </label>
        <button type="button" onClick={comparar} disabled={!unidadeId || loading}
          className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50">
          {loading ? 'Comparando…' : 'Comparar'}
        </button>
      </div>

      {erro && <p className="rounded-lg bg-status-bad-bg px-4 py-2 text-sm text-status-bad">{erro}</p>}

      {data && (
        <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-md">
          <table className="w-full text-sm" style={{ minWidth: 720 }}>
            <thead className="bg-primary text-white">
              <tr>
                <th className="px-4 py-3 text-left">Indicador</th>
                <th className="px-4 py-3 text-right">Informado</th>
                <th className="px-4 py-3 text-right">Registrado</th>
                <th className="px-4 py-3 text-right">Diferença</th>
                <th className="px-4 py-3 text-right">Divergência</th>
              </tr>
            </thead>
            <tbody>
              {data.linhas.map(l => {
                const alto = l.divergenciaPerc != null && Math.abs(l.divergenciaPerc) > 10
                return (
                  <tr key={l.indicadorId} className="border-b border-border-subtle">
                    <td className="px-4 py-2.5">
                      {l.nome}
                      {l.semMapeamento && (
                        <span className="ml-2 rounded-full bg-surface-alt px-1.5 py-0.5 text-[10px] text-text-muted">
                          sem mapeamento
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmtNum(l.informado)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmtNum(l.registrado)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmtNum(l.diferenca)}</td>
                    <td className={`px-4 py-2.5 text-right font-mono ${alto ? 'font-bold text-status-bad' : ''}`}>
                      {l.divergenciaPerc != null ? `${l.divergenciaPerc.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                )
              })}
              {data.linhas.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  Nenhum indicador quantitativo nesta unidade.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
