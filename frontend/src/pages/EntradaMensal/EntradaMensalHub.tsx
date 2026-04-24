// frontend/src/pages/EntradaMensal/EntradaMensalHub.tsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, ChevronRight } from 'lucide-react'
import type { AcompanhamentoRecord } from './types'
import { STATUS_BADGE, STATUS_LABELS, unwrap } from './types'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../contexts/AuthContext'

interface UnidadeCard {
  id: string
  nome: string
  sigla?: string
}

const mockUnidades: UnidadeCard[] = [
  { id: 'mock-u1', nome: 'UPA Central', sigla: 'UPA-C' },
  { id: 'mock-u2', nome: 'Hospital Municipal', sigla: 'HM' },
  { id: 'mock-u3', nome: 'Pronto Socorro Norte', sigla: 'PSN' },
]

type StatusCumprimento = AcompanhamentoRecord['statusCumprimento']

interface Progresso {
  total:     number
  lancados:  number
  porStatus: Partial<Record<StatusCumprimento, number>>
}

function calcularProgresso(acomps: AcompanhamentoRecord[]): Progresso {
  const folhas = acomps.filter(a => !a.somenteExibicao)
  const porStatus: Partial<Record<StatusCumprimento, number>> = {}
  for (const a of folhas) {
    porStatus[a.statusCumprimento] = (porStatus[a.statusCumprimento] ?? 0) + 1
  }
  return {
    total:    folhas.length,
    lancados: folhas.filter(a => a.id !== null).length,
    porStatus,
  }
}

const STATUS_ORDER: StatusCumprimento[] = ['atingido', 'parcial', 'nao_atingido', 'pendente']

export default function EntradaMensalHub() {
  const api = useApi()
  const { token: authToken } = useAuth()
  const navigate = useNavigate()

  const mesDefault = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  }, [])

  const [unidades, setUnidades] = useState<UnidadeCard[]>([])
  const [loadingUnidades, setLoadingUnidades] = useState(true)
  const [erroUnidades, setErroUnidades] = useState<string | null>(null)
  const [meses, setMeses] = useState<Record<string, string>>({})
  const [progressos, setProgressos] = useState<Record<string, Progresso | null>>({})

  const carregarUnidades = useCallback(async (signal: { aborted: boolean }) => {
    setLoadingUnidades(true)
    setErroUnidades(null)
    try {
      const raw = await api.get('/unidades?ativo=1')
      if (signal.aborted) return
      const data = unwrap(raw) as UnidadeCard[]
      setUnidades(data)
      const m: Record<string, string> = {}
      for (const u of data) m[u.id] = mesDefault
      setMeses(m)
    } catch {
      if (signal.aborted) return
      if (import.meta.env.DEV) {
        const data = mockUnidades
        setUnidades(data)
        const m: Record<string, string> = {}
        for (const u of data) m[u.id] = mesDefault
        setMeses(m)
      } else {
        setErroUnidades('Não foi possível carregar as unidades.')
      }
    } finally {
      if (!signal.aborted) setLoadingUnidades(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- evitar re-montar por ref instável de `api`
  }, [authToken, mesDefault])

  useEffect(() => {
    const signal = { aborted: false }
    carregarUnidades(signal)
    return () => { signal.aborted = true }
  }, [carregarUnidades])

  const carregarProgresso = useCallback(async (unidadeId: string, mesReferencia: string) => {
    setProgressos(prev => ({ ...prev, [unidadeId]: null }))
    try {
      const raw = await api.get(`/acompanhamentos?unidadeId=${unidadeId}&mesReferencia=${mesReferencia}`)
      const data = unwrap(raw) as AcompanhamentoRecord[]
      setProgressos(prev => ({ ...prev, [unidadeId]: calcularProgresso(data) }))
    } catch {
      setProgressos(prev => ({ ...prev, [unidadeId]: { total: 0, lancados: 0, porStatus: {} } }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, mesDefault])

  useEffect(() => {
    for (const u of unidades) {
      void carregarProgresso(u.id, meses[u.id] ?? mesDefault)
    }
  // Trocar mês: handleMesChange chama carregarProgresso; não re-listar `meses` (evita N× pedidos a cada mês)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidades, carregarProgresso, mesDefault])

  function handleMesChange(unidadeId: string, val: string) {
    const [a, m] = val.split('-')
    if (!a || !m) return
    const mes = `${a}-${m}-01`
    setMeses(prev => ({ ...prev, [unidadeId]: mes }))
    carregarProgresso(unidadeId, mes)
  }

  function handleAbrirUnidade(unidadeId: string) {
    navigate(`/entrada-mensal/${unidadeId}?mes=${meses[unidadeId] ?? mesDefault}`)
  }

  if (loadingUnidades) {
    return <div className="flex justify-center py-24"><Loader2 size={24} className="animate-spin text-primary" /></div>
  }

  if (erroUnidades) {
    return <p className="py-24 text-center text-sm text-red-500">{erroUnidades}</p>
  }

  if (unidades.length === 0) {
    return <p className="py-24 text-center text-sm text-text-secondary">Nenhuma unidade ativa encontrada.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Entrada Mensal</h1>
        <p className="text-sm text-text-secondary mt-1 max-w-3xl">
          O mês e o contador “Lançados” consideram <strong>metas folhas</strong> (linhas avulsas ou sub-metas).
          Indicadores com <strong>pacote decomposto</strong> exigem um lançamento por sub-meta; a meta
          <strong> agregada</strong> (pai) não recebe realizado.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {unidades.map(u => {
          const prog = progressos[u.id]
          const mesVal = (meses[u.id] ?? mesDefault).slice(0, 7)

          return (
            <div
              key={u.id}
              onClick={() => handleAbrirUnidade(u.id)}
              className="rounded-2xl border border-border bg-surface p-5 flex flex-col gap-4 cursor-pointer hover:border-primary hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-text-primary group-hover:text-primary transition-colors">{u.nome}</p>
                  {u.sigla && <p className="text-xs text-text-secondary">{u.sigla}</p>}
                </div>
                <ChevronRight size={16} className="text-text-faint group-hover:text-primary transition-colors mt-0.5" />
              </div>

              {/* Seletor de mês — stopPropagation para não abrir a unidade */}
              <input
                type="month"
                value={mesVal}
                onClick={e => e.stopPropagation()}
                onChange={e => { e.stopPropagation(); handleMesChange(u.id, e.target.value) }}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              />

              {prog == null ? (
                <div className="flex justify-center py-2">
                  <Loader2 size={14} className="animate-spin text-primary" />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs text-text-secondary">
                    <span>Lançados</span>
                    <span className="font-medium text-text-primary">{prog.lancados}/{prog.total}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: prog.total > 0 ? `${(prog.lancados / prog.total) * 100}%` : '0%' }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_ORDER.filter(s => (prog.porStatus[s] ?? 0) > 0).map(s => (
                      <span key={s} className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_BADGE[s]}`}>
                        {prog.porStatus[s]} {STATUS_LABELS[s]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
