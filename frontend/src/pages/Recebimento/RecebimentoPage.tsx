import { useState, useEffect, useCallback } from 'react'
import { Loader2, AlertCircle, MessageSquareText, Info } from 'lucide-react'
import { useApi, ApiError } from '../../hooks/useApi'
import JustificativaModal from './JustificativaModal'
import type { Recebimento, Resultado, Linha, Grupo, Modelo } from './types'
import { fmtPct, fmtFator, fmtBRL, fmtNum } from './types'

const unwrap = <T,>(r: T | { data: T }): T =>
  (r && typeof r === 'object' && 'data' in (r as object) ? (r as { data: T }).data : (r as T))

const mesAnterior = () => {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const fmtData = (s: string | null) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '…')

const NIVEL: Record<string, string> = { '1': 'Conforme', '0.5': 'Parcial', '0': 'Não conforme' }
const nivelDe = (f: number | null) => (f == null ? '—' : NIVEL[String(f)] ?? fmtFator(f))

function BotaoNota({ linha, onClick }: { linha: Linha; onClick: () => void }) {
  const st = linha.nota?.status_validacao
  const cor = st === 'aceita' ? 'text-status-ok' : st === 'rejeitada' ? 'text-status-bad' : st === 'pendente' ? 'text-status-warn' : 'text-text-faint'
  return (
    <button type="button" onClick={onClick} title={st ? `Justificativa ${st}` : 'Justificar'}
      className={`inline-flex items-center gap-1 text-xs ${cor} hover:underline`}>
      <MessageSquareText size={14} />{st ?? 'justificar'}
    </button>
  )
}

