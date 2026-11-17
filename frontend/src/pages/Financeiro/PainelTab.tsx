import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import { ArrowUpRight, ChevronUp, Loader2, Flag, FileDown } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useApi, ApiError } from '../../hooks/useApi'
import { Barra, EscopoFiltro, Erro, PeriodoFiltro, classeLbl, classeSel } from './Filtros'
import {
  CONTA_LABEL, GRID, PALETA, TICK, escopoQuery, fmtBRL, fmtCurto, fmtMes, fmtPct, periodoQuery, unwrap,
  type Comparativo, type Detalhe, type Escopo, type Kpis, type OpcaoEscopo, type Periodo, type Resumo, type Serie,
} from './types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend)

type Modo = 'resumido' | 'serie' | 'comparativo' | 'detalhado'
const MODOS: { v: Modo; label: string }[] = [
  { v: 'resumido', label: 'Resumido' },
  { v: 'serie', label: 'Série histórica' },
  { v: 'comparativo', label: 'Comparativo anos' },
  { v: 'detalhado', label: 'Detalhado' },
]

const opcoesGrafico = (empilhado = false) => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: { position: 'top' as const, align: 'end' as const, labels: { boxWidth: 12, color: TICK } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tooltip: { callbacks: { label: (c: any) => `${c.dataset.label}: ${fmtBRL(c.parsed.y)}` } },
  },
  scales: {
    x: { stacked: empilhado, grid: { display: false }, ticks: { color: TICK } },
    y: { stacked: empilhado, grid: { color: GRID }, ticks: { color: TICK, callback: (v: number | string) => fmtCurto(Number(v)) } },
  },
})

function Kpi({ titulo, valor, delta, dica, inverter = false }: {
  titulo: string; valor: string; delta?: number | null; dica?: string; inverter?: boolean
}) {
  const ruim = delta != null && (inverter ? delta < 0 : delta > 0)
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border-subtle bg-surface px-4 py-3 shadow-sm" title={dica}>
      <span className="text-xs font-medium uppercase tracking-wide text-text-muted">{titulo}</span>
      <span className="font-mono text-lg font-semibold text-text-primary">{valor}</span>
      {delta !== undefined && (
        <span className={`text-xs ${delta == null ? 'text-text-faint' : ruim ? 'text-status-warn' : 'text-status-ok'}`}>
          {delta == null ? 'sem base anterior' : `${fmtPct(delta)} vs período anterior`}
        </span>
      )}
    </div>
  )
}

function Fluxo({ k }: { k: Kpis }) {
  const linhas: [string, number | null, string?][] = [
    ['Saldo inicial', k.saldoInicial],
    ['+ Repasse', k.repasse],
    ['+ Rendimentos', k.rendimento],
    ...(k.outrasReceitas ? [['+ Outras receitas', k.outrasReceitas] as [string, number]] : []),
    ['± Transferências', k.transferencias],
    ['± Recursos próprios / arred.', k.recursosProprios + k.arredondamento],
    ['− Despesas', -k.despesa],
    ['= Saldo final', k.saldoFinal, 'font-semibold border-t border-border-subtle'],
  ]
  return (
    <table className="w-full text-sm">
      <tbody>
        {linhas.map(([r, v, cls]) => (
          <tr key={r} className={cls}>
            <td className="py-1 text-text-secondary">{r}</td>
            <td className="py-1 text-right font-mono">{fmtBRL(v)}</td>
          </tr>
        ))}
        {k.diferencaFluxo != null && Math.abs(k.diferencaFluxo) > 0.1 && (
          <tr><td colSpan={2} className="pt-2 text-xs text-status-warn">
            Fluxo não fecha em {fmtBRL(k.diferencaFluxo)}: há mês sem saldo informado ou lançamento faltando.
          </td></tr>
        )}
      </tbody>
    </table>
  )
}

