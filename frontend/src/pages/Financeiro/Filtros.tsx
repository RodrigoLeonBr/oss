import { useMemo } from 'react'
import { CONTAS, TIPOS_PERIODO, type Escopo, type OpcaoEscopo, type Periodo } from './types'

const sel = 'rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 text-sm text-text-primary'
const lbl = 'flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-text-muted'

/** Cascata Global → OSS → contrato → unidade → conta. Trocar um nível limpa os de baixo. */
export function EscopoFiltro({ opcoes, value, onChange, comConta = true, exigirUnidade = false }: {
  opcoes: OpcaoEscopo[]; value: Escopo; onChange: (e: Escopo) => void; comConta?: boolean; exigirUnidade?: boolean
}) {
  const oss = useMemo(() => [...new Map(opcoes.map(o => [o.oss_id, o.oss_nome])).entries()], [opcoes])
  const contratos = useMemo(() => [...new Map(opcoes
    .filter(o => !value.ossId || o.oss_id === value.ossId)
    .map(o => [o.contrato_id, o.numero])).entries()], [opcoes, value.ossId])
  const unidades = opcoes.filter(o =>
    (!value.ossId || o.oss_id === value.ossId) && (!value.contratoId || o.contrato_id === value.contratoId))

  return (
    <>
      {!exigirUnidade && (
        <label className={lbl}>OSS
          <select className={sel} value={value.ossId}
            onChange={e => onChange({ ossId: e.target.value, contratoId: '', unidadeId: '', conta: '' })}>
            <option value="">Todas (global)</option>
            {oss.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </select>
        </label>
      )}
      {!exigirUnidade && (
        <label className={lbl}>Contrato
          <select className={sel} value={value.contratoId}
            onChange={e => onChange({ ...value, contratoId: e.target.value, unidadeId: '', conta: '' })}>
            <option value="">Todos</option>
            {contratos.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
        </label>
      )}
      <label className={lbl}>Unidade
        <select className={sel} value={value.unidadeId}
          onChange={e => onChange({ ...value, unidadeId: e.target.value, conta: exigirUnidade ? value.conta : '' })}>
          {!exigirUnidade && <option value="">Todas</option>}
          {exigirUnidade && <option value="">Selecione…</option>}
          {unidades.map(u => <option key={u.unidade_id} value={u.unidade_id}>{u.sigla} · {u.numero}</option>)}
        </select>
      </label>
      {comConta && (
        <label className={lbl}>Conta
          <select className={sel} value={value.conta} disabled={!exigirUnidade && !value.unidadeId}
            onChange={e => onChange({ ...value, conta: e.target.value as Escopo['conta'] })}>
            {!exigirUnidade && <option value="">Todas</option>}
            {CONTAS.map(c => <option key={c.v} value={c.v}>{c.label}</option>)}
          </select>
        </label>
      )}
    </>
  )
}

export function PeriodoFiltro({ value, onChange, semLivre = false }: {
  value: Periodo; onChange: (p: Periodo) => void; semLivre?: boolean
}) {
  const tipo = TIPOS_PERIODO.find(t => t.v === value.tipo)!
  const anoAtual = new Date().getFullYear()
  const anos = Array.from({ length: anoAtual - 2021 }, (_, i) => anoAtual - i)
  return (
    <>
      <label className={lbl}>Período
        <select className={sel} value={value.tipo}
          onChange={e => onChange({ ...value, tipo: e.target.value as Periodo['tipo'], n: 1 })}>
          {TIPOS_PERIODO.filter(t => !semLivre || t.v !== 'livre').map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
        </select>
      </label>
      {value.tipo === 'livre' ? (
        <>
          <label className={lbl}>De
            <input type="month" className={sel} value={value.ini} onChange={e => onChange({ ...value, ini: e.target.value })} />
          </label>
          <label className={lbl}>Até
            <input type="month" className={sel} value={value.fim} onChange={e => onChange({ ...value, fim: e.target.value })} />
          </label>
        </>
      ) : (
        <>
          {tipo.qtd > 1 && (
            <label className={lbl}>Nº
              <select className={sel} value={value.n} onChange={e => onChange({ ...value, n: Number(e.target.value) })}>
                {Array.from({ length: tipo.qtd }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}º</option>)}
              </select>
            </label>
          )}
          <label className={lbl}>Ano
            <select className={sel} value={value.ano} onChange={e => onChange({ ...value, ano: Number(e.target.value) })}>
              {anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
        </>
      )}
    </>
  )
}

export const Barra = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border-subtle bg-surface px-4 py-3">{children}</div>
)

export const Erro = ({ msg }: { msg: string | null }) => msg
  ? <div className="rounded-xl border border-status-bad-border bg-status-bad-bg px-4 py-3 text-sm text-status-bad">{msg}</div>
  : null

export const classeSel = sel
export const classeLbl = lbl
