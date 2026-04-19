import { CheckCircle, AlertTriangle, XCircle, MinusCircle, Clock } from 'lucide-react'
import type { StatusCumprimento } from '../../types'

const config: Record<StatusCumprimento, { bg: string; icon: React.ReactNode; label: string }> = {
  cumprido: {
    bg: 'bg-cumprido/10 text-cumprido',
    icon: <CheckCircle size={14} />,
    label: 'Cumprido',
  },
  parcial: {
    bg: 'bg-parcial/10 text-parcial',
    icon: <AlertTriangle size={14} />,
    label: 'Parcial',
  },
  nao_cumprido: {
    bg: 'bg-nao-cumprido/10 text-nao-cumprido',
    icon: <XCircle size={14} />,
    label: 'Não Cumprido',
  },
  nao_aplicavel: {
    bg: 'bg-na/10 text-na',
    icon: <MinusCircle size={14} />,
    label: 'N/A',
  },
  aguardando: {
    bg: 'bg-na/10 text-na',
    icon: <Clock size={14} />,
    label: 'Aguardando',
  },
}

interface Props {
  status: StatusCumprimento
  size?: 'sm' | 'md'
}

export default function StatusBadge({ status, size = 'sm' }: Props) {
  const c = config[status]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${c.bg} ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      }`}
    >
      {c.icon}
      {c.label}
    </span>
  )
}
