// frontend/src/pages/EntradaMensal/EntradaMensalModal.tsx
import { useState, useEffect, useRef } from 'react'
import { X, Target, AlertCircle, Loader2 } from 'lucide-react'
import type { AcompanhamentoRecord } from './types'
import { STATUS_LABELS, STATUS_BADGE, calcularStatusPreview, unwrap } from './types'
import { useApi, ApiError } from '../../hooks/useApi'

interface Props {
  acompanhamento: AcompanhamentoRecord
  onSalvo: (atualizado: AcompanhamentoRecord) => void
  onFechar: () => void
}

interface FieldProps {
  id: string; label: string; required?: boolean; error?: string; children: React.ReactNode
}
function Field({ id, label, required, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-text-secondary">
        {label}{required && <span className="ml-1 text-status-bad">*</span>}
      </label>
      {children}
      {error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-status-bad">
          <AlertCircle size={12} />{error}
        </p>
      )}
    </div>
  )
}

function inputCls(hasError: boolean) {
  return [
    'w-full rounded-xl border px-3 py-2.5 text-sm text-text-primary bg-surface',
    'placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors',
    hasError ? 'border-status-bad' : 'border-border',
  ].join(' ')
}

function faixaLabel(metaTipo: 'maior_igual' | 'menor_igual', metaMinima: number | null, metaParcial: number | null) {
  if (metaMinima === null || metaParcial === null) return null
  if (metaTipo === 'maior_igual') {
    return [
      `✓ Atingido: ≥ ${metaParcial}`,
      `~ Parcial: entre ${metaMinima} e ${metaParcial}`,
      `✗ Não atingido: < ${metaMinima}`,
    ]
  }
  return [
    `✓ Atingido: ≤ ${metaMinima}`,
    `~ Parcial: entre ${metaMinima} e ${metaParcial}`,
    `✗ Não atingido: > ${metaParcial}`,
  ]
}

export default function EntradaMensalModal({ acompanhamento: ac, onSalvo, onFechar }: Props) {
  const api = useApi()
  const inputRef = useRef<HTMLInputElement>(null)

  const [valorStr, setValorStr] = useState(ac.valorRealizado?.toString() ?? '')
  const [descricao, setDescricao] = useState(ac.descricaoDesvios ?? '')
  const [erros, setErros] = useState<{ valor?: string; descricao?: string }>({})
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const valor = valorStr === '' ? null : parseFloat(valorStr)
  const statusPreview = calcularStatusPreview(ac.metaTipo, valor, ac.metaParcial, ac.metaMinima)
  const precisaDescricao = statusPreview !== 'atingido' || ac.metaTipo === 'menor_igual'
  const faixas = faixaLabel(ac.metaTipo, ac.metaMinima, ac.metaParcial)

  const [anoStr, mesStr] = (ac.mesReferencia ?? '').split('-')
  const mesLabel = mesStr && anoStr
    ? new Date(parseInt(anoStr), parseInt(mesStr) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : ''

  function validate(): boolean {
    const e: typeof erros = {}
    if (valor === null || isNaN(valor) || valor < 0) e.valor = 'Informe um valor numérico ≥ 0'
    if (precisaDescricao && !descricao.trim()) e.descricao = 'Descrição de desvios é obrigatória'
    setErros(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    setLoading(true)
    setApiError(null)
    try {
      let result: AcompanhamentoRecord
      if (ac.id === null) {
        const raw = await api.post('/acompanhamentos', {
          indicadorId: ac.indicadorId,
          mesReferencia: ac.mesReferencia,
          valorRealizado: valor,
          descricaoDesvios: descricao || null,
        })
        result = unwrap(raw) as AcompanhamentoRecord
      } else {
        const raw = await api.put(`/acompanhamentos/${ac.id}`, {
          valorRealizado: valor,
          descricaoDesvios: descricao || null,
        })
        result = unwrap(raw) as AcompanhamentoRecord
      }
      onSalvo(result)
    } catch (e) {
      if (e instanceof ApiError) setApiError(e.message)
      else setApiError('Erro ao salvar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const metaPrincipal = ac.metaVigenteMensal ?? ac.metaVigenteQualit
  const percBar = metaPrincipal && valor !== null ? Math.min(100, (valor / metaPrincipal) * 100) : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={e => { if (e.target === e.currentTarget) onFechar() }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-surface shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Target size={18} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-text-primary truncate">{ac.indicador.nome}</p>
            <p className="text-xs text-text-secondary capitalize">{mesLabel}</p>
          </div>
          <button
            onClick={onFechar}
            className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-alt transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto px-6 py-4">
          {/* Bloco de contexto */}
          <div className="rounded-xl bg-surface-alt p-4 flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Meta principal</span>
              <span className="font-mono font-medium text-text-primary">
                {metaPrincipal ?? '—'}
                {ac.indicador.unidadeMedida ? ` ${ac.indicador.unidadeMedida}` : ''}
              </span>
            </div>
            {faixas && (
              <ul className="flex flex-col gap-0.5 text-xs text-text-secondary">
                {faixas.map(f => <li key={f}>{f}</li>)}
              </ul>
            )}
            <span className="text-xs text-text-secondary">
              {ac.metaTipo === 'maior_igual' ? '↑ maior é melhor' : '↓ menor é melhor'}
            </span>
          </div>

          {/* Campo valor */}
          <Field id="valorRealizado" label="Valor realizado" required error={erros.valor}>
            <input
              ref={inputRef}
              id="valorRealizado"
              type="number"
              min="0"
              step="any"
              value={valorStr}
              onChange={e => { setValorStr(e.target.value); setApiError(null) }}
              className={inputCls(!!erros.valor)}
              placeholder="0"
            />
          </Field>

          {/* Preview em tempo real */}
          {valor !== null && !isNaN(valor) && (
            <div className="flex flex-col gap-2">
              <div className="h-2 rounded-full bg-border overflow-hidden">
                <div
                  className={[
                    'h-full rounded-full transition-all',
                    statusPreview === 'atingido'     ? 'bg-status-ok' :
                    statusPreview === 'parcial'       ? 'bg-status-warn' : 'bg-status-bad',
                  ].join(' ')}
                  style={{ width: `${percBar}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">{percBar.toFixed(1)}%</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[statusPreview]}`}>
                  {STATUS_LABELS[statusPreview]}
                </span>
              </div>
            </div>
          )}

          {/* Campo desvios */}
          {precisaDescricao && (
            <Field id="descricaoDesvios" label="Descrição de desvios" required error={erros.descricao}>
              <textarea
                id="descricaoDesvios"
                value={descricao}
                onChange={e => { setDescricao(e.target.value); setApiError(null) }}
                className={inputCls(!!erros.descricao) + ' resize-none'}
                rows={3}
                placeholder="Descreva o motivo do desvio em relação à meta..."
              />
            </Field>
          )}

          {apiError && (
            <p className="text-sm text-status-bad flex items-center gap-1">
              <AlertCircle size={14} />{apiError}
            </p>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-xl px-4 py-2 text-sm border border-border text-text-secondary hover:bg-surface-alt transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-xl px-5 py-2 text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {ac.id === null ? 'Lançar' : 'Atualizar'}
          </button>
        </div>
      </div>
    </div>
  )
}
