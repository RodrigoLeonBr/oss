import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { FileDown, FileSpreadsheet, Printer, Loader2, AlertCircle } from 'lucide-react'
import StatusBadge from '../components/ui/StatusBadge'
import RelatorioFiltros, {
  type Filtros, PERIODOS, mesDefault, toQuery, escopoIncompleto,
} from '../components/RelatorioFiltros'
import { useApi, ApiError } from '../hooks/useApi'
import { formatNumber, formatPercent, formatMesReferencia } from '../lib/formatters'
import type { StatusCumprimento } from '../types'

const STATUS_LABEL: Record<StatusCumprimento, string> = {
  cumprido: 'Cumprido', parcial: 'Parcial', nao_cumprido: 'Não Cumprido', nao_aplicavel: 'N/A', aguardando: 'Aguardando',
}

// ── Tipos da resposta /relatorios/cms ───────────────────────────────────────────
interface Linha {
  indicadorId: string
  codigo: string
  nome: string
  tipo: 'quantitativo' | 'qualitativo'
  grupo: string
  unidadeMedida: string | null
  metaBase: number | null
  metaPeriodo: number | null
  realizadoAcum: number
  mesesComLancamento: number
  percentual: number | null
  status: StatusCumprimento
  faixa: string | null
  /** % considerado pela regra de recebimento (0–100); null = sem lançamento */
  consideradoPerc: number | null
  /** % da meta que já vale 100% (≥ maior_igual / ≤ menor_igual) */
  limiar: { tipo: 'maior_igual' | 'menor_igual'; valor: number } | null
  peso?: number | null
  pontos?: number | null
}
interface BlocoPontuacao {
  blocoId: string | null
  nome: string
  /** códigos dos indicadores que compõem o bloco */
  indicadores: string[]
  status: StatusCumprimento
  alcance: number | null
  consideradoPerc: number | null
  peso: number | null
  pontos: number | null
  pendente: boolean
}
interface Pontuacao {
  modelo: string
  blocos: BlocoPontuacao[]
  quant: { peso: number; pontos: number; percentual: number; pendentes: number } | null
  qual: { peso: number; pontos: number; nota: number | null; percEscala: number | null; pendentes: number } | null
}
interface UnidadeRel {
  unidadeId: string
  nome: string
  sigla: string
  tipo: string
  quantitativos: Linha[]
  qualitativos: Linha[]
  pontuacao: Pontuacao
}
interface ContratoRel {
  contratoId: string
  numero: string
  valorMensalBase: number
  unidades: UnidadeRel[]
}
interface Relatorio {
  periodo: string
  janela: { inicio: string; fim: string; meses: number; anual: boolean }
  resumo: { cumpridos: number; parciais: number; naoCumpridos: number; aguardando: number; total: number }
  contratos: ContratoRel[]
}

const unwrap = <T,>(raw: unknown): T => {
  if (raw && typeof raw === 'object' && 'data' in raw) return (raw as { data: T }).data
  return raw as T
}

