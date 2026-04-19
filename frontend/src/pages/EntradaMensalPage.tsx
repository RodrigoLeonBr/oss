import { useState, useCallback } from 'react'
import { Send } from 'lucide-react'
import TabelaIndicadores from '../components/ui/TabelaIndicadores'
import ModalEntradaDados from '../components/ui/ModalEntradaDados'
import type { AcompanhamentoMensal } from '../types'
import {
  mockAcompanhamentos,
} from '../data/mock'
import { formatMesReferencia } from '../lib/formatters'

export default function EntradaMensalPage() {
  const [mesRef] = useState('2026-03')
  const [dados, setDados] = useState<AcompanhamentoMensal[]>(mockAcompanhamentos)
  const [modalAcomp, setModalAcomp] = useState<AcompanhamentoMensal | null>(null)
  const [submetido, setSubmetido] = useState(false)

  const handleRowClick = useCallback((acomp: AcompanhamentoMensal) => {
    setModalAcomp(acomp)
  }, [])

  const handleSalvar = useCallback(
    (acompId: string, valorRealizado: number, descricaoDesvios: string) => {
      setDados(prev =>
        prev.map(d => {
          if (d.acomp_id !== acompId) return d
          const meta = d.meta_vigente_mensal ?? 0
          const pct = meta > 0 ? (valorRealizado / meta) * 100 : 0
          const status =
            pct >= 85 ? 'cumprido' as const
            : pct >= 70 ? 'parcial' as const
            : 'nao_cumprido' as const
          return {
            ...d,
            valor_realizado: valorRealizado,
            percentual_cumprimento: parseFloat(pct.toFixed(2)),
            status_cumprimento: status,
            descricao_desvios: descricaoDesvios || undefined,
          }
        }),
      )
      setModalAcomp(null)
    },
    [],
  )

  const handleSubmeter = () => {
    setSubmetido(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Entrada Mensal — {formatMesReferencia(mesRef)}
          </h2>
          <p className="text-sm text-slate-500">
            Clique em um indicador para registrar o valor realizado
          </p>
        </div>
        <button
          onClick={handleSubmeter}
          disabled={submetido}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          <Send size={16} />
          {submetido ? 'Submetido para Aprovação' : 'Submeter para Aprovação'}
        </button>
      </div>

      <TabelaIndicadores
        dados={dados}
        onRowClick={handleRowClick}
      />

      {modalAcomp && (
        <ModalEntradaDados
          acompanhamento={modalAcomp}
          onSalvar={handleSalvar}
          onFechar={() => setModalAcomp(null)}
        />
      )}
    </div>
  )
}
