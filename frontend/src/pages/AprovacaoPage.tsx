import { useState, useCallback } from 'react'
import { CheckCircle, Clock, Filter } from 'lucide-react'
import BotaoAprovar from '../components/ui/BotaoAprovar'
import StatusBadge from '../components/ui/StatusBadge'
import type { AcompanhamentoMensal } from '../types'
import {
  mockAcompanhamentos,
  mockIndicadores,
  mockUnidades,
} from '../data/mock'
import { formatNumber, formatPercent, formatMesReferencia } from '../lib/formatters'
import { aprovacaoLabel } from '../lib/formatters'

export default function AprovacaoPage() {
  const [mesRef] = useState('2026-03')
  const [dados, setDados] = useState<AcompanhamentoMensal[]>(mockAcompanhamentos)
  const [filtroStatus, setFiltroStatus] = useState<'submetido' | 'aprovado' | ''>('')
  const [selecionado, setSelecionado] = useState<AcompanhamentoMensal | null>(null)

  const pendentes = dados.filter(d => d.status_aprovacao === 'submetido' || d.status_aprovacao === 'rascunho')
  const aprovados = dados.filter(d => d.status_aprovacao === 'aprovado')

  const exibidos = filtroStatus === 'submetido'
    ? pendentes
    : filtroStatus === 'aprovado'
    ? aprovados
    : dados

  const handleAprovar = useCallback(async (acompId: string) => {
    await new Promise(r => setTimeout(r, 500))
    setDados(prev =>
      prev.map(d =>
        d.acomp_id === acompId
          ? { ...d, status_aprovacao: 'aprovado' as const, data_aprovacao: new Date().toISOString(), aprovado_por: 'aaaa0003-0003-0003-0003-000000000003' }
          : d,
      ),
    )
    setSelecionado(null)
  }, [])

  const handleAprovarTodos = useCallback(async () => {
    await new Promise(r => setTimeout(r, 800))
    setDados(prev =>
      prev.map(d =>
        d.status_aprovacao !== 'aprovado'
          ? { ...d, status_aprovacao: 'aprovado' as const, data_aprovacao: new Date().toISOString(), aprovado_por: 'aaaa0003-0003-0003-0003-000000000003' }
          : d,
      ),
    )
  }, [])

  const getIndicador = (indicadorId: string) =>
    mockIndicadores.find(i => i.indicador_id === indicadorId)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Aprovação Auditoria — {formatMesReferencia(mesRef)}
          </h2>
          <p className="text-sm text-slate-500">
            {pendentes.length} indicador{pendentes.length !== 1 ? 'es' : ''} pendente{pendentes.length !== 1 ? 's' : ''} de aprovação
          </p>
        </div>
        {pendentes.length > 0 && (
          <BotaoAprovar
            acompanhamentoId=""
            onAprovar={handleAprovarTodos}
            label="Aprovar Todos"
          />
        )}
      </div>

      <div className="flex items-center gap-3">
        <Filter size={16} className="text-slate-400" />
        <button
          onClick={() => setFiltroStatus('')}
          className={`rounded-lg px-3 py-1.5 text-sm ${!filtroStatus ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}
        >
          Todos ({dados.length})
        </button>
        <button
          onClick={() => setFiltroStatus('submetido')}
          className={`rounded-lg px-3 py-1.5 text-sm ${filtroStatus === 'submetido' ? 'bg-parcial text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}
        >
          <Clock size={14} className="mr-1 inline" />
          Pendentes ({pendentes.length})
        </button>
        <button
          onClick={() => setFiltroStatus('aprovado')}
          className={`rounded-lg px-3 py-1.5 text-sm ${filtroStatus === 'aprovado' ? 'bg-cumprido text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}
        >
          <CheckCircle size={14} className="mr-1 inline" />
          Aprovados ({aprovados.length})
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-2">
          {mockUnidades.map(unidade => {
            const indUnidade = mockIndicadores.filter(i => i.unidade_id === unidade.unidade_id)
            const acompsUnidade = exibidos.filter(d => indUnidade.some(i => i.indicador_id === d.indicador_id))
            if (acompsUnidade.length === 0) return null
            return (
              <div key={unidade.unidade_id}>
                <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {unidade.nome} — {unidade.tipo}
                </h4>
                <div className="space-y-1">
                  {acompsUnidade.map(acomp => {
                    const ind = getIndicador(acomp.indicador_id)
                    const isSelected = selecionado?.acomp_id === acomp.acomp_id
                    return (
                      <div
                        key={acomp.acomp_id}
                        className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border-light hover:bg-slate-50 dark:border-border-dark dark:hover:bg-slate-800/50'
                        }`}
                        onClick={() => setSelecionado(acomp)}
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter') setSelecionado(acomp) }}
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                              {ind?.nome}
                            </p>
                            <p className="text-xs text-slate-500">
                              {ind?.codigo} · Meta: {formatNumber(acomp.meta_vigente_mensal ?? 0)} · Real: {formatNumber(acomp.valor_realizado ?? 0)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={acomp.status_cumprimento} />
                          {acomp.status_aprovacao !== 'aprovado' ? (
                            <span className="rounded-full bg-parcial/10 px-2 py-0.5 text-xs font-medium text-parcial">
                              {aprovacaoLabel(acomp.status_aprovacao)}
                            </span>
                          ) : (
                            <span className="rounded-full bg-cumprido/10 px-2 py-0.5 text-xs font-medium text-cumprido">
                              Aprovado
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <div className="rounded-xl border border-border-light bg-surface-light p-4 dark:border-border-dark dark:bg-surface-dark lg:sticky lg:top-6">
          {selecionado ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  {getIndicador(selecionado.indicador_id)?.nome}
                </h3>
                <p className="text-xs text-slate-500">
                  {getIndicador(selecionado.indicador_id)?.codigo}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                  <p className="text-xs text-slate-500">Meta</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-200">
                    {formatNumber(selecionado.meta_vigente_mensal ?? 0)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                  <p className="text-xs text-slate-500">Realizado</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-200">
                    {formatNumber(selecionado.valor_realizado ?? 0)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                  <p className="text-xs text-slate-500">Cumprimento</p>
                  <p className="text-lg font-bold">{formatPercent(selecionado.percentual_cumprimento ?? 0)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                  <p className="text-xs text-slate-500">Status</p>
                  <div className="mt-1">
                    <StatusBadge status={selecionado.status_cumprimento} size="md" />
                  </div>
                </div>
              </div>

              {selecionado.descricao_desvios && (
                <div className="rounded-lg bg-parcial/5 p-3">
                  <p className="text-xs font-medium text-parcial">Descrição de Desvios</p>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    {selecionado.descricao_desvios}
                  </p>
                </div>
              )}

              {selecionado.status_aprovacao !== 'aprovado' && (
                <BotaoAprovar
                  acompanhamentoId={selecionado.acomp_id}
                  onAprovar={handleAprovar}
                />
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-slate-400">
              Selecione um indicador para ver detalhes
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