function GruposDespesa({ k }: { k: Kpis }) {
  const max = Math.max(...k.despesaPorGrupo.map(g => g.valor), 1)
  return (
    <div className="flex flex-col gap-1.5">
      {k.despesaPorGrupo.map(g => (
        <div key={g.codigo} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 text-sm">
          <div className="min-w-0">
            <div className="truncate text-text-secondary" title={g.nome}>{g.nome}</div>
            <div className="h-1.5 rounded-full bg-primary/10">
              <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(g.valor / max) * 100}%` }} />
            </div>
          </div>
          <div className="text-right font-mono text-xs">{fmtCurto(g.valor)} · {g.perc.toFixed(1)}%</div>
        </div>
      ))}
      {!k.despesaPorGrupo.length && <span className="text-sm text-text-muted">Sem despesas no período.</span>}
      {k.despesaPorGrupo.some(g => g.codigo.startsWith('plano:')) && (
        <span className="pt-1 text-xs text-text-faint">Grupos do plano original (grupo canônico ainda não mapeado).</span>
      )}
    </div>
  )
}

function Cartao({ titulo, children, className = '' }: { titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border-subtle bg-surface p-4 shadow-sm ${className}`}>
      <h3 className="mb-3 text-sm font-semibold text-text-primary">{titulo}</h3>
      {children}
    </section>
  )
}

// ── Resumido ──
function Resumido({ dados, onDrill }: { dados: Resumo; onDrill: (nivel: string, id: string) => void }) {
  const { atual: k, variacao: v } = dados
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi titulo="Repasse" valor={fmtCurto(k.repasse)} delta={v.repasse} inverter dica={fmtBRL(k.repasse)} />
        <Kpi titulo="Despesa" valor={fmtCurto(k.despesa)} delta={v.despesa} dica={fmtBRL(k.despesa)} />
        <Kpi titulo="Rendimentos" valor={fmtCurto(k.rendimento)} dica={fmtBRL(k.rendimento)} />
        <Kpi titulo="Saldo final" valor={fmtCurto(k.saldoFinal)} delta={v.saldoFinal} inverter dica={fmtBRL(k.saldoFinal)} />
        <Kpi titulo="Cobertura" valor={k.coberturaMeses == null ? '—' : `${k.coberturaMeses.toLocaleString('pt-BR')} meses`}
          dica="Saldo final ÷ repasse médio mensal do período" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Cartao titulo={`Fluxo · ${dados.janela.rotulo}`}><Fluxo k={k} /></Cartao>
        <Cartao titulo="Despesa por grupo" className="lg:col-span-2"><GruposDespesa k={k} /></Cartao>
      </div>

      {dados.nivel !== 'conta' && (
        <section className="overflow-x-auto rounded-xl border border-border-subtle bg-surface shadow-sm">
          <table className="w-full text-sm" style={{ minWidth: 820 }}>
            <thead className="bg-primary/5 text-text-secondary">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{{ oss: 'OSS', contrato: 'Contrato', unidade: 'Unidade', conta: 'Conta', grupo: 'Grupo' }[dados.drill[0]?.nivel ?? 'oss']}</th>
                <th className="px-3 py-2 text-right font-medium">Repasse</th>
                <th className="px-3 py-2 text-right font-medium">Despesa</th>
                <th className="px-3 py-2 text-right font-medium">Δ despesa</th>
                <th className="px-3 py-2 text-right font-medium">Saldo inicial</th>
                <th className="px-3 py-2 text-right font-medium">Saldo final</th>
                <th className="px-3 py-2 text-right font-medium">Cobertura</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {dados.drill.map(d => {
                const desce = d.nivel !== 'grupo'
                const nome = d.nivel === 'conta' ? d.nome.replace(/(\S+)$/, m => CONTA_LABEL[m] ?? m) : d.nome
                return (
                  <tr key={d.id} onClick={desce ? () => onDrill(d.nivel, d.id) : undefined}
                    className={`border-t border-border-subtle ${desce ? 'cursor-pointer hover:bg-hover' : ''}`}>
                    <td className="px-3 py-2 font-medium text-text-primary">{nome}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtBRL(d.repasse)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtBRL(d.nivel === 'grupo' ? (d as { despesa?: number }).despesa : d.despesa)}</td>
                    <td className="px-3 py-2 text-right">{d.nivel === 'grupo' ? `${d.perc?.toFixed(1)}%` : fmtPct(d.deltaDespesa)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtBRL(d.saldoInicial)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtBRL(d.saldoFinal)}</td>
                    <td className="px-3 py-2 text-right">{d.coberturaMeses == null ? '—' : `${d.coberturaMeses} m`}</td>
                    <td className="px-2 text-text-faint">{desce && <ArrowUpRight size={14} />}</td>
                  </tr>
                )
              })}
              {!dados.drill.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-text-muted">Sem dados no período.</td></tr>}
            </tbody>
          </table>
        </section>
      )}

      {dados.pendencias.length > 0 && (
        <Cartao titulo={`Pendências abertas com a OSS (${dados.pendencias.length})`}>
          <ul className="flex flex-col gap-2 text-sm">
            {dados.pendencias.map(p => (
              <li key={p.obs_id} className="flex gap-2">
                <Flag size={14} className="mt-0.5 shrink-0 text-status-warn" />
                <span><span className="text-text-muted">{p.contrato}{p.sigla ? ` · ${p.sigla}` : ''}{p.mes_referencia ? ` · ${fmtMes(p.mes_referencia)}` : ''} — </span>{p.texto}</span>
              </li>
            ))}
          </ul>
        </Cartao>
      )}
    </div>
  )
}

