import { useState, useMemo } from 'react'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import type { AcompanhamentoMensal, GrupoIndicador } from '../../types'
import { mockIndicadores } from '../../data/mock'
import { formatNumber, formatPercent } from '../../lib/formatters'
import StatusBadge from './StatusBadge'

interface Props {
  dados: AcompanhamentoMensal[]
  onRowClick?: (acomp: AcompanhamentoMensal) => void
}

type SortKey = 'codigo' | 'nome' | 'grupo' | 'meta' | 'realizado' | 'percentual' | 'status'
type SortDir = 'asc' | 'desc'

export default function TabelaIndicadores({ dados, onRowClick }: Props) {
  const [busca, setBusca] = useState('')
  const [filtroGrupo, setFiltroGrupo] = useState<GrupoIndicador | ''>('')
  const [pagina, setPagina] = useState(0)
  const [porPagina, setPorPagina] = useState(10)
  const [sortKey, setSortKey] = useState<SortKey>('codigo')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const enriquecidos = useMemo(() => {
    return dados.map(d => {
      const ind = mockIndicadores.find(i => i.indicador_id === d.indicador_id)
      return { ...d, indicador: ind }
    })
  }, [dados])

  const filtrados = useMemo(() => {
    let result = enriquecidos

    if (filtroGrupo) {
      result = result.filter(d => d.indicador?.grupo === filtroGrupo)
    }
    if (busca) {
      const term = busca.toLowerCase()
      result = result.filter(
        d =>
          d.indicador?.nome.toLowerCase().includes(term) ||
          d.indicador?.codigo.toLowerCase().includes(term),
      )
    }

    result.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'codigo': cmp = (a.indicador?.codigo || '').localeCompare(b.indicador?.codigo || ''); break
        case 'nome': cmp = (a.indicador?.nome || '').localeCompare(b.indicador?.nome || ''); break
        case 'grupo': cmp = (a.indicador?.grupo || '').localeCompare(b.indicador?.grupo || ''); break
        case 'meta': cmp = (a.meta_vigente_mensal ?? 0) - (b.meta_vigente_mensal ?? 0); break
        case 'realizado': cmp = (a.valor_realizado ?? 0) - (b.valor_realizado ?? 0); break
        case 'percentual': cmp = (a.percentual_cumprimento ?? 0) - (b.percentual_cumprimento ?? 0); break
        case 'status': cmp = a.status_cumprimento.localeCompare(b.status_cumprimento); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [enriquecidos, filtroGrupo, busca, sortKey, sortDir])

  const totalPaginas = Math.ceil(filtrados.length / porPagina)
  const paginados = filtrados.slice(pagina * porPagina, (pagina + 1) * porPagina)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown size={14} className="text-slate-400" />
    return sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar indicador..."
            value={busca}
            onChange={e => { setBusca(e.target.value); setPagina(0) }}
            className="w-full rounded-lg border border-border-light bg-surface-light py-2 pl-9 pr-3 text-sm focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-surface-dark dark:text-slate-200"
          />
        </div>
        <select
          value={filtroGrupo}
          onChange={e => { setFiltroGrupo(e.target.value as GrupoIndicador | ''); setPagina(0) }}
          className="rounded-lg border border-border-light bg-surface-light px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-dark dark:text-slate-200"
          aria-label="Filtrar por grupo"
        >
          <option value="">Todos os grupos</option>
          <option value="auditoria_operacional">Auditoria Operacional</option>
          <option value="qualidade_atencao">Qualidade da Atenção</option>
          <option value="transversal">Transversal</option>
          <option value="rh">RH</option>
        </select>
        <select
          value={porPagina}
          onChange={e => { setPorPagina(Number(e.target.value)); setPagina(0) }}
          className="rounded-lg border border-border-light bg-surface-light px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-dark dark:text-slate-200"
          aria-label="Itens por página"
        >
          <option value={10}>10 / pág</option>
          <option value={25}>25 / pág</option>
          <option value={50}>50 / pág</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border-light dark:border-border-dark">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border-light bg-slate-50 dark:border-border-dark dark:bg-slate-800/50">
            <tr>
              {([
                ['codigo', 'Código'],
                ['nome', 'Indicador'],
                ['grupo', 'Grupo'],
                ['meta', 'Meta'],
                ['realizado', 'Realizado'],
                ['percentual', '%'],
                ['status', 'Status'],
              ] as [SortKey, string][]).map(([key, label]) => (
                <th
                  key={key}
                  className="cursor-pointer whitespace-nowrap px-4 py-3 font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                  onClick={() => handleSort(key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {label} <SortIcon col={key} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light dark:divide-border-dark">
            {paginados.map(d => (
              <tr
                key={d.acomp_id}
                className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
                onClick={() => onRowClick?.(d)}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={e => { if (e.key === 'Enter') onRowClick?.(d) }}
              >
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500">
                  {d.indicador?.codigo}
                </td>
                <td className="px-4 py-3 text-slate-900 dark:text-slate-200">
                  {d.indicador?.nome}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {d.indicador?.grupo}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-400">
                  {formatNumber(d.meta_vigente_mensal ?? 0)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-slate-900 dark:text-slate-200">
                  {formatNumber(d.valor_realizado ?? 0)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-bold">
                  {formatPercent(d.percentual_cumprimento ?? 0)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge status={d.status_cumprimento} />
                </td>
              </tr>
            ))}
            {paginados.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Nenhum indicador encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            {filtrados.length} indicador{filtrados.length !== 1 ? 'es' : ''} — Página {pagina + 1} de {totalPaginas}
          </span>
          <div className="flex gap-1">
            <button
              disabled={pagina === 0}
              onClick={() => setPagina(p => p - 1)}
              className="rounded-lg px-3 py-1 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
            >
              Anterior
            </button>
            <button
              disabled={pagina >= totalPaginas - 1}
              onClick={() => setPagina(p => p + 1)}
              className="rounded-lg px-3 py-1 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
