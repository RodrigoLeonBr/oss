import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { AcompanhamentoMensal } from '../../types'
import { mockIndicadores } from '../../data/mock'
import { formatNumber } from '../../lib/formatters'
import StatusBadge from './StatusBadge'

interface Props {
  acompanhamento: AcompanhamentoMensal
  onSalvar: (acompId: string, valorRealizado: number, descricaoDesvios: string) => void
  onFechar: () => void
}

export default function ModalEntradaDados({ acompanhamento, onSalvar, onFechar }: Props) {
  const ind = mockIndicadores.find(i => i.indicador_id === acompanhamento.indicador_id)
  const [valor, setValor] = useState(String(acompanhamento.valor_realizado || ''))
  const [desvios, setDesvios] = useState(acompanhamento.descricao_desvios || '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onFechar])

  const numValor = parseFloat(valor) || 0
  const meta = acompanhamento.meta_vigente_mensal ?? 0
  const percentual = meta > 0 ? (numValor / meta) * 100 : 0
  const previewStatus =
    percentual >= 85 ? 'cumprido' as const
    : percentual >= 70 ? 'parcial' as const
    : 'nao_cumprido' as const

  const desvioObrigatorio = percentual < 85 && numValor > 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (desvioObrigatorio && !desvios.trim()) return
    onSalvar(acompanhamento.acomp_id, numValor, desvios)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Entrada de dados do indicador"
    >
      <div className="w-full max-w-lg rounded-xl bg-surface p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              Entrada de Dados
            </h2>
            <p className="mt-0.5 text-sm text-text-muted">
              {ind?.codigo} — {ind?.nome}
            </p>
          </div>
          <button
            onClick={onFechar}
            className="rounded-lg p-1 text-text-faint hover:bg-hover hover:text-text-secondary"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="rounded-lg bg-surface-alt p-3">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Meta mensal:</span>
              <span className="font-mono font-medium text-text-primary">
                {formatNumber(meta)} {ind?.unidade_medida}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="valor_realizado" className="mb-1 block text-sm font-medium text-text-secondary">
              Valor Realizado
            </label>
            <input
              ref={inputRef}
              id="valor_realizado"
              type="number"
              min="0"
              step="any"
              value={valor}
              onChange={e => setValor(e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm focus:border-primary focus:ring-primary"
              required
            />
          </div>

          {numValor > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-alt p-3">
              <div className="text-sm">
                <span className="text-text-muted">Preview: </span>
                <span className="font-mono font-bold text-text-primary">{percentual.toFixed(1)}%</span>
              </div>
              <StatusBadge status={previewStatus} size="md" />
            </div>
          )}

          <div>
            <label htmlFor="desvios" className="mb-1 block text-sm font-medium text-text-secondary">
              Descrição de Desvios
              {desvioObrigatorio && <span className="ml-1 text-nao-cumprido">*</span>}
            </label>
            <textarea
              id="desvios"
              value={desvios}
              onChange={e => setDesvios(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm focus:border-primary focus:ring-primary"
              required={desvioObrigatorio}
              placeholder={desvioObrigatorio ? 'Obrigatório quando abaixo de 85%' : 'Opcional'}
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onFechar}
              className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-hover"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
