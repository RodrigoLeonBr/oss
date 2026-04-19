import { AlertTriangle, ShieldCheck } from 'lucide-react'
import type { DescontoBloco, DescontoIndicador } from '../../types'
import { formatCurrency } from '../../lib/formatters'

interface Props {
  desconto: DescontoBloco | DescontoIndicador
}

function isDescontoBloco(d: DescontoBloco | DescontoIndicador): d is DescontoBloco {
  return 'desc_bloco_id' in d
}

export default function AlertaDesconto({ desconto }: Props) {
  const isProducao = isDescontoBloco(desconto)
  const label = isProducao ? 'Produção' : 'Qualidade'

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 ${
        isProducao
          ? 'border-nao-cumprido/30 bg-nao-cumprido/5'
          : 'border-parcial/30 bg-parcial/5'
      }`}
      role="alert"
    >
      <AlertTriangle
        size={18}
        className={isProducao ? 'mt-0.5 text-nao-cumprido' : 'mt-0.5 text-parcial'}
      />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text-primary">
            {label} — {desconto.percentual_desconto}%
          </span>
          <span className={`text-sm font-bold ${isProducao ? 'text-nao-cumprido' : 'text-parcial'}`}>
            -{formatCurrency(desconto.valor_desconto)}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-text-secondary">
          {isProducao
            ? `Bloco: ${(desconto as DescontoBloco).bloco?.nome ?? desconto.bloco_id} · Faixa: ${(desconto as DescontoBloco).faixa}`
            : `Indicador: ${(desconto as DescontoIndicador).indicador?.nome ?? desconto.indicador_id} · Modelo: ${(desconto as DescontoIndicador).modelo_desconto}`}
        </p>
        {desconto.auditado && (
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-cumprido/10 px-2 py-0.5 text-xs font-medium text-cumprido">
            <ShieldCheck size={12} />
            Auditado
          </span>
        )}
      </div>
    </div>
  )
}
