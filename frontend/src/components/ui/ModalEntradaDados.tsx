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
      <div className="w-full max-w-lg rounded-xl bg-surface-light p-6 shadow-xl dark:bg-surface-dark">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Entrada de Dados
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {ind?.codigo} — {ind?.nome}
            </p>
          </div>
          <button
            onClick={onFechar}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Meta mensal:</span>
              <span className="font-mono font-medium text-slate-900 dark:text-slate-200">
                {formatNumber(meta)} {ind?.unidade_medida}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="valor_realizado" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
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
              className="w-full rounded-lg border border-border-light bg-white px-3 py-2 text-sm focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-slate-900 dark:text-slate-200"
              required
            />
          </div>

          {numValor > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-border-light bg-slate-50 p-3 dark:border-border-dark dark:bg-slate-800/50">
              <div className="text-sm">
                <span className="text-slate-500">Preview: </span>
                <span className="font-mono font-bold">{percentual.toFixed(1)}%</span>
              </div>
              <StatusBadge status={previewStatus} size="md" />
            </div>
          )}

          <div>
            <label htmlFor="desvios" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Descrição de Desvios
              {desvioObrigatorio && <span className="ml-1 text-nao-cumprido">*</span>}
            </label>
            <textarea
              id="desvios"
              value={desvios}
              onChange={e => setDesvios(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border-light bg-white px-3 py-2 text-sm focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-slate-900 dark:text-slate-200"
              required={desvioObrigatorio}
              placeholder={desvioObrigatorio ? 'Obrigatório quando abaixo de 85%' : 'Opcional'}
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onFechar}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
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