export default function RelatoriosCMSPage() {
  const { get } = useApi()

  const [filtros, setFiltros] = useState<Filtros>({
    mes: '', periodo: 'mes', escopo: 'todos', contratoId: '', unidadeId: '',
  })
  const [rel, setRel] = useState<Relatorio | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Default = último mês com lançamento
  useEffect(() => {
    get<{ data: { mes: string | null } } | { mes: string | null }>('/relatorios/ultimo-mes')
      .then(r => {
        const m = unwrap<{ mes: string | null }>(r)?.mes
        setFiltros(f => ({ ...f, mes: m ? m.slice(0, 7) : mesDefault() }))
      })
      .catch(() => setFiltros(f => ({ ...f, mes: mesDefault() })))
  }, [get])

  const fetchRel = useCallback(async () => {
    if (!filtros.mes || escopoIncompleto(filtros)) { setRel(null); return }
    setLoading(true)
    setErro(null)
    try {
      const r = await get<{ data: Relatorio } | Relatorio>(`/relatorios/cms?${toQuery(filtros)}`)
      setRel(unwrap<Relatorio>(r))
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao gerar relatório.')
      setRel(null)
    } finally {
      setLoading(false)
    }
  }, [get, filtros])

  useEffect(() => { fetchRel() }, [fetchRel])

  const todasLinhas = useMemo(
    () => (rel?.contratos ?? []).flatMap(c => c.unidades.flatMap(u => [...u.quantitativos, ...u.qualitativos]
      .map(l => ({ ...l, contrato: c.numero, unidade: u.nome })))),
    [rel],
  )

  const handleExportExcel = () => {
    const headers = ['Contrato', 'Unidade', 'Código', 'Indicador', 'Tipo', 'Meta período', 'Realizado', '%', 'Status', '% considerado', 'Peso', 'Pontos']
    const rows = todasLinhas.map(l => [
      l.contrato, l.unidade, l.codigo, l.nome, l.tipo,
      l.metaPeriodo ?? '', l.percentual != null ? l.realizadoAcum : '',
      l.percentual != null ? `${l.percentual.toFixed(1)}%` : '',
      STATUS_LABEL[l.status],
      l.consideradoPerc != null ? `${l.consideradoPerc.toFixed(1)}%` : '',
      l.peso ?? '', l.pontos ?? '',
    ].join('\t'))
    const tsv = [headers.join('\t'), ...rows].join('\n')
    const url = URL.createObjectURL(new Blob([tsv], { type: 'text/tab-separated-values' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-caf-${filtros.mes}-${filtros.periodo}.tsv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const periodoLabel = PERIODOS.find(p => p.v === filtros.periodo)?.label ?? filtros.periodo
  const janelaTxt = rel
    ? (rel.janela.meses === 1
      ? formatMesReferencia(rel.janela.inicio)
      : `${formatMesReferencia(rel.janela.inicio)} – ${formatMesReferencia(rel.janela.fim)}`)
    : ''

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Relatório CAF</h2>
          <p className="text-sm text-slate-500">Resultado por bloco e indicadores</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-border-light px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-border-dark dark:text-slate-300 dark:hover:bg-slate-800">
            <FileDown size={16} />PDF
          </button>
          <button onClick={handleExportExcel} className="inline-flex items-center gap-2 rounded-lg border border-border-light px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-border-dark dark:text-slate-300 dark:hover:bg-slate-800">
            <FileSpreadsheet size={16} />Excel
          </button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-border-light px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-border-dark dark:text-slate-300 dark:hover:bg-slate-800">
            <Printer size={16} />Imprimir
          </button>
        </div>
      </div>

      <RelatorioFiltros value={filtros} onChange={setFiltros}>
        {loading && <Loader2 size={18} className="mb-2 animate-spin text-primary" />}
      </RelatorioFiltros>

      {erro && (
        <div className="flex items-center gap-2 rounded-xl border border-nao-cumprido/30 bg-nao-cumprido/10 px-4 py-3 text-sm text-nao-cumprido print:hidden">
          <AlertCircle size={16} />{erro}
        </div>
      )}

      {rel && rel.resumo.total > 0 ? (
        <div className="space-y-6 rounded-xl border border-border-light bg-surface-light p-6 print:border-0 print:p-0 dark:border-border-dark dark:bg-surface-dark">
          <div className="border-b border-border-light pb-4 text-center dark:border-border-dark">
            <h3 className="text-lg font-bold text-primary">RELATÓRIO CAF</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">{periodoLabel} · {janelaTxt}</p>
            <p className="text-xs text-slate-500">Secretaria Municipal de Saúde — Americana/SP</p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">Conformidade dos Indicadores</h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Resumo n={rel.resumo.cumpridos} total={rel.resumo.total} label="Cumpridos" tom="cumprido" />
              <Resumo n={rel.resumo.parciais} total={rel.resumo.total} label="Parciais" tom="parcial" />
              <Resumo n={rel.resumo.naoCumpridos} total={rel.resumo.total} label="Não Cumpridos" tom="nao-cumprido" />
              <Resumo n={rel.resumo.aguardando} total={rel.resumo.total} label="Aguardando" tom="na" />
            </div>
          </div>

          {rel.contratos.map(c => (
            <div key={c.contratoId}>
              <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">Contrato {c.numero}</h4>
              {c.unidades.map(u => (
                <div key={u.unidadeId} className="mb-4">
                  <h5 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">{u.nome}</h5>
                  {u.pontuacao.blocos.length > 0 && <ResumoBlocos blocos={u.pontuacao.blocos} />}
                  {(['quantitativos', 'qualitativos'] as const).map(secao => (
                    u[secao].length > 0 && (
                      <Tabela key={secao}
                        titulo={secao === 'quantitativos' ? 'Produção (quantitativo)' : 'Qualidade (qualitativo)'}
                        linhas={u[secao]} pontuacao={u.pontuacao} qualitativo={secao === 'qualitativos'} />
                    )
                  ))}
                </div>
              ))}
            </div>
          ))}

          <div className="border-t border-border-light pt-4 text-center text-xs text-slate-500 dark:border-border-dark">
            <p>Documento gerado automaticamente pelo Sistema OSS Saúde Americana</p>
            <p className="mt-1">Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
          </div>
        </div>
      ) : !loading && (
        <div className="py-16 text-center text-sm text-slate-400">
          {escopoIncompleto(filtros) ? 'Selecione um item do escopo.' : 'Nenhum indicador para os filtros selecionados.'}
        </div>
      )}
    </div>
  )
}

const TOM: Record<string, { box: string; num: string }> = {
  cumprido: { box: 'border-cumprido/30 bg-cumprido/5', num: 'text-cumprido' },
  parcial: { box: 'border-parcial/30 bg-parcial/5', num: 'text-parcial' },
  'nao-cumprido': { box: 'border-nao-cumprido/30 bg-nao-cumprido/5', num: 'text-nao-cumprido' },
  na: { box: 'border-na/30 bg-na/5', num: 'text-na' },
}

// Linha estreita: resultado dos blocos da unidade (sem espaçamento vertical extra).
function ResumoBlocos({ blocos }: { blocos: BlocoPontuacao[] }) {
  const itens: [string, string, string][] = [
    ['cumprido', 'Cumpridos', 'cumprido'], ['parcial', 'Parciais', 'parcial'],
    ['nao_cumprido', 'Não Cumpridos', 'nao-cumprido'], ['aguardando', 'Aguardando', 'na'],
  ]
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
      <span className="font-medium text-slate-500">Blocos ({blocos.length}):</span>
      {itens.map(([st, label, tom]) => {
        const n = blocos.filter(b => b.status === st).length
        const c = TOM[tom]
        return (
          <span key={st} className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 ${c.box}`}>
            <b className={c.num}>{n}</b>
            <span className="text-slate-600 dark:text-slate-400">{label}</span>
          </span>
        )
      })}
    </div>
  )
}

function Resumo({ n, total, label, tom }: { n: number; total: number; label: string; tom: string }) {
  const pct = total > 0 ? (n / total) * 100 : 0
  const c = TOM[tom] ?? TOM.na
  return (
    <div className={`rounded-lg border p-3 text-center ${c.box}`}>
      <p className={`text-2xl font-bold ${c.num}`}>{n}</p>
      <p className="text-xs text-slate-600 dark:text-slate-400">{label} ({formatPercent(pct)})</p>
    </div>
  )
}

const fmtLimiar = (l: Linha['limiar']) => (l ? `${l.tipo === 'menor_igual' ? '≤' : '≥'}${formatNumber(l.valor)}%` : '')

const TH = 'px-2 py-2 font-medium text-slate-600 dark:text-slate-400'
const THR = `${TH} text-right`
const TD_NUM = 'px-2 py-1.5 text-right font-mono'

function LinhaInd({ l, recuo = false }: { l: Linha; recuo?: boolean }) {
  return (
    <tr>
      <td className={`px-2 py-1.5 font-mono text-slate-500 ${recuo ? 'pl-5' : ''}`}>{l.codigo}</td>
      <td className="px-2 py-1.5 text-slate-900 dark:text-slate-200">
        {l.nome}
        {l.mesesComLancamento === 0 && <span className="ml-1 text-[10px] text-na">(sem lançamento)</span>}
      </td>
      <td className={`${TD_NUM} text-slate-600 dark:text-slate-400`}>{l.metaPeriodo != null ? formatNumber(l.metaPeriodo) : '—'}</td>
      <td className={`${TD_NUM} text-slate-900 dark:text-slate-200`}>{l.percentual != null ? formatNumber(l.realizadoAcum) : '—'}</td>
      <td className={`${TD_NUM} font-bold`}>{l.percentual != null ? formatPercent(l.percentual) : '—'}</td>
      <td className="px-2 py-1.5"><StatusBadge status={l.status} /></td>
      <td className={`${TD_NUM} text-slate-900 dark:text-slate-200`}>
        {l.consideradoPerc != null ? formatPercent(l.consideradoPerc) : '—'}
        {l.limiar && <span className="ml-1 text-[10px] text-slate-500">({fmtLimiar(l.limiar)})</span>}
      </td>
      <td className={`${TD_NUM} text-slate-600 dark:text-slate-400`}>{l.peso != null ? formatNumber(l.peso) : ''}</td>
      <td className={`${TD_NUM} text-slate-900 dark:text-slate-200`}>{l.pontos != null ? formatNumber(l.pontos) : ''}</td>
    </tr>
  )
}

function Tabela({ titulo, linhas, pontuacao, qualitativo }: {
  titulo: string; linhas: Linha[]; pontuacao: Pontuacao; qualitativo: boolean
}) {
  // Quantitativo: bloco (resultado) em cima, indicadores que o compõem logo abaixo.
  const grupos = qualitativo ? [] : pontuacao.blocos
    .map(b => ({ b, inds: linhas.filter(l => b.indicadores.includes(l.codigo)) }))
    .filter(g => g.inds.length > 0)
  const qual = qualitativo ? pontuacao.qual : null
  const quant = qualitativo ? null : pontuacao.quant
  return (
    <div className="mb-3 overflow-x-auto">
      <p className="mb-1 text-xs font-medium text-slate-500">{titulo}</p>
      <table className="w-full min-w-[860px] text-left text-xs">
        <thead>
          <tr className="border-b border-border-light dark:border-border-dark">
            <th className={TH}>Código</th>
            <th className={TH}>Indicador</th>
            <th className={THR}>Meta período</th>
            <th className={THR}>Realizado</th>
            <th className={THR}>%</th>
            <th className={TH}>Status</th>
            <th className={THR} title="Percentual que a regra de recebimento considera (100% a partir do limiar)">% considerado</th>
            <th className={THR}>Peso</th>
            <th className={THR}>Pontos</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-light dark:divide-border-dark">
          {qualitativo
            ? linhas.map(l => <LinhaInd key={l.indicadorId} l={l} />)
            : grupos.map(({ b, inds }) => (b.peso == null
              // sem bloco/peso: indicador avulso, linha simples
              ? inds.map(l => <LinhaInd key={l.indicadorId} l={l} />)
              : (
                <Fragment key={b.blocoId ?? b.nome}>
                  <tr className="bg-slate-50 font-semibold dark:bg-slate-800/40">
                    <td className="px-2 py-1.5 text-[10px] uppercase text-slate-500">Bloco</td>
                    <td className="px-2 py-1.5 text-slate-900 dark:text-slate-200">
                      {b.nome}{b.pendente && <span className="ml-1 text-[10px] font-normal text-na">(sem lançamento, conta 0)</span>}
                    </td>
                    <td className={`${TD_NUM} text-slate-600 dark:text-slate-400`}>
                      {formatNumber(inds.filter(l => l.percentual != null).reduce((s, l) => s + (l.metaPeriodo ?? 0), 0))}
                    </td>
                    <td className={TD_NUM}>
                      {formatNumber(inds.filter(l => l.percentual != null).reduce((s, l) => s + l.realizadoAcum, 0))}
                    </td>
                    <td className={TD_NUM}>{b.alcance != null ? formatPercent(b.alcance) : '—'}</td>
                    <td />
                    <td className={TD_NUM}>{b.consideradoPerc != null ? formatPercent(b.consideradoPerc) : '—'}</td>
                    <td className={TD_NUM}>{formatNumber(b.peso)}</td>
                    <td className={TD_NUM}>{b.pontos != null ? formatNumber(b.pontos) : ''}</td>
                  </tr>
                  {inds.map(l => <LinhaInd key={l.indicadorId} l={l} recuo />)}
                </Fragment>
              )))}
        </tbody>
        {(quant || qual) && (
          <tfoot className="border-t-2 border-border-light dark:border-border-dark">
            {quant && (
              <tr className="font-semibold">
                <td className="px-2 py-1.5" colSpan={6}>Total quantitativo{quant.pendentes > 0 ? ` (${quant.pendentes} bloco(s) sem lançamento)` : ''}</td>
                <td className={TD_NUM}>{formatPercent(quant.percentual)}</td>
                <td className={TD_NUM}>{formatNumber(quant.peso)}</td>
                <td className={TD_NUM}>{formatNumber(quant.pontos)}</td>
              </tr>
            )}
            {qual && (
              <tr className="font-semibold">
                <td className="px-2 py-1.5" colSpan={6}>
                  Total qualitativo — nota {qual.nota != null ? formatPercent(qual.nota) : '—'}
                  {qual.percEscala != null && ` → recebe ${formatPercent(qual.percEscala)} da parte variável`}
                  {qual.pendentes > 0 && <span className="ml-1 font-normal text-na">({qual.pendentes} sem lançamento, contam 0)</span>}
                </td>
                <td className={TD_NUM}>{qual.nota != null ? formatPercent(qual.nota) : '—'}</td>
                <td className={TD_NUM}>{formatNumber(qual.peso)}</td>
                <td className={TD_NUM}>{formatNumber(qual.pontos)}</td>
              </tr>
            )}
          </tfoot>
        )}
      </table>
    </div>
  )
}
