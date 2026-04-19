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
    if (sortKey !== col) return <ChevronsUpDown size={14} className="text-text-faint" />
    return sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar indicador..."
            value={busca}
            onChange={e => { setBusca(e.target.value); setPagina(0) }}
            className="w-full rounded-lg border border-border-subtle bg-surface py-2 pl-9 pr-3 text-sm focus:border-primary focus:ring-primary"
          />
        </div>
        <select
          value={filtroGrupo}
          onChange={e => { setFiltroGrupo(e.target.value as GrupoIndicador | ''); setPagina(0) }}
          className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm"
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
          className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm"
          aria-label="Itens por página"
        >
          <option value={10}>10 / pág</option>
          <option value={25}>25 / pág</option>
          <option value={50}>50 / pág</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border-subtle">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border-subtle bg-surface-alt">
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
                  className="cursor-pointer whitespace-nowrap px-4 py-3 font-medium text-text-muted hover:text-text-primary"
                  onClick={() => handleSort(key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {label} <SortIcon col={key} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {paginados.map(d => (
              <tr
                key={d.acomp_id}
                className={`transition-colors hover:bg-hover ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
                onClick={() => onRowClick?.(d)}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={e => { if (e.key === 'Enter') onRowClick?.(d) }}
              >
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-text-muted">
                  {d.indicador?.codigo}
                </td>
                <td className="px-4 py-3 text-text-primary">
                  {d.indicador?.nome}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {d.indicador?.grupo}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-text-secondary">
                  {formatNumber(d.meta_vigente_mensal ?? 0)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-text-primary">
                  {formatNumber(d.valor_realizado ?? 0)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-bold text-text-primary">
                  {formatPercent(d.percentual_cumprimento ?? 0)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge status={d.status_cumprimento} />
                </td>
              </tr>
            ))}
            {paginados.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                  Nenhum indicador encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between text-sm text-text-muted">
          <span>
            {filtrados.length} indicador{filtrados.length !== 1 ? 'es' : ''} — Página {pagina + 1} de {totalPaginas}
          </span>
          <div className="flex gap-1">
            <button
              disabled={pagina === 0}
              onClick={() => setPagina(p => p - 1)}
              className="rounded-lg px-3 py-1 hover:bg-hover disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              disabled={pagina >= totalPaginas - 1}
              onClick={() => setPagina(p => p + 1)}
              className="rounded-lg px-3 py-1 hover:bg-hover disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
