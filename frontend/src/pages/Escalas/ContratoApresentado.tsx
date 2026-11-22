import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { useApi, ApiError } from '../../hooks/useApi'
import { usePermission } from '../../hooks/usePermission'
import type { ContratoApresentado as Dados, DiaCobertura, Dimensionamento, SetorResumo } from './types'
import { unwrap, CATEGORIAS, DIAS_SEMANA, diaDaSemana, fmtH } from './types'
import DimensionamentoFormModal from './DimensionamentoFormModal'

interface Props { unidadeId: string; mes: string; setores: SetorResumo[] }

function corDia(d: DiaCobertura) {
  if (!d.exigido) return 'bg-surface-alt/50 text-text-faint'
  if ((d.apresentado ?? 0) < d.exigido) return 'bg-status-bad-bg text-status-bad font-bold'
  if ((d.realizado ?? 0) < d.exigido) return 'bg-status-warn-bg text-status-warn'
  return 'bg-status-ok-bg text-status-ok'
}

const fmtP = (v: number | null) => (v == null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)
const dias = (s: string) => (s === '1234567' ? 'todos os dias' : s.split('').map(d => DIAS_SEMANA[Number(d) - 1]).join(' '))
const categoria = (c: string | null) => CATEGORIAS.find(x => x.v === (c ?? ''))?.label ?? c

