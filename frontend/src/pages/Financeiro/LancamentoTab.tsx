import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Lock, Plus, Save, Trash2 } from 'lucide-react'
import { useApi, ApiError } from '../../hooks/useApi'
import { usePermission } from '../../hooks/usePermission'
import { Barra, EscopoFiltro, Erro, classeLbl, classeSel } from './Filtros'
import { CONTAS, fmtBRL, unwrap, type Conta, type Escopo, type Grade, type Movimento, type OpcaoEscopo } from './types'

const num = (s: string) => {
  const t = s.trim()
  if (!t) return null
  const v = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(v) ? v : NaN
}
const txt = (v: number | null | undefined) => (v == null ? '' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const cent = (v: number | null) => Math.round((v ?? 0) * 100)

// Fora do componente pai: não perde foco a cada render.
function CampoValor({ value, onChange, disabled, label }: {
  value: string; onChange: (v: string) => void; disabled: boolean; label: string
}) {
  const invalido = Number.isNaN(num(value))
  return (
    <input aria-label={label} inputMode="decimal" disabled={disabled} value={value} onChange={e => onChange(e.target.value)}
      className={`w-36 rounded-md border px-2 py-1 text-right font-mono text-sm disabled:bg-transparent disabled:text-text-secondary ${invalido ? 'border-status-bad' : 'border-border-subtle'} bg-surface`} />
  )
}

const TIPOS_MOV: { v: Movimento['tipo']; label: string }[] = [
  { v: 'transferencia', label: 'Transferência' },
  { v: 'recursos_proprios', label: 'Recursos próprios' },
  { v: 'arredondamento', label: 'Arredondamento' },
]

export default function LancamentoTab({ opcoes }: { opcoes: OpcaoEscopo[] }) {
  const { get, put } = useApi()
  const { canUpdate } = usePermission('financeiro')
  const [escopo, setEscopo] = useState<Escopo>({ ossId: '', contratoId: '', unidadeId: '', conta: 'custeio' })
  const [mes, setMes] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7) })
  const [grade, setGrade] = useState<Grade | null>(null)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [movs, setMovs] = useState<(Movimento & { valorTxt: string })[]>([])
  const [saldo, setSaldo] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const aplicar = (g: Grade) => {
    setGrade(g)
    setValores(Object.fromEntries(g.rubricas.filter(r => r.nivel === 'categoria').map(r => [r.rubrica_id, txt(r.valor)])))
    setMovs(g.movimentos.map(m => ({ ...m, valorTxt: txt(m.valor) })))
    setSaldo(txt(g.saldo))
  }

  const carregar = useCallback(async () => {
    if (!escopo.unidadeId || !escopo.conta || !mes) { setGrade(null); return }
    setLoading(true); setErro(null); setOk(null)
    try {
      aplicar(unwrap<Grade>(await get(`/financeiro/grade?unidade_id=${escopo.unidadeId}&conta=${escopo.conta}&mes=${mes}-01`)))
    } catch (e) { setErro(e instanceof ApiError ? e.message : 'Erro ao carregar a grade.'); setGrade(null) } finally { setLoading(false) }
  }, [get, escopo.unidadeId, escopo.conta, mes])
  useEffect(() => { carregar() }, [carregar])

  const bloqueado = !canUpdate || !!grade?.fechado

  // totais vivos (o servidor recalcula ao salvar)
  const calc = useMemo(() => {
    if (!grade) return null
    const soma = (nat: string) => grade.rubricas.filter(r => r.nivel === 'categoria' && r.natureza === nat)
      .reduce((s, r) => s + cent(num(valores[r.rubrica_id] ?? '') || 0), 0)
    const porGrupo: Record<string, number> = {}
    grade.rubricas.filter(r => r.nivel === 'categoria' && r.pai).forEach(r => {
      porGrupo[r.pai!] = (porGrupo[r.pai!] ?? 0) + cent(num(valores[r.rubrica_id] ?? '') || 0)
    })
    const receitas = soma('receita'); const despesas = soma('despesa')
    const mov = movs.reduce((s, m) => s + cent(num(m.valorTxt) || 0), 0)
    const esperado = grade.saldoAnterior == null ? null : cent(grade.saldoAnterior) + receitas - despesas + mov
    const informado = num(saldo)
    const dif = esperado == null || informado == null || Number.isNaN(informado) ? null : cent(informado) - esperado
    return { receitas: receitas / 100, despesas: despesas / 100, mov: mov / 100, esperado: esperado == null ? null : esperado / 100, dif: dif == null ? null : dif / 100, porGrupo }
  }, [grade, valores, movs, saldo])

  const outrasContas = opcoes.filter(o => o.contrato_id === grade?.contrato_id)

  const salvar = async () => {
    if (!grade) return
    const invalidos = Object.values(valores).some(v => Number.isNaN(num(v))) || movs.some(m => Number.isNaN(num(m.valorTxt))) || Number.isNaN(num(saldo))
    if (invalidos) { setErro('Há valores inválidos (use 1.234,56).'); return }
    setLoading(true); setErro(null); setOk(null)
    try {
      const r = await put('/financeiro/grade', {
        unidade_id: grade.unidade_id, conta: grade.conta, mes: grade.mes,
        valores: grade.rubricas.filter(r2 => r2.nivel === 'categoria').map(r2 => ({ rubrica_id: r2.rubrica_id, valor: num(valores[r2.rubrica_id] ?? '') })),
        movimentos: movs.filter(m => m.descricao.trim()).map(m => ({
          tipo: m.tipo, contraparte_unidade_id: m.tipo === 'transferencia' ? m.contraparte_unidade_id : null,
          contraparte_conta: m.tipo === 'transferencia' ? m.contraparte_conta : null, descricao: m.descricao.trim(), valor: num(m.valorTxt) ?? 0,
        })),
        saldo: num(saldo),
      })
      aplicar(unwrap<Grade>(r)); setOk('Lançamentos gravados.')
    } catch (e) { setErro(e instanceof ApiError ? e.message : 'Erro ao gravar.') } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col gap-4">
      <Barra>
        <EscopoFiltro opcoes={opcoes} value={escopo} onChange={setEscopo} exigirUnidade />
        <label className={classeLbl}>Mês
          <input type="month" className={classeSel} value={mes} onChange={e => setMes(e.target.value)} />
        </label>
        {loading && <Loader2 size={18} className="mb-2 animate-spin text-primary" />}
      </Barra>
      <Erro msg={erro} />
      {ok && <div className="rounded-xl border border-status-ok-border bg-status-ok-bg px-4 py-3 text-sm text-status-ok">{ok}</div>}
      {!grade && !loading && <div className="py-12 text-center text-sm text-text-muted">Escolha unidade, conta e mês.</div>}

      {grade && calc && (
        <>
          {grade.fechado && (
            <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm text-text-secondary">
              <Lock size={16} />Mês fechado: só leitura. A reabertura é feita pelo admin na aba Fechamento.
            </div>
          )}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="overflow-x-auto rounded-xl border border-border-subtle bg-surface shadow-sm">
              <table className="w-full text-sm" style={{ minWidth: 560 }}>
                <thead className="bg-primary/5 text-text-secondary">
                  <tr><th className="px-3 py-2 text-left font-medium">Rubrica</th><th className="px-3 py-2 text-right font-medium">Valor (R$)</th></tr>
                </thead>
                <tbody>
                  {grade.rubricas.map(r => r.nivel === 'grupo' ? (
                    <tr key={r.rubrica_id} className="border-t border-border-subtle bg-primary/5 font-semibold">
                      <td className="px-3 py-1.5"><span className="mr-2 font-mono text-xs text-text-faint">{r.codigo}</span>{r.nome}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmtBRL((calc.porGrupo[r.codigo] ?? 0) / 100)}</td>
                    </tr>
                  ) : (
                    <tr key={r.rubrica_id} className="border-t border-border-subtle">
                      <td className="px-3 py-1 pl-6 text-text-secondary"><span className="mr-2 font-mono text-xs text-text-faint">{r.codigo}</span>{r.nome}</td>
                      <td className="px-3 py-1 text-right">
                        <CampoValor label={r.nome} disabled={bloqueado} value={valores[r.rubrica_id] ?? ''}
                          onChange={v => setValores(s => ({ ...s, [r.rubrica_id]: v }))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <div className="flex flex-col gap-4">
              <section className="rounded-xl border border-border-subtle bg-surface p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold">Conferência do mês</h3>
                <table className="w-full text-sm"><tbody>
                  <tr><td className="py-1 text-text-secondary">Saldo anterior</td><td className="text-right font-mono">{fmtBRL(grade.saldoAnterior)}</td></tr>
                  <tr><td className="py-1 text-text-secondary">+ Receitas</td><td className="text-right font-mono">{fmtBRL(calc.receitas)}</td></tr>
                  <tr><td className="py-1 text-text-secondary">− Despesas</td><td className="text-right font-mono">{fmtBRL(calc.despesas)}</td></tr>
                  <tr><td className="py-1 text-text-secondary">± Movimentações</td><td className="text-right font-mono">{fmtBRL(calc.mov)}</td></tr>
                  <tr className="border-t border-border-subtle font-semibold"><td className="py-1">Saldo calculado</td><td className="text-right font-mono">{fmtBRL(calc.esperado)}</td></tr>
                  <tr><td className="py-1 text-text-secondary">Saldo informado</td>
                    <td className="py-1 text-right"><CampoValor label="Saldo informado" disabled={bloqueado} value={saldo} onChange={setSaldo} /></td></tr>
                </tbody></table>
                {calc.dif != null && Math.abs(calc.dif) > 0.1 && (
                  <p className="mt-2 text-xs text-status-warn">Saldo não reconcilia: diferença de {fmtBRL(calc.dif)}. Pode gravar assim mesmo.</p>
                )}
                {grade.saldoAnterior == null && <p className="mt-2 text-xs text-text-muted">Sem saldo do mês anterior: a reconciliação não é verificada.</p>}
              </section>

              <section className="rounded-xl border border-border-subtle bg-surface p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Movimentações</h3>
                  {!bloqueado && (
                    <button type="button" className="inline-flex items-center gap-1 text-sm text-primary"
                      onClick={() => setMovs(m => [...m, { tipo: 'transferencia', contraparte_unidade_id: grade.unidade_id, contraparte_conta: 'provisao', descricao: '', valor: 0, valorTxt: '' }])}>
                      <Plus size={14} />Adicionar
                    </button>
                  )}
                </div>
                <p className="mb-2 text-xs text-text-muted">Valor positivo entra na conta, negativo sai. Transferência precisa do lançamento espelho na outra conta.</p>
                <div className="flex flex-col gap-3">
                  {movs.map((m, i) => {
                    const set = (p: Partial<typeof m>) => setMovs(l => l.map((x, j) => (j === i ? { ...x, ...p } : x)))
                    return (
                      <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-border-subtle p-2">
                        <div className="flex gap-2">
                          <select aria-label="Tipo" disabled={bloqueado} className={`${classeSel} flex-1`} value={m.tipo} onChange={e => set({ tipo: e.target.value as Movimento['tipo'] })}>
                            {TIPOS_MOV.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
                          </select>
                          <CampoValor label="Valor" disabled={bloqueado} value={m.valorTxt} onChange={v => set({ valorTxt: v })} />
                          {!bloqueado && <button type="button" aria-label="Remover" onClick={() => setMovs(l => l.filter((_, j) => j !== i))} className="text-text-faint hover:text-status-bad"><Trash2 size={14} /></button>}
                        </div>
                        {m.tipo === 'transferencia' && (
                          <div className="flex gap-2">
                            <select aria-label="Unidade contraparte" disabled={bloqueado} className={`${classeSel} flex-1`} value={m.contraparte_unidade_id ?? ''} onChange={e => set({ contraparte_unidade_id: e.target.value })}>
                              {outrasContas.map(o => <option key={o.unidade_id} value={o.unidade_id}>{o.sigla}</option>)}
                            </select>
                            <select aria-label="Conta contraparte" disabled={bloqueado} className={classeSel} value={m.contraparte_conta ?? ''} onChange={e => set({ contraparte_conta: e.target.value as Conta })}>
                              {CONTAS.map(c => <option key={c.v} value={c.v}>{c.label}</option>)}
                            </select>
                          </div>
                        )}
                        <input aria-label="Descrição" disabled={bloqueado} className={classeSel} placeholder="Descrição" value={m.descricao} onChange={e => set({ descricao: e.target.value })} />
                      </div>
                    )
                  })}
                  {!movs.length && <span className="text-sm text-text-muted">Nenhuma.</span>}
                </div>
              </section>

              {!bloqueado && (
                <button type="button" onClick={salvar} disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  <Save size={16} />Gravar mês
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
