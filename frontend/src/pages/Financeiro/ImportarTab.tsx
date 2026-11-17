import { useMemo, useState } from 'react'
import { CheckCircle2, FileUp, Loader2 } from 'lucide-react'
import { useApi, ApiError } from '../../hooks/useApi'
import { usePermission } from '../../hooks/usePermission'
import { Barra, Erro, classeLbl, classeSel } from './Filtros'
import { CONTA_LABEL, fmtBRL, fmtMes, unwrap, type OpcaoEscopo, type ResumoCarga } from './types'

export default function ImportarTab({ opcoes }: { opcoes: OpcaoEscopo[] }) {
  const { request, post } = useApi()
  const { canInsert } = usePermission('financeiro')
  const contratos = useMemo(() => [...new Map(opcoes.map(o => [o.contrato_id, `${o.numero} · ${o.oss_nome}`])).entries()], [opcoes])
  const [contratoId, setContratoId] = useState('')
  const [arquivos, setArquivos] = useState<File[]>([])
  const [previa, setPrevia] = useState<ResumoCarga | null>(null)
  const [gravado, setGravado] = useState<ResumoCarga | null>(null)
  const [etapa, setEtapa] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const gerarPrevia = async () => {
    setErro(null); setPrevia(null); setGravado(null)
    try {
      let token: string | undefined
      for (const [i, f] of arquivos.entries()) {
        setEtapa(`Enviando ${i + 1}/${arquivos.length}: ${f.name}`)
        const q = new URLSearchParams({ contrato_id: contratoId, nome: f.name, ...(token ? { token } : {}) })
        const r = unwrap<{ token: string }>(await request(`/financeiro/importacao/arquivo?${q}`, {
          method: 'POST', body: f, headers: { 'Content-Type': 'application/octet-stream' },
        }))
        token = r.token
      }
      setEtapa('Extraindo e validando…')
      setPrevia(unwrap<ResumoCarga>(await post('/financeiro/importacao/previa', { token })))
    } catch (e) { setErro(e instanceof ApiError ? e.message : 'Erro na importação.') } finally { setEtapa(null) }
  }

  const confirmar = async () => {
    if (!previa?.token) return
    setErro(null); setEtapa('Gravando…')
    try {
      setGravado(unwrap<ResumoCarga>(await post('/financeiro/importacao/confirmar', { token: previa.token })))
      setPrevia(null); setArquivos([])
    } catch (e) { setErro(e instanceof ApiError ? e.message : 'Erro ao gravar.') } finally { setEtapa(null) }
  }

  if (!canInsert) return <div className="py-12 text-center text-sm text-text-muted">Seu perfil não importa dados financeiros.</div>

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">
        Demonstrativo financeiro consolidado da OSS (.xlsx ou .pdf de cada aba). Envie <strong>todas as contas do mesmo período juntas</strong>:
        as transferências entre contas são conferidas em par. Nada é gravado antes da confirmação.
      </p>
      <Barra>
        <label className={classeLbl}>Contrato
          <select className={classeSel} value={contratoId} onChange={e => { setContratoId(e.target.value); setPrevia(null) }}>
            <option value="">Selecione…</option>
            {contratos.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
        </label>
        <label className={classeLbl}>Arquivos
          <input type="file" multiple accept=".xlsx,.pdf" className="text-sm"
            onChange={e => { setArquivos([...(e.target.files ?? [])]); setPrevia(null) }} />
        </label>
        <button type="button" disabled={!contratoId || !arquivos.length || !!etapa} onClick={gerarPrevia}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          <FileUp size={16} />Gerar prévia
        </button>
        {etapa && <span className="mb-2 inline-flex items-center gap-2 text-sm text-text-muted"><Loader2 size={16} className="animate-spin" />{etapa}</span>}
      </Barra>
      <Erro msg={erro} />

      {gravado && (
        <div className="flex items-center gap-2 rounded-xl border border-status-ok-border bg-status-ok-bg px-4 py-3 text-sm text-status-ok">
          <CheckCircle2 size={16} />Gravado: {gravado.totais?.lancamentos} lançamentos, {gravado.totais?.movimentacoes} movimentações, {gravado.totais?.saldos} saldos.
        </div>
      )}

      {previa && (
        <div className="flex flex-col gap-4">
          <section className="overflow-x-auto rounded-xl border border-border-subtle bg-surface shadow-sm">
            <table className="w-full text-sm" style={{ minWidth: 640 }}>
              <thead className="bg-primary/5 text-text-secondary">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Unidade / conta</th>
                  <th className="px-3 py-2 text-left font-medium">Meses</th>
                  <th className="px-3 py-2 text-right font-medium">Saldo inicial</th>
                  <th className="px-3 py-2 text-right font-medium">Saldo final</th>
                  <th className="px-3 py-2 text-left font-medium">Avisos</th>
                </tr>
              </thead>
              <tbody>
                {previa.abas.map(a => (
                  <tr key={a.unidade + a.conta} className="border-t border-border-subtle align-top">
                    <td className="px-3 py-2 font-medium">{a.unidade} · {CONTA_LABEL[a.conta]}</td>
                    <td className="px-3 py-2">{fmtMes(a.meses[0])} – {fmtMes(a.meses[a.meses.length - 1])}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtBRL(a.saldoInicial)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtBRL(a.saldoFinal)}</td>
                    <td className="px-3 py-2 text-xs text-text-muted">{a.avisos.length ? a.avisos.join('; ') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="rounded-xl border border-border-subtle bg-surface p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold">
              {previa.diferencas.length ? `${previa.diferencas.length} diferenças contra o que já está no banco` : 'Idêntico ao que já está no banco (ou período novo sem dados).'}
            </h3>
            {previa.diferencas.length > 0 && (
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-text-secondary"><tr>
                    <th className="py-1 text-left font-medium">Mês</th><th className="text-left font-medium">Unidade/conta</th>
                    <th className="text-left font-medium">Campo</th><th className="text-right font-medium">Atual</th><th className="text-right font-medium">Novo</th>
                  </tr></thead>
                  <tbody>
                    {previa.diferencas.map((d, i) => (
                      <tr key={i} className="border-t border-border-subtle">
                        <td className="py-1">{fmtMes(d.mes)}</td><td>{d.unidade} · {CONTA_LABEL[d.conta]}</td><td>{d.campo}</td>
                        <td className="text-right font-mono">{fmtBRL(d.atual)}</td><td className="text-right font-mono">{fmtBRL(d.novo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="flex items-center gap-3">
            <button type="button" onClick={confirmar} disabled={!!etapa}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <CheckCircle2 size={16} />Confirmar e gravar
            </button>
            <span className="text-xs text-text-muted">Substitui os meses das contas do lote. Meses fechados são recusados.</span>
          </div>
        </div>
      )}
    </div>
  )
}
