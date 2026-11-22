import { Fragment, useMemo, useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import type { Grade, Plantao, Turno, Visao } from './types'
import {
  corPlantao, dica, DIAS_SEMANA, diaDaSemana, fmtH, hora, hhmm, LEGENDA, baixarTsv, ordemFuncao, turnosDoPlantao,
} from './types'

interface Props {
  grade: Grade
  /** 'profissional' = linha por profissional (visão do setor); 'setor' = linha por unidade·setor (visão do profissional) */
  linhaPor: 'profissional' | 'setor'
  nomeArquivo: string
}

interface Linha {
  chave: string
  vago: boolean
  funcao: string
  titulo: string
  sub: string | null
  porDia: Map<string, Plantao[]>
  prev: { pl: number; h: number }
  real: { pl: number; h: number }
  nao: number
}

const visivel = (p: Plantao, v: Visao) =>
  v === 'ambos' || (v === 'previsto' ? p.classe !== 'ausencia' : p.classe === 'realizado')

function rotulo(p: Plantao) {
  if (p.classe === 'ausencia') return p.marcacao === 'folga' ? 'F' : p.marcacao.slice(0, 2).toUpperCase()
  return `${hora(p.inicio)}${p.modalidade === 'sobreaviso' ? 's' : ''}`
}

const NOME_TURNO: Record<Turno, string> = { dia: 'Dia (07–19)', noite: 'Noite (19–07)' }

export default function GradeMes({ grade, linhaPor, nomeArquivo }: Props) {
  const [visao, setVisao] = useState<Visao>('ambos')
  const porSetor = linhaPor === 'profissional'

  const { linhas, labels } = useMemo(() => {
    const m = new Map<string, Linha>()
    const labels = new Map<string, string>()
    grade.plantoes.forEach(p => {
      labels.set(p.funcao, p.funcaoLabel)
      const chave = porSetor ? `${p.funcao}|${p.profissionalId ?? 'vago'}` : `${p.unidadeId}|${p.setorId}`
      let l = m.get(chave)
      if (!l) {
        l = {
          chave,
          vago: porSetor && !p.profissionalId,
          funcao: porSetor ? p.funcao : '',
          titulo: porSetor ? (p.profissional ?? 'Posto vago') : `${p.unidade} · ${p.setor ?? '—'}`,
          sub: porSetor ? p.registro : null,
          porDia: new Map(), prev: { pl: 0, h: 0 }, real: { pl: 0, h: 0 }, nao: 0,
        }
        m.set(chave, l)
      }
      const dia = l.porDia.get(p.data) ?? []
      dia.push(p)
      l.porDia.set(p.data, dia)
      if (p.classe !== 'ausencia') { l.prev.pl += 1; l.prev.h += p.horas }
      if (p.classe === 'realizado') { l.real.pl += 1; l.real.h += p.horas }
      if (p.classe === 'nao_realizado') l.nao += 1
    })
    // Agrupa por função; posto vago por último dentro do grupo.
    const linhas = [...m.values()].sort((a, b) =>
      ordemFuncao(a.funcao, b.funcao, labels) || Number(a.vago) - Number(b.vago))
    return { linhas, labels }
  }, [grade, porSetor])

  // Turnos do dia (07–19 / 19–07) com alguém escalado no setor; só na visão por setor.
  const faltando = useMemo(() => {
    const m = new Map<string, Turno[]>()
    if (!porSetor) return m
    const cobertos = new Map<string, Set<Turno>>()
    grade.plantoes.filter(p => p.classe !== 'ausencia' && p.profissionalId).forEach(p =>
      turnosDoPlantao(p).forEach(({ data, turno }) => {
        const s = cobertos.get(data) ?? new Set<Turno>()
        s.add(turno)
        cobertos.set(data, s)
      }))
    grade.dias.forEach(d => {
      const f = (['dia', 'noite'] as Turno[]).filter(t => !cobertos.get(d)?.has(t))
      if (f.length) m.set(d, f)
    })
    return m
  }, [grade, porSetor])

  const diasVazios = [...faltando.values()].filter(f => f.length === 2).length
  const turnosVazios = [...faltando.values()].reduce((s, f) => s + f.length, 0)
  const corDia = (d: string, dow: number, celula: boolean) => {
    const f = faltando.get(d)?.length ?? 0
    if (f === 2) return celula ? 'bg-status-bad-bg/60' : 'bg-status-bad-bg text-status-bad'
    if (f === 1) return celula ? 'bg-status-warn-bg/40' : 'bg-status-warn-bg text-status-warn'
    return dow === 0 || dow === 6 ? (celula ? 'bg-surface-alt/50' : 'bg-surface-alt') : ''
  }

  const vagosPorDia = useMemo(() => {
    const m = new Map<string, number>()
    grade.plantoes.forEach(p => { if (!p.profissionalId) m.set(p.data, (m.get(p.data) ?? 0) + 1) })
    return m
  }, [grade])

  const exportar = () => baixarTsv(nomeArquivo,
    ['Linha', 'Função', 'Registro', 'Data', 'Início', 'Fim', 'Horas', 'Marcação', 'Modalidade', 'Vínculo', 'Classe'],
    grade.plantoes.map(p => [
      porSetor ? (p.profissional ?? 'Posto vago') : `${p.unidade} · ${p.setor ?? ''}`,
      p.funcaoLabel, p.registro ?? '', p.data, hhmm(p.inicio), hhmm(p.fim), String(p.horas).replace('.', ','),
      p.marcacao, p.modalidade, p.vinculo, p.classe,
    ]))

  const t = grade.totais
  const minWidth = 260 + grade.dias.length * 40 + 220
  const nCols = grade.dias.length + 4
  const comGrupos = porSetor && labels.size > 1

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm">
        <span>Previsto: <strong className="font-mono">{t.previsto.plantoes}</strong> pl · <strong className="font-mono">{fmtH(t.previsto.horas)}</strong> h</span>
        <span>Realizado: <strong className="font-mono text-status-ok">{t.realizado.plantoes}</strong> pl · <strong className="font-mono text-status-ok">{fmtH(t.realizado.horas)}</strong> h</span>
        <span>Não realizado: <strong className={`font-mono ${t.naoRealizado ? 'text-status-warn' : ''}`}>{t.naoRealizado}</strong></span>
        <span>Postos vagos: <strong className={`font-mono ${t.vagos ? 'text-status-bad' : ''}`}>{t.vagos}</strong></span>
        {porSetor && (
          <>
            <span>Dias sem escala: <strong className={`font-mono ${diasVazios ? 'text-status-bad' : ''}`}>{diasVazios}</strong></span>
            <span>Turnos sem escala: <strong className={`font-mono ${turnosVazios ? 'text-status-warn' : ''}`}>{turnosVazios}</strong></span>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-border-subtle" role="group" aria-label="Visão">
            {(['ambos', 'previsto', 'realizado'] as Visao[]).map(v => (
              <button key={v} type="button" onClick={() => setVisao(v)} aria-pressed={visao === v}
                className={`px-3 py-1.5 text-xs font-medium capitalize ${visao === v ? 'bg-primary text-white' : 'text-text-secondary hover:bg-hover'}`}>
                {v === 'ambos' ? 'Tudo' : v}
              </button>
            ))}
          </div>
          <button type="button" onClick={exportar}
            className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-hover">
            <FileSpreadsheet size={14} />Excel
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-text-muted">
        {LEGENDA.map(l => (
          <span key={l.label} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded border ${l.cls}`} />{l.label}
          </span>
        ))}
        {porSetor && (
          <>
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-status-bad-bg" />Dia sem escala</span>
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-status-warn-bg" />Só um turno (dia ou noite) escalado</span>
          </>
        )}
        <span className="text-text-faint">Célula = hora de início (s = sobreaviso). Passe o mouse para detalhes.</span>
      </div>

      {linhas.length === 0 ? (
        <div className="rounded-2xl border border-status-bad-border bg-status-bad-bg py-12 text-center text-sm text-status-bad">
          Nenhuma escala apresentada neste mês.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-sm">
          <table className="w-full border-collapse text-xs" style={{ minWidth }}>
            <thead className="bg-primary/5 text-text-secondary">
              <tr>
                <th className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-medium" style={{ minWidth: 240 }}>
                  {porSetor ? 'Profissional' : 'Unidade · setor'}
                </th>
                {grade.dias.map(d => {
                  const dow = diaDaSemana(d)
                  const f = faltando.get(d)
                  return (
                    <th key={d} title={f ? `${f.map(x => NOME_TURNO[x]).join(' e ')} sem escala` : undefined}
                      className={`w-10 px-0.5 py-1 text-center font-medium ${corDia(d, dow, false)}`}>
                      <div>{Number(d.slice(8))}</div>
                      <div className="text-[10px] text-text-faint">{DIAS_SEMANA[dow]}</div>
                    </th>
                  )
                })}
                <th className="px-2 py-2 text-right font-medium">Previsto</th>
                <th className="px-2 py-2 text-right font-medium">Realizado</th>
                <th className="px-2 py-2 text-right font-medium">Não real.</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <Fragment key={l.chave}>
                  {comGrupos && l.funcao !== linhas[i - 1]?.funcao && (
                    <tr className="border-t-2 border-border-subtle bg-primary/5">
                      <td colSpan={nCols} className="sticky left-0 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                        {labels.get(l.funcao)}
                      </td>
                    </tr>
                  )}
                  <tr className={`border-t border-border-subtle ${l.vago ? 'bg-status-bad-bg/40' : ''}`}>
                    <td className="sticky left-0 z-10 bg-surface px-3 py-1.5">
                      <div className={`font-medium ${l.vago ? 'text-status-bad' : 'text-text-primary'}`}>{l.titulo}</div>
                      {l.sub && <div className="text-[10px] text-text-faint">{l.sub}</div>}
                    </td>
                    {grade.dias.map(d => {
                      const ps = (l.porDia.get(d) ?? []).filter(p => visivel(p, visao))
                      return (
                        <td key={d} className={`px-0.5 py-1 text-center align-top ${corDia(d, diaDaSemana(d), true)}`}>
                          <div className="flex flex-col gap-0.5">
                            {ps.map(p => (
                              <span key={p.plantaoId} title={dica(p)}
                                className={`block rounded border px-0.5 font-mono leading-4 ${corPlantao(p)} ${p.marcacao === 'riscado' ? 'line-through' : ''}`}>
                                {rotulo(p)}
                              </span>
                            ))}
                          </div>
                        </td>
                      )
                    })}
                    <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono">{l.prev.pl} · {fmtH(l.prev.h)}h</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-status-ok">{l.real.pl} · {fmtH(l.real.h)}h</td>
                    <td className={`px-2 py-1.5 text-right font-mono ${l.nao ? 'font-bold text-status-warn' : 'text-text-faint'}`}>{l.nao}</td>
                  </tr>
                </Fragment>
              ))}
              {vagosPorDia.size > 0 && (
                <tr className="border-t-2 border-border-subtle font-semibold">
                  <td className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-status-bad">Postos vagos no dia</td>
                  {grade.dias.map(d => (
                    <td key={d} className="text-center font-mono text-status-bad">{vagosPorDia.get(d) || ''}</td>
                  ))}
                  <td colSpan={3} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
