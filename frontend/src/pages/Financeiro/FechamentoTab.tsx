import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Lock, LockOpen } from 'lucide-react'
import { useApi, ApiError } from '../../hooks/useApi'
import { usePermission } from '../../hooks/usePermission'
import { Barra, Erro, classeLbl, classeSel } from './Filtros'
import { unwrap, type Fechamento, type OpcaoEscopo } from './types'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export default function FechamentoTab({ opcoes }: { opcoes: OpcaoEscopo[] }) {
  const { get, post, request } = useApi()
  const { canUpdate, canDelete } = usePermission('financeiro')
  const contratos = useMemo(() => [...new Map(opcoes.map(o => [o.contrato_id, o.numero])).entries()], [opcoes])
  const [contratoId, setContratoId] = useState('')
  const [ano, setAno] = useState(new Date().getFullYear())
  const [fechados, setFechados] = useState<Fechamento[]>([])
  const [selecao, setSelecao] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => { if (!contratoId && contratos.length) setContratoId(contratos[0][0]) }, [contratos, contratoId])

  const carregar = useCallback(async () => {
    if (!contratoId) return
    setLoading(true); setErro(null)
    try { setFechados(unwrap<Fechamento[]>(await get(`/financeiro/fechamento?contrato_id=${contratoId}`))) } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao listar.')
    } finally { setLoading(false) }
  }, [get, contratoId])
  useEffect(() => { carregar(); setSelecao([]) }, [carregar])

  const fechado = (m: string) => fechados.find(f => f.mes_referencia === m)
  const fechar = async () => {
    setLoading(true); setErro(null)
    try { setFechados(unwrap<Fechamento[]>(await post('/financeiro/fechamento', { contrato_id: contratoId, meses: selecao }))); setSelecao([]) } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao fechar.')
    } finally { setLoading(false) }
  }
  const reabrir = async (mes: string) => {
    const justificativa = window.prompt(`Justificativa para reabrir ${mes.slice(5, 7)}/${mes.slice(0, 4)} (mín. 10 caracteres; fica na auditoria):`)
    if (!justificativa) return
    setLoading(true); setErro(null)
    try {
      await request('/financeiro/fechamento', { method: 'DELETE', body: JSON.stringify({ contrato_id: contratoId, mes, justificativa }) })
      await carregar()
    } catch (e) { setErro(e instanceof ApiError ? e.message : 'Erro ao reabrir.') } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">
        Mês fechado fica só leitura (grade e importação recusam). Feche depois de emitir o relatório do período, para o documento continuar batendo com o banco.
      </p>
      <Barra>
        <label className={classeLbl}>Contrato
          <select className={classeSel} value={contratoId} onChange={e => setContratoId(e.target.value)}>
            {contratos.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
        </label>
        <label className={classeLbl}>Ano
          <input type="number" className={`${classeSel} w-24`} value={ano} onChange={e => setAno(Number(e.target.value))} />
        </label>
        {canUpdate && (
          <button type="button" disabled={!selecao.length || loading} onClick={fechar}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <Lock size={16} />Fechar {selecao.length || ''} {selecao.length === 1 ? 'mês' : 'meses'}
          </button>
        )}
        {loading && <Loader2 size={18} className="mb-2 animate-spin text-primary" />}
      </Barra>
      <Erro msg={erro} />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {MESES.map((nome, i) => {
          const m = `${ano}-${String(i + 1).padStart(2, '0')}-01`
          const f = fechado(m)
          const marcado = selecao.includes(m)
          return (
            <div key={m} className={`flex flex-col gap-2 rounded-xl border px-3 py-2.5 ${f ? 'border-border-subtle bg-primary/5' : marcado ? 'border-primary bg-surface' : 'border-border-subtle bg-surface'}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold capitalize">{nome}/{ano}</span>
                {f ? <Lock size={14} className="text-primary" /> : <LockOpen size={14} className="text-text-faint" />}
              </div>
              {f ? (
                <>
                  <span className="text-xs text-text-muted">fechado {new Date(f.fechado_em).toLocaleDateString('pt-BR')}</span>
                  {canDelete && <button type="button" onClick={() => reabrir(m)} className="self-start text-xs text-status-bad hover:underline">Reabrir</button>}
                </>
              ) : canUpdate ? (
                <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <input type="checkbox" checked={marcado} onChange={e => setSelecao(s => (e.target.checked ? [...s, m] : s.filter(x => x !== m)))} />
                  selecionar
                </label>
              ) : <span className="text-xs text-text-muted">aberto</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
