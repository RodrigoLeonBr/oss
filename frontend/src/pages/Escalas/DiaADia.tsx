import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { Grade, Plantao, Turno } from './types'
import { corPlantao, dica, DIAS_SEMANA, diaDaSemana, fmtH, hhmm, LEGENDA, ordemFuncao, turnosDoPlantao } from './types'

const TURNOS: { t: Turno; label: string }[] = [{ t: 'dia', label: 'Dia 07–19' }, { t: 'noite', label: 'Noite 19–07' }]

/** Escala do setor dia a dia: linha = dia, coluna = função × turno, célula = quem estava escalado. */
export default function DiaADia({ grade }: { grade: Grade }) {
  const [ocultas, setOcultas] = useState<Set<string>>(new Set())

  const { funcoes, labels, celulas, dupla } = useMemo(() => {
    const labels = new Map<string, string>()
    const celulas = new Map<string, Plantao[]>() // `${data}|${funcao}|${turno}`
    const dias = new Set(grade.dias)
    grade.plantoes.filter(p => p.classe !== 'ausencia').forEach(p => {
      labels.set(p.funcao, p.funcaoLabel)
      turnosDoPlantao(p).forEach(({ data, turno }) => {
        if (!dias.has(data)) return
        const k = `${data}|${p.funcao}|${turno}`
        const l = celulas.get(k) ?? []
        if (!l.includes(p)) l.push(p)
        celulas.set(k, l)
      })
    })
    // Mesmo profissional com plantões distintos no Dia e na Noite do mesmo dia → horas somadas (ex.: 24h).
    const dupla = new Map<string, number>() // `${data}|${profissionalId}` → horas
    grade.dias.forEach(d => labels.forEach((_, f) => {
      const dia = (celulas.get(`${d}|${f}|dia`) ?? []).filter(p => p.profissionalId)
      const noite = (celulas.get(`${d}|${f}|noite`) ?? []).filter(p => p.profissionalId)
      new Set(dia.map(p => p.profissionalId)).forEach(id => {
        const ps = new Set([...dia, ...noite].filter(p => p.profissionalId === id))
        const doisPlantoes = noite.some(p => p.profissionalId === id && !dia.includes(p))
        if (!doisPlantoes && ![...ps].some(p => p.horas >= 24)) return // 12–21 toca a noite, mas não é dia+noite
        dupla.set(`${d}|${id}`, [...ps].reduce((h, p) => h + p.horas, 0))
      })
    }))
    const funcoes = [...labels.keys()].sort((a, b) => ordemFuncao(a, b, labels))
    return { funcoes, labels, celulas, dupla }
  }, [grade])

  const visiveis = funcoes.filter(f => !ocultas.has(f))
  const escalados = (ps: Plantao[]) => ps.filter(p => p.profissionalId)
  const semEscala = (d: string, f: string, t: Turno) => escalados(celulas.get(`${d}|${f}|${t}`) ?? []).length === 0
  const alternar = (f: string) => setOcultas(s => {
    const n = new Set(s)
    if (n.has(f)) n.delete(f)
    else n.add(f)
    return n
  })

  if (funcoes.length === 0) {
    return (
      <div className="rounded-2xl border border-status-bad-border bg-status-bad-bg py-12 text-center text-sm text-status-bad">
        Nenhuma escala apresentada neste mês.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm">
        <span className="text-text-muted">Funções:</span>
        {funcoes.map(f => (
          <button key={f} type="button" onClick={() => alternar(f)} aria-pressed={!ocultas.has(f)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${ocultas.has(f) ? 'border-border-subtle text-text-faint line-through' : 'border-primary bg-primary/10 text-primary'}`}>
            {labels.get(f)}
          </button>
        ))}
      </div>

      {labels.has('medico') && (
        <div className="flex items-center gap-2 rounded-xl border border-status-warn-border bg-status-warn-bg px-4 py-2 text-xs text-status-warn">
          <AlertTriangle size={14} />
          A escala médica não informa a especialidade de cada posto (clínico × pediatra). Item 2.2.9 da solicitação à OSS.
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-text-muted">
        {LEGENDA.filter(l => !l.label.startsWith('Folga')).map(l => (
          <span key={l.label} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded border ${l.cls}`} />{l.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-status-bad-bg" />Turno sem escala</span>
        <span className="inline-flex items-center gap-1.5"><span className="rounded bg-primary px-1 text-[9px] font-bold text-white">24h</span>Dia + noite do mesmo profissional (horas somadas)</span>
      </div>

      <div className="max-h-[75vh] overflow-auto rounded-2xl border border-border-subtle bg-surface shadow-sm">
        <table className="w-full border-collapse text-xs" style={{ minWidth: 90 + visiveis.length * 2 * 190 }}>
          <thead className="sticky top-0 z-20 bg-surface text-text-secondary">
            <tr className="bg-primary/5">
              <th rowSpan={2} className="sticky left-0 z-30 bg-surface px-3 py-2 text-left font-medium">Dia</th>
              {visiveis.map(f => (
                <th key={f} colSpan={2} className="border-l border-border-subtle px-2 py-1.5 text-center font-semibold text-primary">{labels.get(f)}</th>
              ))}
            </tr>
            <tr className="bg-primary/5">
              {visiveis.flatMap(f => TURNOS.map(({ t, label }) => (
                <th key={`${f}${t}`} className={`px-2 py-1 text-left font-medium ${t === 'dia' ? 'border-l border-border-subtle' : ''}`}>{label}</th>
              )))}
            </tr>
          </thead>
          <tbody>
            {grade.dias.map(d => {
              const dow = diaDaSemana(d)
              const fds = dow === 0 || dow === 6
              return (
                <tr key={d} className={`border-t border-border-subtle ${fds ? 'bg-surface-alt/50' : ''}`}>
                  <td className={`sticky left-0 z-10 whitespace-nowrap px-3 py-1.5 align-top font-mono ${fds ? 'bg-surface-alt' : 'bg-surface'}`}>
                    {d.slice(8)}/{d.slice(5, 7)} <span className="text-text-faint">{DIAS_SEMANA[dow]}</span>
                  </td>
                  {visiveis.flatMap(f => TURNOS.map(({ t }) => {
                    const ps = celulas.get(`${d}|${f}|${t}`) ?? []
                    const vazio = semEscala(d, f, t)
                    return (
                      <td key={`${f}${t}`} className={`px-1.5 py-1 align-top ${t === 'dia' ? 'border-l border-border-subtle' : ''} ${vazio ? 'bg-status-bad-bg/70' : ''}`}>
                        {vazio && <div className="font-semibold text-status-bad">sem escala</div>}
                        <div className="flex flex-col gap-0.5">
                          {ps.map(p => (
                            <span key={p.plantaoId} title={dica(p)}
                              className={`flex items-center gap-1 rounded border px-1 leading-4 ${corPlantao(p)} ${p.marcacao === 'riscado' ? 'line-through' : ''}`}>
                              <span className="truncate">{p.profissional ?? 'POSTO VAGO'}</span>
                              <span className="ml-auto shrink-0 font-mono text-[10px] opacity-70">{hhmm(p.inicio)}–{hhmm(p.fim)}</span>
                              {p.modalidade === 'sobreaviso' && <span className="shrink-0 text-[9px]">sob.</span>}
                              {p.vinculo === 'pma' && <span className="shrink-0 text-[9px] font-bold">PMA</span>}
                              {p.profissionalId && dupla.has(`${d}|${p.profissionalId}`) && (
                                <span title="Dia + noite do mesmo profissional" className="shrink-0 rounded bg-primary px-1 text-[9px] font-bold text-white">
                                  {fmtH(dupla.get(`${d}|${p.profissionalId}`) ?? 0)}h
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                        {escalados(ps).length > 1 && <div className="mt-0.5 text-right text-[10px] text-text-faint">{escalados(ps).length} profissionais</div>}
                      </td>
                    )
                  }))}
                </tr>
              )
            })}
          </tbody>
          <tfoot className="sticky bottom-0 bg-surface font-semibold">
            <tr className="border-t-2 border-border-subtle">
              <td className="sticky left-0 bg-surface px-3 py-1.5">Turnos sem escala</td>
              {visiveis.flatMap(f => TURNOS.map(({ t }) => {
                const n = grade.dias.filter(d => semEscala(d, f, t)).length
                return (
                  <td key={`${f}${t}`} className={`px-2 py-1.5 font-mono ${t === 'dia' ? 'border-l border-border-subtle' : ''} ${n ? 'text-status-bad' : 'text-text-faint'}`}>{n}</td>
                )
              }))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
