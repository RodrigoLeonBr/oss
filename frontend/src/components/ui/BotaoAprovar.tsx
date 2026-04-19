import { useState } from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'

interface Props {
  acompanhamentoId: string
  onAprovar: (id: string) => Promise<void> | void
  disabled?: boolean
  label?: string
}

export default function BotaoAprovar({
  acompanhamentoId,
  onAprovar,
  disabled = false,
  label = 'Aprovar',
}: Props) {
  const [loading, setLoading] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  const handleClick = async () => {
    if (!confirmando) {
      setConfirmando(true)
      return
    }
    setLoading(true)
    try {
      await onAprovar(acompanhamentoId)
    } finally {
      setLoading(false)
      setConfirmando(false)
    }
  }

  const handleCancel = () => setConfirmando(false)

  if (confirmando) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleClick}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cumprido px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-cumprido/90 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <CheckCircle size={14} />
          )}
          Confirmar
        </button>
        <button
          onClick={handleCancel}
          disabled={loading}
          className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg border border-cumprido/30 bg-cumprido/10 px-3 py-1.5 text-sm font-medium text-cumprido transition-colors hover:bg-cumprido hover:text-white disabled:opacity-50"
    >
      <CheckCircle size={14} />
      {label}
    </button>
  )
}