// ── Série ──
function SerieView({ dados }: { dados: Serie }) {
  const labels = dados.pontos.map(p => p.periodo)
  const grupos = useMemo(() => {
    const tot = new Map<string, number>()
    dados.pontos.forEach(p => p.despesaPorGrupo.forEach(g => tot.set(g.nome, (tot.get(g.nome) ?? 0) + g.valor)))
    const top = [...tot.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n)
    return { top: top.slice(0, 8), resto: top.slice(8) }
  }, [dados])
  const fluxo = {
    labels,
    datasets: [
      { type: 'bar' as const, label: 'Repasse', data: dados.pontos.map(p => p.repasse), backgroundColor: 'rgba(27,58,102,0.75)', borderRadius: 3 },
      { type: 'bar' as const, label: 'Despesa', data: dados.pontos.map(p => p.despesa), backgroundColor: 'rgba(182,120,16,0.75)', borderRadius: 3 },
    ],
  }
  const saldo = {
    labels,
    datasets: [{ label: 'Saldo (fim do período)', data: dados.pontos.map(p => p.saldo), borderColor: '#0d7373', backgroundColor: 'rgba(13,115,115,0.1)', fill: true, tension: 0.3, pointRadius: 3 }],
  }
  const valorGrupo = (p: Serie['pontos'][number], nomes: string[]) =>
    p.despesaPorGrupo.filter(g => nomes.includes(g.nome)).reduce((s, g) => s + g.valor, 0)
  const empilhado = {
    labels,
    datasets: [
      ...grupos.top.map((n, i) => ({ label: n, data: dados.pontos.map(p => valorGrupo(p, [n])), backgroundColor: PALETA[i % PALETA.length] })),
      ...(grupos.resto.length ? [{ label: 'Demais grupos', data: dados.pontos.map(p => valorGrupo(p, grupos.resto)), backgroundColor: PALETA[9] }] : []),
    ],
  }
  if (!dados.pontos.length) return <div className="py-16 text-center text-sm text-text-muted">Sem dados no intervalo.</div>
  return (
    <div className="flex flex-col gap-4">
      {dados.marcos.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {dados.marcos.map(m => (
            <span key={m.mes + m.rotulo} className="rounded-full border border-border-subtle px-2.5 py-1 text-text-secondary">
              {fmtMes(m.mes)} · {m.rotulo}
            </span>
          ))}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Cartao titulo="Repasse × despesa"><div className="h-64"><Bar data={fluxo} options={opcoesGrafico()} /></div></Cartao>
        <Cartao titulo="Saldo em conta"><div className="h-64"><Line data={saldo} options={opcoesGrafico()} /></div></Cartao>
      </div>
      <Cartao titulo="Despesa por grupo"><div className="h-80"><Bar data={empilhado} options={opcoesGrafico(true)} /></div></Cartao>
    </div>
  )
}

// ── Comparativo ──
function ComparativoView({ dados }: { dados: Comparativo }) {
  const maxMeses = Math.max(...dados.anos.map(a => a.mensal.length), 0)
  const linhas = {
    labels: Array.from({ length: maxMeses }, (_, i) => `Mês ${i + 1}`),
    datasets: dados.anos.map((a, i) => ({
      label: String(a.ano), data: a.mensal.map(m => m.despesa), borderColor: PALETA[i % PALETA.length],
      backgroundColor: 'transparent', tension: 0.3, pointRadius: 3,
    })),
  }
  return (
    <div className="flex flex-col gap-4">
      <section className="overflow-x-auto rounded-xl border border-border-subtle bg-surface shadow-sm">
        <table className="w-full text-sm" style={{ minWidth: 820 }}>
          <thead className="bg-primary/5 text-text-secondary">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Período</th>
              <th className="px-3 py-2 text-right font-medium">Repasse</th>
              <th className="px-3 py-2 text-right font-medium">Δ</th>
              <th className="px-3 py-2 text-right font-medium">Despesa</th>
              <th className="px-3 py-2 text-right font-medium">Δ</th>
              <th className="px-3 py-2 text-right font-medium">Rendimentos</th>
              <th className="px-3 py-2 text-right font-medium">Saldo final</th>
              <th className="px-3 py-2 text-right font-medium">Cobertura</th>
            </tr>
          </thead>
          <tbody>
            {dados.anos.map(a => (
              <tr key={a.ano} className="border-t border-border-subtle">
                <td className="px-3 py-2 font-medium">{a.rotulo}{!a.mesesComDados && <span className="ml-2 text-xs text-text-faint">sem dados</span>}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtBRL(a.repasse)}</td>
                <td className="px-3 py-2 text-right">{fmtPct(a.deltaRepasse)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtBRL(a.despesa)}</td>
                <td className="px-3 py-2 text-right">{fmtPct(a.deltaDespesa)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtBRL(a.rendimento)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtBRL(a.saldoFinal)}</td>
                <td className="px-3 py-2 text-right">{a.coberturaMeses == null ? '—' : `${a.coberturaMeses} m`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <Cartao titulo="Despesa mês a mês dentro do período, por ano">
        <div className="h-72"><Line data={linhas} options={opcoesGrafico()} /></div>
      </Cartao>
    </div>
  )
}

// ── Detalhado ──
function DetalheView({ dados }: { dados: Detalhe }) {
  const [soGrupos, setSoGrupos] = useState(false)
  const linhas = dados.linhas.filter(l => !soGrupos || l.nivel === 'grupo')
  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <input type="checkbox" checked={soGrupos} onChange={e => setSoGrupos(e.target.checked)} /> Só grupos
      </label>
      <section className="max-h-[70vh] overflow-auto rounded-xl border border-border-subtle bg-surface shadow-sm">
        <table className="w-full text-sm" style={{ minWidth: 300 + dados.meses.length * 120 }}>
          <thead className="sticky top-0 z-10 bg-surface text-text-secondary shadow-[0_1px_0_var(--border-subtle)]">
            <tr>
              <th className="sticky left-0 bg-surface px-3 py-2 text-left font-medium">Rubrica</th>
              {dados.meses.map(m => <th key={m} className="px-3 py-2 text-right font-medium">{fmtMes(m)}</th>)}
              <th className="px-3 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(l => (
              <tr key={l.rubrica_id} className={`border-t border-border-subtle ${l.nivel === 'grupo' ? 'bg-primary/5 font-semibold' : ''}`}>
                <td className={`sticky left-0 px-3 py-1.5 ${l.nivel === 'grupo' ? 'bg-[inherit]' : 'bg-surface pl-6'}`}>
                  <span className="mr-2 font-mono text-xs text-text-faint">{l.codigo}</span>{l.nome}
                  {l.grupo_canonico && l.nivel === 'grupo' && <span className="ml-2 text-xs font-normal text-text-muted">→ {l.grupo_canonico}</span>}
                </td>
                {l.valores.map((v, i) => <td key={i} className="px-3 py-1.5 text-right font-mono">{v ? fmtBRL(v) : '—'}</td>)}
                <td className="px-3 py-1.5 text-right font-mono">{fmtBRL(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {dados.observacoes.length > 0 && (
        <Cartao titulo="Observações do período">
          <ul className="flex flex-col gap-2 text-sm">
            {dados.observacoes.map(o => (
              <li key={o.obs_id}>
                <span className="text-xs uppercase text-text-muted">{o.tipo}{o.sigla ? ` · ${o.sigla}` : ''}{o.conta ? ` · ${CONTA_LABEL[o.conta]}` : ''}{o.mes_referencia ? ` · ${fmtMes(o.mes_referencia)}` : ''}{o.secao ? ` · ${o.secao}` : ''}</span>
                <p className="whitespace-pre-line text-text-primary">{o.texto}</p>
              </li>
            ))}
          </ul>
        </Cartao>
      )}
    </div>
  )
}

// ── Painel ──
export default function PainelTab({ opcoes }: { opcoes: OpcaoEscopo[] }) {
  const { get } = useApi()
  const { token } = useAuth()
  const ano = new Date().getFullYear()
  const [baixando, setBaixando] = useState(false)
  const [modo, setModo] = useState<Modo>('resumido')
  const [escopo, setEscopo] = useState<Escopo>({ ossId: '', contratoId: '', unidadeId: '', conta: '' })
  const [periodo, setPeriodo] = useState<Periodo>({ tipo: 'quadrimestral', ano, n: 2, ini: `${ano}-01`, fim: `${ano}-12` })
  const [serieCfg, setSerieCfg] = useState({ ini: '2022-01', fim: `${ano}-12`, granularidade: 'mes' })
  const [compCfg, setCompCfg] = useState({ de: 2022, ate: ano })
  const [dados, setDados] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const detalheSemContrato = modo === 'detalhado' && !escopo.contratoId && !escopo.unidadeId
  const url = useMemo(() => {
    const q = escopoQuery(escopo)
    if (modo === 'serie') {
      q.set('ini', serieCfg.ini); q.set('fim', serieCfg.fim); q.set('granularidade', serieCfg.granularidade)
      return `/financeiro/painel/serie?${q}`
    }
    if (modo === 'comparativo') {
      const tipo = periodo.tipo === 'livre' ? 'anual' : periodo.tipo
      q.set('tipo', tipo); q.set('n', String(periodo.n))
      q.set('anos', Array.from({ length: Math.max(0, compCfg.ate - compCfg.de + 1) }, (_, i) => compCfg.de + i).join(','))
      return `/financeiro/painel/comparativo?${q}`
    }
    return `/financeiro/painel/${modo === 'detalhado' ? 'detalhe' : 'resumo'}?${periodoQuery(periodo, q)}`
  }, [escopo, modo, periodo, serieCfg, compCfg])

  const carregar = useCallback(async () => {
    if (detalheSemContrato) { setDados(null); return }
    setLoading(true); setErro(null)
    try { setDados(unwrap(await get(url))) } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao consultar o financeiro.'); setDados(null)
    } finally { setLoading(false) }
  }, [get, url, detalheSemContrato])
  useEffect(() => { carregar() }, [carregar])

  const drill = (nivel: string, id: string) => {
    if (nivel === 'oss') setEscopo({ ossId: id, contratoId: '', unidadeId: '', conta: '' })
    else if (nivel === 'contrato') setEscopo(e => ({ ...e, contratoId: id, unidadeId: '', conta: '' }))
    else if (nivel === 'unidade') setEscopo(e => ({ ...e, unidadeId: id, conta: '' }))
    else if (nivel === 'conta') {
      const [u, c] = id.split('|')
      setEscopo(e => ({ ...e, unidadeId: u, conta: c as Escopo['conta'] }))
    }
  }
  const subir = () => setEscopo(e => (e.conta ? { ...e, conta: '' } : e.unidadeId ? { ...e, unidadeId: '' }
    : e.contratoId ? { ...e, contratoId: '' } : { ...e, ossId: '' }))
  // .docx vem binário: fetch direto (useApi só trata JSON)
  const baixarRelatorio = async () => {
    setBaixando(true); setErro(null)
    try {
      const q = periodoQuery(periodo, new URLSearchParams({ contrato_id: escopo.contratoId }))
      const res = await fetch(`/api/financeiro/relatorio.docx?${q}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!res.ok) {
        const t = await res.text()
        let msg = t
        try { msg = (JSON.parse(t) as { message?: string }).message ?? t } catch { /* texto puro */ }
        throw new Error(msg || `Erro HTTP ${res.status}`)
      }
      const nome = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'relatorio-comissao.docx'
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a'); a.href = url; a.download = nome; a.click(); URL.revokeObjectURL(url)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao gerar o relatório.') } finally { setBaixando(false) }
  }
  const temEscopo = escopo.ossId || escopo.contratoId || escopo.unidadeId || escopo.conta

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1 rounded-lg border border-border-subtle bg-surface p-1 text-sm" role="tablist">
        {MODOS.map(m => (
          <button key={m.v} type="button" role="tab" aria-selected={modo === m.v} onClick={() => { setModo(m.v); setDados(null) }}
            className={`rounded-md px-3 py-1.5 font-medium ${modo === m.v ? 'bg-primary text-white' : 'text-text-secondary hover:bg-hover'}`}>
            {m.label}
          </button>
        ))}
      </div>

      <Barra>
        <EscopoFiltro opcoes={opcoes} value={escopo} onChange={setEscopo} />
        {temEscopo && (
          <button type="button" onClick={subir} className="mb-0.5 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-text-secondary hover:bg-hover">
            <ChevronUp size={14} />Subir nível
          </button>
        )}
        <div className="hidden h-9 w-px bg-border-subtle md:block" />
        {modo === 'serie' ? (
          <>
            <label className={classeLbl}>De<input type="month" className={classeSel} value={serieCfg.ini} onChange={e => setSerieCfg(s => ({ ...s, ini: e.target.value }))} /></label>
            <label className={classeLbl}>Até<input type="month" className={classeSel} value={serieCfg.fim} onChange={e => setSerieCfg(s => ({ ...s, fim: e.target.value }))} /></label>
            <label className={classeLbl}>Agrupar por
              <select className={classeSel} value={serieCfg.granularidade} onChange={e => setSerieCfg(s => ({ ...s, granularidade: e.target.value }))}>
                <option value="mes">Mês</option><option value="trim">Trimestre</option><option value="quad">Quadrimestre</option><option value="ano">Ano</option>
              </select>
            </label>
          </>
        ) : modo === 'comparativo' ? (
          <>
            <PeriodoFiltro value={{ ...periodo, tipo: periodo.tipo === 'livre' ? 'anual' : periodo.tipo }} onChange={setPeriodo} semLivre />
            <label className={classeLbl}>Anos de
              <input type="number" className={`${classeSel} w-24`} value={compCfg.de} min={2015} max={compCfg.ate} onChange={e => setCompCfg(c => ({ ...c, de: Number(e.target.value) }))} />
            </label>
            <label className={classeLbl}>até
              <input type="number" className={`${classeSel} w-24`} value={compCfg.ate} min={compCfg.de} max={ano} onChange={e => setCompCfg(c => ({ ...c, ate: Number(e.target.value) }))} />
            </label>
          </>
        ) : (
          <PeriodoFiltro value={periodo} onChange={setPeriodo} />
        )}
        {loading && <Loader2 size={18} className="mb-2 animate-spin text-primary" />}
        {(modo === 'resumido' || modo === 'detalhado') && (
          <button type="button" onClick={baixarRelatorio} disabled={!escopo.contratoId || baixando}
            title={escopo.contratoId ? 'Relatório da comissão do período (metas + financeiro), no modelo oficial' : 'Escolha um contrato'}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm font-medium text-text-secondary hover:bg-hover disabled:opacity-50">
            {baixando ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}Relatório .docx
          </button>
        )}
      </Barra>

      <Erro msg={erro} />
      {detalheSemContrato && <div className="py-12 text-center text-sm text-text-muted">O detalhado usa o plano de rubricas do contrato: escolha um contrato ou unidade.</div>}
      {!!dados && modo === 'resumido' && <Resumido dados={dados as Resumo} onDrill={drill} />}
      {!!dados && modo === 'serie' && <SerieView dados={dados as Serie} />}
      {!!dados && modo === 'comparativo' && <ComparativoView dados={dados as Comparativo} />}
      {!!dados && modo === 'detalhado' && <DetalheView dados={dados as Detalhe} />}
    </div>
  )
}
