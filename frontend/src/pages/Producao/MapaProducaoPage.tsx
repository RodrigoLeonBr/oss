import { useState, useEffect, useCallback } from 'react'
import { useApi } from '../../hooks/useApi'
import { usePermission } from '../../hooks/usePermission'
import type { MapaRecord, MapaFormData, TipoFiltro, FonteProducao } from './types'
import { unwrap, TIPO_FILTRO_LABEL, COMPRIMENTO_FILTRO } from './types'
import type { UnidadeRecord } from '../Unidades/types'

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
  const { get, post, put, del } = useApi()
  const { canInsert, canUpdate, canDelete } = usePermission('relatorios')

  const [unidades, setUnidades] = useState<{ id: string; nome: string }[]>([])
  const [unidadeId, setUnidadeId] = useState('')
  const [indicadores, setIndicadores] = useState<IndicadorOpt[]>([])
  const [lista, setLista] = useState<MapaRecord[]>([])
  const [form, setForm] = useState<MapaFormData>({ indicadorId: '', fonte: 'sia', tipoFiltro: 'grupo', valorFiltro: '', cbo: '' })
  const [editId, setEditId] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  const EMPTY: MapaFormData = { indicadorId: '', fonte: 'sia', tipoFiltro: 'grupo', valorFiltro: '', cbo: '' }

  const cancelarEdicao = useCallback(() => { setEditId(null); setForm(EMPTY); setErro('') }, [])

  const editar = useCallback((m: MapaRecord) => {
    setEditId(m.mapa_id)
    setErro('')
    setForm({
      indicadorId: m.indicador_id,
      fonte: m.fonte,
      tipoFiltro: m.tipo_filtro,
      valorFiltro: m.valor_filtro,
      cbo: m.cbo ?? '',
    })
  }, [])

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

  const salvar = useCallback(async () => {
    setErro('')
    const len = COMPRIMENTO_FILTRO[form.tipoFiltro]
    if (!/^\d+$/.test(form.valorFiltro) || form.valorFiltro.length !== len) {
      setErro(`Valor deve ter ${len} dígitos para ${form.tipoFiltro}`); return
    }
    if (form.cbo && !/^\d{4}$|^\d{6}$/.test(form.cbo)) {
      setErro('CBO deve ter 4 (família) ou 6 (ocupação) dígitos'); return
    }
    try {
      if (editId) {
        // indicador não muda na edição (PUT não aceita indicadorId)
        await put(`/mapa-producao/${editId}`, {
          fonte: form.fonte, tipoFiltro: form.tipoFiltro, valorFiltro: form.valorFiltro, cbo: form.cbo || null,
        })
        setEditId(null)
        setForm(EMPTY)
      } else {
        await post('/mapa-producao', form)
        setForm({ ...form, valorFiltro: '', cbo: '' })
      }
      await carregar(unidadeId)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao salvar') }
  }, [form, editId, post, put, carregar, unidadeId])

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

      <SelectField label="Unidade" value={unidadeId} onChange={setUnidadeId}>
        <option value="">Selecione…</option>
        {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
      </SelectField>

      {unidadeId && (canInsert || editId) && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border-subtle bg-surface p-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text-secondary">Indicador</span>
            <select value={form.indicadorId} disabled={!!editId}
              onChange={e => setForm({ ...form, indicadorId: e.target.value })}
              className="rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm disabled:opacity-60">
              <option value="">Selecione…</option>
              {indicadores.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
            </select>
          </label>
          <SelectField label="Fonte" value={form.fonte} onChange={v => setForm({ ...form, fonte: v as FonteProducao })}>
            <option value="sia">SIA (ambulatorial)</option>
            <option value="sih">SIH (internação)</option>
          </SelectField>
          <SelectField label="Tipo" value={form.tipoFiltro} onChange={v => setForm({ ...form, tipoFiltro: v as TipoFiltro })}>
            {(Object.keys(TIPO_FILTRO_LABEL) as TipoFiltro[]).map(t =>
              <option key={t} value={t}>{TIPO_FILTRO_LABEL[t]}</option>)}
          </SelectField>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text-secondary">Código ({COMPRIMENTO_FILTRO[form.tipoFiltro]} díg)</span>
            <input value={form.valorFiltro} inputMode="numeric"
              onChange={e => setForm({ ...form, valorFiltro: e.target.value.replace(/\D/g, '') })}
              maxLength={COMPRIMENTO_FILTRO[form.tipoFiltro]}
              className="rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm font-mono" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text-secondary">CBO (opc., 4 ou 6 díg)</span>
            <input value={form.cbo} inputMode="numeric"
              onChange={e => setForm({ ...form, cbo: e.target.value.replace(/\D/g, '').slice(0, 6) })}
              maxLength={6} placeholder="ex: 2235 ou 223505"
              className="rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm font-mono" />
          </label>
          <button type="button" onClick={salvar} disabled={!form.indicadorId}
            className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50">
            {editId ? 'Salvar edição' : 'Adicionar'}
          </button>
          {editId && (
            <button type="button" onClick={cancelarEdicao}
              className="rounded-xl border border-border-subtle px-5 py-2 text-sm font-semibold text-text-secondary hover:bg-hover">
              Cancelar
            </button>
          )}
        </div>
      )}

      {erro && <p className="rounded-lg bg-status-bad-bg px-4 py-2 text-sm text-status-bad">{erro}</p>}

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
                        <button type="button" onClick={() => editar(m)}
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
    </div>
  )
}
