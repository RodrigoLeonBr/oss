import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, Hospital, RefreshCw, ArrowRight, Search, X as XIcon } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import type { UnidadeRecord } from '../Unidades/types'
import { TIPO_LABELS, TIPO_BADGE, STATUS_BADGE, STATUS_LABELS, mockUnidades, unwrap } from '../Unidades/types'

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-border-subtle bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="h-9 w-9 rounded-xl bg-surface-alt" />
        <div className="h-5 w-16 rounded-full bg-surface-alt" />
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-4 w-3/4 rounded bg-surface-alt" />
        <div className="h-3 w-full rounded bg-surface-alt" />
        <div className="h-3 w-2/3 rounded bg-surface-alt" />
      </div>
    </div>
  )
}

// ── Hub page ──────────────────────────────────────────────────────────────────
export default function IndicadoresHub() {
  const navigate = useNavigate()
  const { get } = useApi()

  const [unidades, setUnidades] = useState<UnidadeRecord[]>([])
  const [loading, setLoading]   = useState(true)
  const [busca, setBusca]       = useState('')

  const fetchUnidades = useCallback(async () => {
    setLoading(true)
    try {
      const res = await get<UnidadeRecord[] | { data: UnidadeRecord[] }>('/unidades')
      setUnidades(unwrap(res))
    } catch {
      if (import.meta.env.DEV) setUnidades(mockUnidades)
    } finally {
      setLoading(false)
    }
  }, [get])

  useEffect(() => { fetchUnidades() }, [fetchUnidades])

  const filtradas = busca
    ? unidades.filter(u =>
        u.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (u.contrato?.numeroContrato ?? '').toLowerCase().includes(busca.toLowerCase()) ||
        (u.contrato?.oss?.nome ?? '').toLowerCase().includes(busca.toLowerCase()),
      )
    : unidades

  const ativas   = unidades.filter(u => u.status === 'ativa').length
  const inativas = unidades.filter(u => u.status === 'inativa').length

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BarChart3 size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Indicadores por Unidade</h1>
            <p className="text-sm text-text-muted">
              {loading
                ? 'Carregando unidades…'
                : `Selecione uma unidade para gerenciar seus indicadores · ${ativas} ativa${ativas !== 1 ? 's' : ''}, ${inativas} inativa${inativas !== 1 ? 's' : ''}`
              }
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchUnidades}
          disabled={loading}
          aria-label="Recarregar lista"
          className="rounded-xl border border-border-subtle bg-surface p-2.5 text-text-muted transition-colors hover:bg-hover hover:text-text-primary disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Busca ── */}
      <div className="relative max-w-sm">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="search"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Filtrar por nome, contrato ou OSS…"
          aria-label="Filtrar unidades"
          className="w-full rounded-xl border border-border-subtle bg-surface py-2 pl-9 pr-9 text-sm text-text-primary placeholder:text-text-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        {busca && (
          <button
            type="button"
            onClick={() => setBusca('')}
            aria-label="Limpar filtro"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-faint hover:text-text-secondary"
          >
            <XIcon size={14} />
          </button>
        )}
      </div>

      {/* ── Grid de unidades ── */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-alt text-text-faint">
            <Hospital size={28} />
          </div>
          <p className="font-medium text-text-secondary">
            {busca ? 'Nenhuma unidade encontrada' : 'Nenhuma unidade cadastrada'}
          </p>
          <p className="text-sm text-text-muted">
            {busca
              ? 'Tente outros termos de busca.'
              : 'Cadastre unidades em "Unidades de Saúde" para gerenciar seus indicadores.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtradas.map(u => (
            <button
              key={u.id}
              type="button"
              onClick={() => navigate(`/indicadores/${u.id}`)}
              className={`group flex flex-col gap-3 rounded-2xl border bg-surface p-5 text-left shadow-sm transition-all hover:shadow-lg hover:border-primary/40 hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                u.status === 'inativa' ? 'opacity-60' : ''
              }`}
              aria-label={`Ver indicadores de ${u.nome}`}
            >
              {/* Topo: ícone + tipo + status */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                  <Hospital size={18} />
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${TIPO_BADGE[u.tipo]}`}>
                    {TIPO_LABELS[u.tipo]}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[u.status]}`}>
                    {STATUS_LABELS[u.status]}
                  </span>
                </div>
              </div>

              {/* Nome */}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm text-text-primary line-clamp-2 leading-snug">
                  {u.nome}
                </p>
                {u.contrato && (
                  <p className="mt-1 text-xs text-text-muted line-clamp-1">
                    <span className="font-mono font-medium">{u.contrato.numeroContrato}</span>
                    {u.contrato.oss && (
                      <span className="ml-1 text-text-faint">— {u.contrato.oss.nome}</span>
                    )}
                  </p>
                )}
                {u.capacidade > 0 && (
                  <p className="mt-0.5 text-xs text-text-faint">
                    {u.capacidade.toLocaleString('pt-BR')} leitos/vagas
                  </p>
                )}
              </div>

              {/* Rodapé: CTA */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-medium text-primary transition-colors group-hover:text-primary-dark">
                  <BarChart3 size={13} />
                  Ver indicadores
                </div>
                <ArrowRight
                  size={14}
                  className="text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