function Par({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) {
  return (
    <>
      <span className={forte ? 'font-semibold text-text-primary' : 'text-text-muted'}>{rotulo}</span>
      <span className={`text-right font-mono ${forte ? 'font-bold text-text-primary' : ''}`}>{valor}</span>
    </>
  )
}

function CardResultado({ titulo, r, modelo, destaque }: { titulo: string; r: Resultado; modelo: Modelo; destaque?: boolean }) {
  return (
    <div className={`flex flex-1 flex-col gap-2 rounded-2xl border p-4 ${destaque ? 'border-primary bg-primary/5' : 'border-border-subtle bg-surface'}`}>
      <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{titulo}</span>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {modelo === 'producao_qualidade' ? (
          <>
            <Par rotulo="Nota qualitativa" valor={fmtNum(r.nota_qualitativa)} />
            <Par rotulo="Escala do repasse" valor={fmtPct(r.perc_escala, 0)} />
            <Par rotulo="Valor pela escala" valor={fmtBRL(r.valor_escala)} />
            <Par rotulo="Desconto produção" valor={r.desconto_producao ? `− ${fmtBRL(r.desconto_producao)}` : fmtBRL(0)} />
          </>
        ) : (
          <>
            <Par rotulo="Fixa recebida" valor={fmtPct(r.perc_fixa, 2)} />
            <Par rotulo="Nota qualitativa" valor={fmtNum(r.nota_qualitativa)} />
            <Par rotulo="Variável paga" valor={fmtPct(r.perc_variavel, 0)} />
            <Par rotulo="Valor fixa" valor={fmtBRL(r.valor_fixa)} />
            <Par rotulo="Valor variável" valor={fmtBRL(r.valor_variavel)} />
          </>
        )}
        <Par rotulo="Repasse" valor={fmtBRL(r.valor_total)} forte />
      </div>
    </div>
  )
}

const th = 'px-3 py-2 text-left text-xs font-semibold'
const td = 'px-3 py-2'

function Tabela({ minWidth, cabecalho, children }: { minWidth: number; cabecalho: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-sm">
      <div style={{ minWidth }}>
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-text-secondary">
            <tr>{cabecalho.map(h => <th key={h} className={th}>{h}</th>)}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  )
}

const alcanceLinha = (l: Linha) => (l.realizado != null && l.base ? fmtPct((l.realizado / l.base) * 100) : '—')

/** producao_qualidade: linhas de serviço com faixa de desconto */
function TabelaProducao({ grupos, comDesconto, onNota }: { grupos: Grupo[]; comDesconto: boolean; onNota?: (l: Linha) => void }) {
  const cab = ['Linha / indicador', 'Peso', 'Meta', 'Realizado', 'Alcance', 'Faixa', comDesconto ? 'Desconto' : 'Desconto (se aplicado)', 'Após comissão']
  if (onNota) cab.push('Justificativa')
  return (
    <Tabela minWidth={900} cabecalho={cab}>
      {grupos.map(g => [
        <tr key={g.codigo} className="border-t border-border-subtle bg-primary/[0.02] font-semibold">
          <td className={td}>{g.nome}</td><td className={td}>{fmtNum(g.peso)}</td><td className={td} colSpan={2} />
          <td className={td}>{fmtPct(g.alcance_apurado)}</td>
          <td className={td}>{g.desc_perc_apurado == null ? '—' : g.desc_perc_apurado ? `−${g.desc_perc_apurado}%` : 'sem desconto'}</td>
          <td className={td}>{g.desc_perc_apurado ? fmtBRL(((g.base_linha ?? 0) * g.desc_perc_apurado) / 100) : '—'}</td>
          <td className={td}>{g.desc_perc_comissao ? fmtBRL(((g.base_linha ?? 0) * g.desc_perc_comissao) / 100) : g.desc_perc_comissao === 0 ? 'sem desconto' : '—'}</td>
          {onNota && <td className={td} />}
        </tr>,
        ...g.linhas.map(l => (
          <tr key={l.indicador_id} className="border-t border-border-subtle text-text-secondary">
            <td className={`${td} pl-6`}>{l.nome}</td><td className={td} />
            <td className={td}>{fmtNum(l.base)}</td><td className={td}>{fmtNum(l.realizado)}</td>
            <td className={td}>{alcanceLinha(l)}</td><td className={td} colSpan={3} />
            {onNota && <td className={td}><BotaoNota linha={l} onClick={() => onNota(l)} /></td>}
          </tr>
        )),
      ])}
    </Tabela>
  )
}

/** fixa_variavel: grupos com fator proporcional */
function TabelaFixa({ grupos, onNota }: { grupos: Grupo[]; onNota: (l: Linha) => void }) {
  return (
    <Tabela minWidth={820} cabecalho={['Grupo / indicador', 'Peso', 'Meta', 'Realizado', 'Alcance', 'Fator apurado', 'Após comissão', 'Justificativa']}>
      {grupos.map(g => [
        <tr key={g.codigo} className="border-t border-border-subtle bg-primary/[0.02] font-semibold">
          <td className={td}>{g.nome}</td><td className={td}>{fmtNum(g.peso)}</td>
          <td className={td} colSpan={3} /><td className={td}>{fmtFator(g.fator_apurado)}</td>
          <td className={td}>{fmtFator(g.fator_comissao)}</td><td className={td} />
        </tr>,
        ...g.linhas.map(l => (
          <tr key={l.indicador_id} className="border-t border-border-subtle text-text-secondary">
            <td className={`${td} pl-6`}>{l.nome}</td><td className={td} />
            <td className={td}>{fmtNum(l.base)}</td><td className={td}>{fmtNum(l.realizado)}</td>
            <td className={td}>{alcanceLinha(l)}</td><td className={td} colSpan={2} />
            <td className={td}><BotaoNota linha={l} onClick={() => onNota(l)} /></td>
          </tr>
        )),
      ])}
    </Tabela>
  )
}

export default function RecebimentoPage() {
  const { get } = useApi()
  const [contratos, setContratos] = useState<{ id: string; label: string }[]>([])
  const [contratoId, setContratoId] = useState('')
  const [mes, setMes] = useState(mesAnterior())
  const [data, setData] = useState<Recebimento | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [linhaNota, setLinhaNota] = useState<Linha | null>(null)

  useEffect(() => {
    type C = { id: string; numeroContrato?: string; numero?: string }
    get<C[] | { data: C[] }>('/contratos')
      .then(r => {
        const lista = (unwrap<C[]>(r) ?? [])
          .map(c => ({ id: c.id, label: c.numeroContrato ?? c.numero ?? c.id }))
        setContratos(lista)
        setContratoId(id => id || lista[0]?.id || '')
      })
      .catch(() => setContratos([]))
  }, [get])

  const carregar = useCallback(async () => {
    if (!contratoId || !mes) return
    setLoading(true); setErro(null)
    try {
      setData(unwrap(await get<{ data: Recebimento }>(`/descontos/recebimento/${contratoId}?mes=${mes}`)))
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao calcular recebimento.')
      setData(null)
    } finally { setLoading(false) }
  }, [get, contratoId, mes])

  useEffect(() => { carregar() }, [carregar])

  const producao = data?.modelo === 'producao_qualidade'
  const trimestral = producao && data?.previa != null

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Percentual de Recebimento</h1>
        <p className="text-sm text-text-muted">
          Cálculo pela regra da vigência do contrato. O resultado apurado não muda; a coluna “após
          comissão” considera as justificativas acatadas.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border-subtle bg-surface p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-muted">Contrato</span>
          <select value={contratoId} onChange={e => setContratoId(e.target.value)}
            className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm">
            {contratos.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-muted">Mês</span>
          <input type="month" value={mes} onChange={e => setMes(e.target.value)}
            className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm" />
        </label>
        {loading && <Loader2 size={18} className="mb-2 animate-spin text-primary" />}
      </div>

      {erro && (
        <div className="flex items-center gap-2 rounded-xl border border-status-bad-border bg-status-bad-bg px-4 py-3 text-sm text-status-bad">
          <AlertCircle size={16} />{erro}
        </div>
      )}

      {data && (
        <>
          <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted">
            <span>Contrato {data.numero}</span>
            {data.vigencia && <span>Vigência {data.vigencia.versao}: {fmtData(data.vigencia.inicio)} – {fmtData(data.vigencia.fim)}</span>}
            {producao
              ? <span>Repasse {fmtBRL(data.valor_mensal_base)} · base produção {fmtBRL(data.parcela_fixa)}</span>
              : <span>Base {fmtBRL(data.valor_mensal_base)} · fixa {fmtBRL(data.parcela_fixa)} · variável {fmtBRL(data.parcela_variavel)}</span>}
            {data.pendentes > 0 && <span className="font-semibold text-status-warn">{data.pendentes} sem lançamento (contam 0)</span>}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <CardResultado titulo="Apurado" r={data.apurado} modelo={data.modelo} />
            <CardResultado titulo="Após comissão" r={data.aposComissao} modelo={data.modelo} destaque />
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">
              {producao ? 'Quantitativo — linhas de serviço' : 'Quantitativo — parcela fixa'}
            </h2>
            {!producao && <TabelaFixa grupos={data.grupos} onNota={setLinhaNota} />}
            {producao && !trimestral && <TabelaProducao grupos={data.grupos} comDesconto onNota={setLinhaNota} />}
            {trimestral && (
              <>
                <div className="flex items-start gap-2 rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm text-text-secondary">
                  <Info size={16} className="mt-0.5 shrink-0 text-primary" />
                  {data.oficial
                    ? <span>Apuração trimestral: o desconto do <b>{data.oficial.trimestre}</b> ({data.oficial.meses.join(', ')}) é aplicado neste mês.</span>
                    : <span>Apuração trimestral: nenhum desconto de produção neste mês. A prévia abaixo mostra a faixa do mês; o desconto entra no mês seguinte ao fechamento do trimestre (jan, abr, jul, out).</span>}
                </div>
                {data.oficial && <TabelaProducao grupos={data.grupos} comDesconto />}
                <h3 className="mt-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Prévia do mês</h3>
                <TabelaProducao grupos={data.previa ?? []} comDesconto={false} onNota={setLinhaNota} />
              </>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">
              {producao ? 'Qualitativo — nota da escala' : 'Qualitativo — parcela variável'}
            </h2>
            <Tabela minWidth={860} cabecalho={['Indicador', 'Peso', 'Meta', 'Realizado', data.pontuacao === 'niveis' ? 'Nível' : 'Pontos apurados', 'Após comissão', 'Justificativa']}>
              {data.qual.map(l => (
                <tr key={l.indicador_id} className={`border-t border-border-subtle ${l.informativo ? 'text-text-muted' : ''}`}>
                  <td className={td}>{l.nome}{l.informativo && <span className="ml-2 rounded bg-primary/5 px-1.5 py-0.5 text-[10px] uppercase">informativo</span>}</td>
                  <td className={td}>{l.informativo ? '—' : fmtNum(l.peso)}</td>
                  <td className={td}>{(l.meta.meta_tipo ?? l.meta.meta_tipo_snap) === 'menor_igual' ? '≤ ' : '≥ '}{fmtNum(l.base)}</td>
                  <td className={td}>{fmtNum(l.realizado)}</td>
                  <td className={td}>
                    {data.pontuacao === 'niveis'
                      ? `${nivelDe(l.fator_apurado)}${!l.informativo && l.fator_apurado != null ? ` · ${fmtNum(l.peso * l.fator_apurado)}` : ''}`
                      : l.fator_apurado == null ? '—' : fmtNum(l.peso * l.fator_apurado)}
                  </td>
                  <td className={td}>{l.informativo || l.fator_comissao == null ? '—' : fmtNum(l.peso * l.fator_comissao)}</td>
                  <td className={td}><BotaoNota linha={l} onClick={() => setLinhaNota(l)} /></td>
                </tr>
              ))}
            </Tabela>
          </section>
        </>
      )}

      {linhaNota && (
        <JustificativaModal linha={linhaNota} onClose={() => setLinhaNota(null)}
          onSaved={() => { setLinhaNota(null); carregar() }} />
      )}
    </div>
  )
}
