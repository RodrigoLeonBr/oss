import { useState, useEffect } from 'react'
import { X, Workflow, Loader2, AlertCircle } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import type { MapaRecord, MapaFormData, TipoFiltro, FonteProducao } from './types'
import { TIPO_FILTRO_LABEL, COMPRIMENTO_FILTRO } from './types'

interface IndicadorOpt { id: string; nome: string }

interface Props {
  /** undefined → criação; MapaRecord → edição (indicador não muda) */
  registro?: MapaRecord
  indicadores: IndicadorOpt[]
  onSalvo: () => void
  onFechar: () => void
}

const EMPTY: MapaFormData = { indicadorId: '', fonte: 'sia', tipoFiltro: 'grupo', valorFiltro: '', cbo: '' }

const inputCls =
  'w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary'

export default function MapaProducaoFormModal({ registro, indicadores, onSalvo, onFechar }: Props) {
  const { post, put } = useApi()
  const isEdit = Boolean(registro)

  const [form, setForm] = useState<MapaFormData>(() =>
    registro
      ? {
          indicadorId: registro.indicador_id,
          fonte: registro.fonte,
          tipoFiltro: registro.tipo_filtro,
          valorFiltro: registro.valor_filtro,
          cbo: registro.cbo ?? '',
        }
      : EMPTY,
  )
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', handler); document.body.style.overflow = '' }
  }, [onFechar])

  function set<K extends keyof MapaFormData>(k: K, v: MapaFormData[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
    setErro('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const len = COMPRIMENTO_FILTRO[form.tipoFiltro]
    if (!/^\d+$/.test(form.valorFiltro) || form.valorFiltro.length !== len) {
      setErro(`Código deve ter ${len} dígitos para ${TIPO_FILTRO_LABEL[form.tipoFiltro]}`); return
    }
    if (form.cbo && !/^\d{4}$|^\d{6}$/.test(form.cbo)) {
      setErro('CBO deve ter 4 (família) ou 6 (ocupação) dígitos'); return
    }
    setLoading(true)
    try {
      if (isEdit && registro) {
        // indicador não muda na edição (PUT não aceita indicadorId)
        await put(`/mapa-producao/${registro.mapa_id}`, {
          fonte: form.fonte, tipoFiltro: form.tipoFiltro, valorFiltro: form.valorFiltro, cbo: form.cbo || null,
        })
      } else {
        await post('/mapa-producao', form)
      }
      onSalvo()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog" aria-modal="true" aria-labelledby="mapa-modal-title">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-2xl"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Workflow size={20} />
            </div>
            <div>
              <h2 id="mapa-modal-title" className="text-base font-semibold text-text-primary">
                {isEdit ? 'Editar mapeamento' : 'Novo mapeamento'}
              </h2>
              <p className="text-xs text-text-muted">Liga o indicador a um filtro SIGTAP</p>
            </div>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar"
            className="rounded-lg p-1.5 text-text-faint transition-colors hover:bg-hover hover:text-text-secondary">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4 px-6 py-5">
            {erro && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-status-bad-border bg-status-bad-bg px-3 py-2 text-sm text-status-bad">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{erro}</span>
              </div>
            )}

            <div>
              <label htmlFor="mapa-indicador" className="mb-1 block text-sm font-medium text-text-secondary">Indicador</label>
              <select id="mapa-indicador" value={form.indicadorId} disabled={isEdit}
                onChange={e => set('indicadorId', e.target.value)}
                className={`${inputCls} disabled:opacity-60`}>
                <option value="">Selecione…</option>
                {indicadores.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="mapa-fonte" className="mb-1 block text-sm font-medium text-text-secondary">Fonte</label>
                <select id="mapa-fonte" value={form.fonte}
                  onChange={e => set('fonte', e.target.value as FonteProducao)} className={inputCls}>
                  <option value="sia">SIA (ambulatorial)</option>
                  <option value="sih">SIH (internação)</option>
                </select>
              </div>
              <div>
                <label htmlFor="mapa-tipo" className="mb-1 block text-sm font-medium text-text-secondary">Tipo de filtro</label>
                <select id="mapa-tipo" value={form.tipoFiltro}
                  onChange={e => set('tipoFiltro', e.target.value as TipoFiltro)} className={inputCls}>
                  {(Object.keys(TIPO_FILTRO_LABEL) as TipoFiltro[]).map(t =>
                    <option key={t} value={t}>{TIPO_FILTRO_LABEL[t]}</option>)}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="mapa-codigo" className="mb-1 block text-sm font-medium text-text-secondary">
                  Código ({COMPRIMENTO_FILTRO[form.tipoFiltro]} díg)
                </label>
                <input id="mapa-codigo" value={form.valorFiltro} inputMode="numeric"
                  onChange={e => set('valorFiltro', e.target.value.replace(/\D/g, ''))}
                  maxLength={COMPRIMENTO_FILTRO[form.tipoFiltro]}
                  className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label htmlFor="mapa-cbo" className="mb-1 block text-sm font-medium text-text-secondary">CBO (opcional)</label>
                <input id="mapa-cbo" value={form.cbo} inputMode="numeric"
                  onChange={e => set('cbo', e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6} placeholder="ex: 2235 ou 223505"
                  className={`${inputCls} font-mono`} />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-border-subtle px-6 py-4">
            <button type="button" onClick={onFechar} disabled={loading}
              className="rounded-xl px-5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-hover disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading || !form.indicadorId}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {isEdit ? 'Salvar alterações' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