export default function ContratoApresentado({ unidadeId, mes, setores }: Props) {
  const { get, del } = useApi()
  const perm = usePermission('escalas')
  const [dados, setDados] = useState<Dados | null>(null)
  const [cadastro, setCadastro] = useState<Dimensionamento[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [modal, setModal] = useState<{ registro?: Dimensionamento } | null>(null)
  const [confirmar, setConfirmar] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null)
    try {
      const [r, c] = await Promise.all([
        get(`/escalas/contrato-apresentado?unidade_id=${unidadeId}&mes=${mes}-01`),
        get(`/escalas/dimensionamento?unidade_id=${unidadeId}`),
      ])
      setDados(unwrap<Dados>(r as Dados))
      setCadastro(unwrap<Dimensionamento[]>(c as Dimensionamento[]))
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao carregar.')
    } finally { setLoading(false) }
  }, [get, unidadeId, mes])

  useEffect(() => { carregar() }, [carregar])

  const remover = async (id: string) => {
    try { await del(`/escalas/dimensionamento/${id}`); setConfirmar(null); carregar() } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao remover.')
    }
  }

  const res = dados?.resumo
  return (
    <div className="flex flex-col gap-4">
      {erro && <div className="flex items-center gap-2 rounded-xl border border-status-bad-border bg-status-bad-bg px-4 py-3 text-sm text-status-bad"><AlertCircle size={16} />{erro}</div>}
      {loading && <Loader2 size={18} className="animate-spin text-primary" />}

      {res && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['Cobertura apresentada', fmtP(res.coberturaPerc), res.coberturaPerc != null && res.coberturaPerc < 100],
            ['Postos-turno exigidos × apresentados', `${fmtH(res.postosDiaExigidos)} × ${fmtH(res.postosDiaApresentados)}`, false],
            ['Horas contratadas × apresentadas × realizadas', `${fmtH(res.horasContratadas)} × ${fmtH(res.horasApresentadas)} × ${fmtH(res.horasRealizadas)}`, false],
            ['Turnos com déficit', String(res.turnosComDeficit), res.turnosComDeficit > 0],
          ].map(([l, v, ruim]) => (
            <div key={String(l)} className="rounded-xl border border-border-subtle bg-surface px-4 py-3">
              <div className="text-xs text-text-muted">{l}</div>
              <div className={`font-mono text-lg font-semibold ${ruim ? 'text-status-bad' : 'text-text-primary'}`}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {dados && dados.linhas.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-sm">
          <table className="w-full border-collapse text-xs" style={{ minWidth: 300 + dados.dias.length * 36 + 120 }}>
            <thead className="bg-primary/5 text-text-secondary">
              <tr>
                <th className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-medium" style={{ minWidth: 260 }}>Setor · turno · postos</th>
                {dados.dias.map(d => (
                  <th key={d} className="w-9 px-0.5 py-1 text-center font-medium">
                    <div>{Number(d.slice(8))}</div>
                    <div className="text-[10px] text-text-faint">{DIAS_SEMANA[diaDaSemana(d)]}</div>
                  </th>
                ))}
                <th className="px-2 py-2 text-right font-medium">Cobertura</th>
              </tr>
            </thead>
            <tbody>
              {dados.linhas.map(l => (
                <tr key={l.dimensionamentoId} className="border-t border-border-subtle">
                  <td className="sticky left-0 z-10 bg-surface px-3 py-1.5">
                    <div className="font-medium text-text-primary">{l.setor}</div>
                    <div className="text-[10px] text-text-faint">{l.turnoInicio}–{l.turnoFim} · {l.qtdPostos} posto(s) · {categoria(l.categoria)}</div>
                  </td>
                  {l.dias.map(d => (
                    <td key={d.data} className={`px-0.5 py-1 text-center font-mono ${corDia(d)}`}
                      title={d.exigido ? `Exigido ${d.exigido} · apresentado ${d.apresentado} · realizado ${d.realizado}` : 'Fora da vigência/dia'}>
                      {d.exigido ? fmtH(d.apresentado ?? 0) : ''}
                    </td>
                  ))}
                  <td className={`px-2 py-1.5 text-right font-mono ${l.totais.turnosComDeficit ? 'font-bold text-status-bad' : 'text-status-ok'}`}>
                    {fmtP(l.totais.coberturaPerc)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2 text-[11px] text-text-faint">
            Célula = postos apresentados na escala (frações = cobertura parcial do turno). Vermelho: abaixo do contratado; laranja: apresentado, mas não realizado (riscado/falta/atestado).
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-border-subtle bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
          <span className="text-sm font-semibold text-text-primary">Postos contratados da unidade</span>
          {perm.canInsert && (
            <button type="button" onClick={() => setModal({})}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white">
              <Plus size={14} />Cadastrar postos
            </button>
          )}
        </div>
        {cadastro.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-text-muted">
            Nenhum posto cadastrado. Cadastre os postos exigidos pelo contrato/plano de trabalho para comparar com a escala apresentada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 760 }}>
              <thead className="text-text-secondary">
                <tr className="border-b border-border-subtle">
                  <th className="px-4 py-2 text-left font-medium">Setor</th>
                  <th className="px-4 py-2 text-left font-medium">Categoria</th>
                  <th className="px-4 py-2 text-left font-medium">Turno</th>
                  <th className="px-4 py-2 text-right font-medium">Postos</th>
                  <th className="px-4 py-2 text-left font-medium">Dias</th>
                  <th className="px-4 py-2 text-left font-medium">Vigência</th>
                  <th className="px-4 py-2 text-left font-medium">Fonte</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {cadastro.map(d => (
                  <tr key={d.dimensionamentoId} className="border-b border-border-subtle">
                    <td className="px-4 py-2">{d.setor}</td>
                    <td className="px-4 py-2">{categoria(d.categoria)}</td>
                    <td className="px-4 py-2 font-mono">{d.turnoInicio}–{d.turnoFim}</td>
                    <td className="px-4 py-2 text-right font-mono">{d.qtdPostos}</td>
                    <td className="px-4 py-2">{dias(d.diasSemana)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{d.vigenciaInicio.split('-').reverse().join('/')} – {d.vigenciaFim ? d.vigenciaFim.split('-').reverse().join('/') : '…'}</td>
                    <td className="px-4 py-2 text-xs text-text-muted">{d.fonte}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      {perm.canUpdate && (
                        <button type="button" onClick={() => setModal({ registro: d })} aria-label="Editar"
                          className="rounded p-1 text-text-faint hover:bg-hover hover:text-text-secondary"><Pencil size={15} /></button>
                      )}
                      {perm.canDelete && (confirmar === d.dimensionamentoId ? (
                        <button type="button" onClick={() => remover(d.dimensionamentoId)}
                          className="ml-1 rounded bg-status-bad px-2 py-0.5 text-xs font-medium text-white">Confirmar remoção</button>
                      ) : (
                        <button type="button" onClick={() => setConfirmar(d.dimensionamentoId)} aria-label="Remover"
                          className="ml-1 rounded p-1 text-text-faint hover:bg-hover hover:text-status-bad"><Trash2 size={15} /></button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <DimensionamentoFormModal unidadeId={unidadeId} setores={setores} registro={modal.registro}
          onFechar={() => setModal(null)} onSalvo={() => { setModal(null); carregar() }} />
      )}
    </div>
  )
}
