import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { usePermission } from '../../hooks/usePermission'
import type { MapaRecord } from './types'
import { unwrap } from './types'
import type { UnidadeRecord } from '../Unidades/types'
import MapaProducaoFormModal from './MapaProducaoFormModal'

interface IndicadorOpt { id: string; nome: string }

function SelectField(props: {
  label: string; value: string; onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-text-secondary">{props.label}</span>
      <select value={props.value} onChange={e => props.onChange(e.target.value)}
        className="rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm">
        {props.children}
      </select>
    </label>
  )
}

export default function MapaProducaoPage() {
  const { get, del } = useApi()
  const { canInsert, canUpdate, canDelete } = usePermission('relatorios')

  const [unidades, setUnidades] = useState<{ id: string; nome: string }[]>([])
  const [unidadeId, setUnidadeId] = useState('')
  const [indicadores, setIndicadores] = useState<IndicadorOpt[]>([])
  const [lista, setLista] = useState<MapaRecord[]>([])
  // null = modal fechado; { registro: undefined } = criação; { registro } = edição
  const [modal, setModal] = useState<{ registro?: MapaRecord } | null>(null)

  useEffect(() => {
    get<UnidadeRecord[] | { data: UnidadeRecord[] }>('/unidades?ativo=1')
      .then(r => setUnidades(unwrap(r).map(u => ({ id: u.id, nome: u.nome }))))
      .catch(() => setUnidades([]))
  }, [get])

  const carregar = useCallback(async (uId: string) => {
    if (!uId) { setIndicadores([]); setLista([]); return }
    const ri = await get<IndicadorOpt[] | { data: IndicadorOpt[] }>(`/indicadores?unidadeId=${uId}`)
    setIndicadores(unwrap(ri).map((i: { id: string; nome: string }) => ({ id: i.id, nome: i.nome })))
    const rm = await get<MapaRecord[] | { data: MapaRecord[] }>(`/mapa-producao?unidadeId=${uId}`)
    setLista(unwrap(rm))
  }, [get])

  useEffect(() => { void carregar(unidadeId) }, [unidadeId, carregar])

  const remover = useCallback(async (id: string) => {
    await del(`/mapa-producao/${id}`)
    setLista(prev => prev.filter(m => m.mapa_id !== id))
  }, [del])

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-bold text-text-primary">Mapa de Produção</h1>
      <p className="text-sm text-text-muted">
        Liga cada indicador quantitativo a um ou mais filtros SIGTAP (grupo/subgrupo/forma/procedimento)
        para somar a produção registrada. Filtros que se sobrepõem somam em dobro — evite.
      </p>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <SelectField label="Unidade" value={unidadeId} onChange={setUnidadeId}>
          <option value="">Selecione…</option>
          {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </SelectField>
        {unidadeId && canInsert && (
          <button type="button" onClick={() => setModal({})}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark">
            <Plus size={16} /> Adicionar mapeamento
          </button>
        )}
      </div>

      {unidadeId && (
        <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-md">
          <table className="w-full text-sm" style={{ minWidth: 640 }}>
            <thead className="bg-primary text-white">
              <tr>
                <th className="px-4 py-3 text-left">Indicador</th>
                <th className="px-4 py-3 text-left">Fonte</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Código</th>
                <th className="px-4 py-3 text-left">CBO</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {lista.map(m => (
                <tr key={m.mapa_id} className="border-b border-border-subtle">
                  <td className="px-4 py-2.5">{m.indicador?.nome ?? m.indicador_id}</td>
                  <td className="px-4 py-2.5 uppercase">{m.fonte}</td>
                  <td className="px-4 py-2.5">{m.tipo_filtro}</td>
                  <td className="px-4 py-2.5 font-mono">{m.valor_filtro}</td>
                  <td className="px-4 py-2.5 font-mono">{m.cbo || '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      {canUpdate && (
                        <button type="button" onClick={() => setModal({ registro: m })}
                          className="rounded-lg px-2 py-1 text-xs text-primary hover:bg-primary/10">Editar</button>
                      )}
                      {canDelete && (
                        <button type="button" onClick={() => remover(m.mapa_id)}
                          className="rounded-lg px-2 py-1 text-xs text-status-bad hover:bg-status-bad-bg">Remover</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {lista.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-text-muted">Nenhum mapeamento.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <MapaProducaoFormModal
          registro={modal.registro}
          indicadores={indicadores}
          onFechar={() => setModal(null)}
          onSalvo={() => { setModal(null); void carregar(unidadeId) }}
        />
      )}
    </div>
  )
}
