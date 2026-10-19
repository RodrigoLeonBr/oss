import { useEffect, useState } from 'react'
import { useApi } from '../hooks/useApi'

export type Periodo = 'mes' | 'acumulado' | 'trimestre' | 'quadrimestre' | 'ano'
export type Escopo = 'todos' | 'contrato' | 'unidade'

export interface Filtros {
  mes: string            // "YYYY-MM"
  periodo: Periodo
  escopo: Escopo
  contratoId: string
  unidadeId: string
}

export const PERIODOS: { v: Periodo; label: string }[] = [
  { v: 'mes', label: 'Mês' },
  { v: 'acumulado', label: 'Acumulado (ano até o mês)' },
  { v: 'trimestre', label: 'Trimestre (3 meses)' },
  { v: 'quadrimestre', label: 'Quadrimestre (4 meses)' },
  { v: 'ano', label: 'Ano (meta anual cheia)' },
]

export const mesDefault = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Se o escopo exige um alvo (contrato/unidade) ainda não escolhido. */
export const escopoIncompleto = (f: Filtros) =>
  (f.escopo === 'contrato' && !f.contratoId) || (f.escopo === 'unidade' && !f.unidadeId)

/** Monta os query params do backend a partir dos filtros. */
export function toQuery(f: Filtros, extra: Record<string, string> = {}) {
  const p = new URLSearchParams({ mes: `${f.mes}-01`, escopo: f.escopo, ...extra })
  if (f.periodo) p.set('periodo', f.periodo)
  if (f.escopo === 'contrato') p.set('contrato_id', f.contratoId)
  if (f.escopo === 'unidade') p.set('unidade_id', f.unidadeId)
  return p
}

const unwrap = <T,>(raw: unknown): T => {
  if (raw && typeof raw === 'object' && 'data' in raw) return (raw as { data: T }).data
  return raw as T
}

interface Props {
  value: Filtros
  onChange: (f: Filtros) => void
  showPeriodo?: boolean
  children?: React.ReactNode   // ex.: spinner de loading à direita
}

const selectCls = 'rounded-lg border border-border-light bg-surface-light px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-dark'

export default function RelatorioFiltros({ value, onChange, showPeriodo = true, children }: Props) {
  const { get } = useApi()
  const [contratos, setContratos] = useState<{ id: string; label: string }[]>([])
  const [unidades, setUnidades] = useState<{ id: string; label: string }[]>([])

  useEffect(() => {
    get('/contratos')
      .then(r => setContratos(
        (unwrap<{ id: string; numeroContrato?: string; numero?: string }[]>(r) ?? [])
          .map(c => ({ id: c.id, label: c.numeroContrato ?? c.numero ?? c.id })),
      ))
      .catch(() => setContratos([]))
    get('/unidades?ativo=1')
      .then(r => setUnidades(
        (unwrap<{ id: string; nome: string; sigla?: string }[]>(r) ?? [])
          .map(u => ({ id: u.id, label: u.sigla ? `${u.nome} (${u.sigla})` : u.nome })),
      ))
      .catch(() => setUnidades([]))
  }, [get])

  const set = (patch: Partial<Filtros>) => onChange({ ...value, ...patch })

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border-light bg-surface-light p-4 print:hidden dark:border-border-dark dark:bg-surface-dark">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-500">Mês de referência</span>
        <input type="month" value={value.mes} onChange={e => set({ mes: e.target.value })} className={selectCls} />
      </label>

      {showPeriodo && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-500">Período</span>
          <select value={value.periodo} onChange={e => set({ periodo: e.target.value as Periodo })} className={selectCls}>
            {PERIODOS.map(p => <option key={p.v} value={p.v}>{p.label}</option>)}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-500">Escopo</span>
        <select value={value.escopo} onChange={e => set({ escopo: e.target.value as Escopo })} className={selectCls}>
          <option value="todos">Todos os contratos</option>
          <option value="contrato">Por contrato</option>
          <option value="unidade">Por unidade</option>
        </select>
      </label>

      {value.escopo === 'contrato' && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-500">Contrato</span>
          <select value={value.contratoId} onChange={e => set({ contratoId: e.target.value })} className={selectCls}>
            <option value="">Selecione…</option>
            {contratos.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
      )}

      {value.escopo === 'unidade' && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-500">Unidade</span>
          <select value={value.unidadeId} onChange={e => set({ unidadeId: e.target.value })} className={selectCls}>
            <option value="">Selecione…</option>
            {unidades.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </label>
      )}

      {children}
    </div>
  )
}
