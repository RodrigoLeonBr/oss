import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Target, BarChart3, RefreshCw, Search, X as XIcon, ArrowRight } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import type { IndicadorRecord } from '../Indicadores/types'
import {
  TIPO_LABELS, TIPO_BADGE,
  STATUS_BADGE, STATUS_LABELS,
  formatarMeta, mockIndicadores, unwrap,
} from '../Indicadores/types'

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-border-subtle bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="h-8 w-8 rounded-lg bg-surface-alt" />
        <div className="h-5 w-16 rounded-full bg-surface-alt" />
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-4 w-3/4 rounded bg-surface-alt" />
        <div className="h-3 w-1/2 rounded bg-surface-alt" />
        <div className="h-3 w-2/3 rounded bg-surface-alt" />
      </div>
    </div>
  )
}

export default function MetasHub() {
  const navigate = useNavigate()
  const { get } = useApi()

  const [indicadores, setIndicadores] = useState<IndicadorRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  const fetchIndicadores = useCallback(async () => {
    setLoading(true)
    try {
      const res = await get<IndicadorRecord[] | { data: IndicadorRecord[] }>('/indicadores')
      setIndicadores(unwrap(res))
    } catch {
      if (import.meta.env.DEV) setIndicadores(mockIndicadores)
    } finally {
      setLoading(false)
    }
  }, [get])

  useEffect(() => { fetchIndicadores() }, [fetchIndicadores])

  const filtrados = busca
    ? indicadores.filter(i =>
        i.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (i.unidade?.nome ?? '').toLowerCase().includes(busca.toLowerCase()),
      )
    : indicadores

  // Group by unidade
  const porUnidade = filtrados.reduce<Record<string, { nome: string; items: IndicadorRecord[] }>>((acc, ind) => {
    const uid  = ind.unidade?.id   ?? 'sem-unidade'
    const nome = ind.unidade?.nome ?? 'Sem Unidade'
    if (!acc[uid]) acc[uid] = { nome, items: [] }
    acc[uid].items.push(ind)
    return acc
  }, {})

  const grupos = Object.entries(porUnidade)
  const ativos = indicadores.filter(i => i.status === 'ativo').length

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Target size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Metas Anuais</h1>
            <p className="text-sm text-text-muted">
              {loading
                ? 'Carregando indicadores…'
                : `Selecione um indicador para gerenciar suas metas · ${ativos} ativo${ativos !== 1 ? 's' : ''} de ${indicadores.length}`
              }
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchIndicadores}
          disabled={loading}
          aria-label="Recarregar"
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
          placeholder="Filtrar por nome ou unidade…"
          aria-label="Filtrar indicadores"
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

      {/* ── Conteúdo ── */}
      {loading ? (
        <div className="space-y-6">
          {[4, 3].map((count, gi) => (
            <div key={gi}>
              <div className="mb-3 h-4 w-40 animate-pulse rounded bg-surface-alt" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            </div>
          ))}
        </div>
      ) : grupos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-alt text-text-faint">
            <BarChart3 size={28} />
          </div>
          <p className="font-medium text-text-secondary">
            {busca ? 'Nenhum indicador encontrado' : 'Nenhum indicador cadastrado'}
          </p>
          <p className="text-sm text-text-muted">
            {busca
              ? 'Tente outros termos de busca.'
              : 'Cadastre indicadores em "Indicadores por Unidade" para gerenciar metas.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map(([uid, { nome, items }]) => (
            <section key={uid}>
              <p className="mb-3 text-sm font-medium uppercase tracking-wider text-text-muted">
                {nome}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map(ind => (
                  <button
                    key={ind.id}
                    type="button"
                    onClick={() => navigate(`/metas/${ind.id}`)}
                    className={`group flex flex-col gap-3 rounded-xl border bg-surface p-4 text-left shadow-sm transition-all hover:border-primary/40 hover:bg-surface-alt hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                      ind.status === 'inativo' ? 'opacity-60' : ''
                    }`}
                    aria-label={`Ver metas de ${ind.nome}`}
                  >
                    {/* Topo: ícone + badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                        <Target size={16} />
                      </div>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${TIPO_BADGE[ind.tipo]}`}>
                          {TIPO_LABELS[ind.tipo]}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[ind.status]}`}>
                          {STATUS_LABELS[ind.status]}
                        </span>
                      </div>
                    </div>

                    {/* Nome + meta base */}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold leading-snug text-text-primary">
                        {ind.nome}
                      </p>
                      {ind.metaPadrao != null && (
                        <p className="mt-0.5 font-mono text-xs text-text-muted">
                          Meta base:{' '}
                          <span className="font-semibold text-text-secondary">
                            {formatarMeta(ind.metaPadrao)}
                          </span>
                          {ind.unidadeMedida ? ` ${ind.unidadeMedida}` : ''}
                        </p>
                      )}
                    </div>

                    {/* CTA */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                        <Target size={12} />
                        Ver metas
                      </div>
                      <ArrowRight
                        size={14}
                        className="text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                      />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
