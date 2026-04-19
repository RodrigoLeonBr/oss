import { useState } from 'react'
import { FileDown, FileSpreadsheet, Printer } from 'lucide-react'
import StatusBadge from '../components/ui/StatusBadge'
import AlertaDesconto from '../components/ui/AlertaDesconto'
import {
  mockContratos,
  mockUnidades,
  mockAcompanhamentos,
  mockRepasse,
  mockIndicadores,
} from '../data/mock'
import { formatCurrency, formatNumber, formatPercent, formatMesReferencia } from '../lib/formatters'

export default function RelatoriosCMSPage() {
  const [mesRef] = useState('2026-03')
  const contrato = mockContratos[0]

  const cumpridos = mockAcompanhamentos.filter(a => a.status_cumprimento === 'cumprido').length
  const parciais = mockAcompanhamentos.filter(a => a.status_cumprimento === 'parcial').length
  const naoCumpridos = mockAcompanhamentos.filter(a => a.status_cumprimento === 'nao_cumprido').length
  const total = mockAcompanhamentos.length

  const allDescontos = [
    ...(mockRepasse.descontos_bloco ?? []),
    ...(mockRepasse.descontos_indicador ?? []),
  ]

  const handleExportPDF = () => {
    window.print()
  }

  const handleExportExcel = () => {
    const headers = ['Código', 'Indicador', 'Grupo', 'Unidade', 'Meta', 'Realizado', '%', 'Status']
    const rows = mockAcompanhamentos.map(a => {
      const ind = mockIndicadores.find(i => i.indicador_id === a.indicador_id)
      const uni = ind ? mockUnidades.find(u => u.unidade_id === ind.unidade_id) : undefined
      return [
        ind?.codigo,
        ind?.nome,
        ind?.grupo,
        uni?.nome,
        a.meta_vigente_mensal ?? '',
        a.valor_realizado ?? '',
        `${(a.percentual_cumprimento ?? 0).toFixed(1)}%`,
        a.status_cumprimento,
      ].join('\t')
    })
    const tsv = [headers.join('\t'), ...rows].join('\n')
    const blob = new Blob([tsv], { type: 'text/tab-separated-values' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-cms-${mesRef}.tsv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Relatórios CMS — {formatMesReferencia(mesRef)}
          </h2>
          <p className="text-sm text-slate-500">
            Pauta para o Conselho Municipal de Saúde
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-2 rounded-lg border border-border-light px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-border-dark dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <FileDown size={16} />
            Exportar PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 rounded-lg border border-border-light px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-border-dark dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <FileSpreadsheet size={16} />
            Exportar Excel
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-border-light px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-border-dark dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Printer size={16} />
            Imprimir
          </button>
        </div>
      </div>

      <div className="space-y-6 rounded-xl border border-border-light bg-surface-light p-6 print:border-0 print:p-0 print:shadow-none dark:border-border-dark dark:bg-surface-dark">
        <div className="border-b border-border-light pb-4 text-center dark:border-border-dark">
          <h3 className="text-lg font-bold text-primary">
            PAUTA — CONSELHO MUNICIPAL DE SAÚDE
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Acompanhamento do Contrato de Gestão — {formatMesReferencia(mesRef)}
          </p>
          <p className="text-xs text-slate-500">
            Secretaria Municipal de Saúde — Americana/SP
          </p>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
            1. Resumo Executivo
          </h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
              <p className="text-xs text-slate-500">Contrato</p>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-200">{contrato.numero}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
              <p className="text-xs text-slate-500">Valor Mensal Base</p>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-200">{formatCurrency(contrato.valor_mensal_base)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
              <p className="text-xs text-slate-500">Total Descontos</p>
              <p className="text-sm font-bold text-nao-cumprido">-{formatCurrency(mockRepasse.desconto_total)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
              <p className="text-xs text-slate-500">Repasse Final</p>
              <p className="text-sm font-bold text-cumprido">{formatCurrency(mockRepasse.repasse_final)}</p>
            </div>
          </div>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
            2. Conformidade dos Indicadores
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-cumprido/30 bg-cumprido/5 p-3 text-center">
              <p className="text-2xl font-bold text-cumprido">{cumpridos}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Cumpridos ({formatPercent((cumpridos / total) * 100)})</p>
            </div>
            <div className="rounded-lg border border-parcial/30 bg-parcial/5 p-3 text-center">
              <p className="text-2xl font-bold text-parcial">{parciais}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Parciais ({formatPercent((parciais / total) * 100)})</p>
            </div>
            <div className="rounded-lg border border-nao-cumprido/30 bg-nao-cumprido/5 p-3 text-center">
              <p className="text-2xl font-bold text-nao-cumprido">{naoCumpridos}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Não Cumpridos ({formatPercent((naoCumpridos / total) * 100)})</p>
            </div>
          </div>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
            3. Detalhamento por Unidade
          </h4>
          {mockUnidades.map(unidade => {
            const indUnidade = mockIndicadores.filter(i => i.unidade_id === unidade.unidade_id)
            const acomps = mockAcompanhamentos.filter(a => indUnidade.some(i => i.indicador_id === a.indicador_id))
            if (acomps.length === 0) return null
            return (
              <div key={unidade.unidade_id} className="mb-4">
                <h5 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {unidade.nome} — {unidade.tipo}
                </h5>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border-light dark:border-border-dark">
                        <th className="px-2 py-2 font-medium text-slate-600 dark:text-slate-400">Código</th>
                        <th className="px-2 py-2 font-medium text-slate-600 dark:text-slate-400">Indicador</th>
                        <th className="px-2 py-2 text-right font-medium text-slate-600 dark:text-slate-400">Meta</th>
                        <th className="px-2 py-2 text-right font-medium text-slate-600 dark:text-slate-400">Realizado</th>
                        <th className="px-2 py-2 text-right font-medium text-slate-600 dark:text-slate-400">%</th>
                        <th className="px-2 py-2 font-medium text-slate-600 dark:text-slate-400">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light dark:divide-border-dark">
                      {acomps.map(a => {
                        const ind = mockIndicadores.find(i => i.indicador_id === a.indicador_id)
                        return (
                          <tr key={a.acomp_id}>
                            <td className="px-2 py-1.5 font-mono text-slate-500">{ind?.codigo}</td>
                            <td className="px-2 py-1.5 text-slate-900 dark:text-slate-200">{ind?.nome}</td>
                            <td className="px-2 py-1.5 text-right font-mono text-slate-600 dark:text-slate-400">{formatNumber(a.meta_vigente_mensal ?? 0)}</td>
                            <td className="px-2 py-1.5 text-right font-mono text-slate-900 dark:text-slate-200">{formatNumber(a.valor_realizado ?? 0)}</td>
                            <td className="px-2 py-1.5 text-right font-mono font-bold">{formatPercent(a.percentual_cumprimento ?? 0)}</td>
                            <td className="px-2 py-1.5"><StatusBadge status={a.status_cumprimento} /></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
            4. Descontos Aplicados
          </h4>
          {allDescontos.length > 0 ? (
            <div className="space-y-2">
              {allDescontos.map(d => (
                <AlertaDesconto key={'desc_bloco_id' in d ? d.desc_bloco_id : d.desc_ind_id} desconto={d} />
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-slate-400">Nenhum desconto aplicado</p>
          )}
          <div className="mt-3 flex justify-between border-t border-border-light pt-3 dark:border-border-dark">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total</span>
            <span className="text-sm font-bold text-nao-cumprido">
              -{formatCurrency(mockRepasse.desconto_total)} ({mockRepasse.percentual_retido.toFixed(1)}%)
            </span>
          </div>
        </div>

        <div className="border-t border-border-light pt-4 text-center text-xs text-slate-500 dark:border-border-dark">
          <p>Documento gerado automaticamente pelo Sistema OSS Saúde Americana</p>
          <p>Sujeito à aprovação da Auditora e deliberação do CMS</p>
          <p className="mt-1">
            Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
          </p>
        </div>
      </div>
    </div>
  )
}
