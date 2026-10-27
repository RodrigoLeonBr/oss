import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useApi, ApiError } from '../../hooks/useApi'
import { usePermission } from '../../hooks/usePermission'
import type { Linha } from './types'

interface Props {
  linha: Linha
  onClose: () => void
  onSaved: () => void
}

const inputCls = 'w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary'

// Fora do modal para não perder foco a cada render
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-text-muted">{label}</span>
      {children}
    </label>
  )
}

export default function JustificativaModal({ linha, onClose, onSaved }: Props) {
  const { post, put } = useApi()
  const podeRegistrar = usePermission('entrada_mensal').canInsert
  const podeValidar = usePermission('aprovacao').canUpdate
  const nota = linha.nota

  const [descricao, setDescricao] = useState('')
  const [causa, setCausa] = useState('')
  const [acao, setAcao] = useState('')
  const [alcance, setAlcance] = useState('100')
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const executar = async (fn: () => Promise<unknown>) => {
    setSalvando(true); setErro(null)
    try { await fn(); onSaved() } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao salvar.')
    } finally { setSalvando(false) }
  }

  const registrar = () => executar(() => post(`/acompanhamento-mensal/${linha.acomp_id}/notas`, {
    descricao, causa_raiz: causa || null, acao_corretiva: acao || null,
  }))

  const validar = (status: 'aceita' | 'rejeitada') => executar(() => put(`/acompanhamento-mensal/notas/${nota!.nota_id}/validar`, {
    status_validacao: status,
    alcance_considerado: status === 'aceita' && alcance !== '' ? Number(alcance) : null,
    motivo_rejeicao_nota: status === 'rejeitada' ? motivo : null,
  }))

  // Nova justificativa se não há nota ou a última foi rejeitada
  const podeNova = podeRegistrar && linha.acomp_id && (!nota || nota.status_validacao === 'rejeitada')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-text-primary">Justificativa</h2>
            <p className="text-xs text-text-muted">{linha.codigo} · {linha.nome}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-text-muted hover:text-text-primary"><X size={18} /></button>
        </div>

        {!linha.acomp_id && <p className="text-sm text-text-muted">Sem lançamento neste mês: lance o valor (mesmo 0) para poder justificar.</p>}

        {nota && (
          <div className="flex flex-col gap-1 rounded-xl border border-border-subtle p-3 text-sm">
            <span className="text-xs font-semibold uppercase text-text-muted">Situação: {nota.status_validacao}
              {nota.status_validacao === 'aceita' && ` · considerado ${nota.alcance_considerado ?? 100}% do peso`}
            </span>
            <p className="whitespace-pre-wrap text-text-primary">{nota.descricao}</p>
            {nota.causa_raiz && <p className="text-text-secondary"><b>Causa:</b> {nota.causa_raiz}</p>}
            {nota.acao_corretiva && <p className="text-text-secondary"><b>Ação:</b> {nota.acao_corretiva}</p>}
            {nota.motivo_rejeicao_nota && <p className="text-status-bad"><b>Motivo da rejeição:</b> {nota.motivo_rejeicao_nota}</p>}
          </div>
        )}

        {nota?.status_validacao === 'pendente' && podeValidar && (
          <div className="flex flex-col gap-3 rounded-xl bg-primary/5 p-3">
            <Field label="Alcance considerado pela comissão (% do peso)">
              <input type="number" min={0} max={100} step="0.01" value={alcance} onChange={e => setAlcance(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Motivo (se rejeitar)">
              <textarea rows={2} value={motivo} onChange={e => setMotivo(e.target.value)} className={inputCls} />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" disabled={salvando} onClick={() => validar('rejeitada')}
                className="rounded-lg border border-status-bad-border px-3 py-2 text-sm font-medium text-status-bad hover:bg-status-bad-bg">Rejeitar</button>
              <button type="button" disabled={salvando} onClick={() => validar('aceita')}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90">Acatar</button>
            </div>
          </div>
        )}

        {podeNova && (
          <div className="flex flex-col gap-3">
            <Field label="Justificativa *">
              <textarea rows={3} value={descricao} onChange={e => setDescricao(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Causa raiz">
              <textarea rows={2} value={causa} onChange={e => setCausa(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Ação corretiva">
              <textarea rows={2} value={acao} onChange={e => setAcao(e.target.value)} className={inputCls} />
            </Field>
            <div className="flex justify-end">
              <button type="button" disabled={salvando || descricao.trim().length < 3} onClick={registrar}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">Registrar</button>
            </div>
          </div>
        )}

        {salvando && <Loader2 size={16} className="animate-spin text-primary" />}
        {erro && <p className="text-sm text-status-bad">{erro}</p>}
      </div>
    </div>
  )
}
