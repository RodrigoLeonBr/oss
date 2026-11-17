import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApi, ApiError } from '../../hooks/useApi'
import { usePermission } from '../../hooks/usePermission'
import { Erro } from './Filtros'
import { unwrap, type OpcaoEscopo } from './types'
import PainelTab from './PainelTab'
import LancamentoTab from './LancamentoTab'
import ImportarTab from './ImportarTab'
import ObservacoesTab from './ObservacoesTab'
import FechamentoTab from './FechamentoTab'

const ABAS = [
  { v: 'painel', label: 'Painel' },
  { v: 'lancamento', label: 'Lançamento', precisa: 'update' },
  { v: 'importar', label: 'Importar', precisa: 'insert' },
  { v: 'observacoes', label: 'Observações & pendências' },
  { v: 'fechamento', label: 'Fechamento' },
] as const

export default function FinanceiroPage() {
  const { get } = useApi()
  const perm = usePermission('financeiro')
  const [params, setParams] = useSearchParams()
  const [opcoes, setOpcoes] = useState<OpcaoEscopo[]>([])
  const [erro, setErro] = useState<string | null>(null)

  const abas = ABAS.filter(a => !('precisa' in a) || (a.precisa === 'update' ? perm.canUpdate : perm.canInsert))
  const aba = abas.find(a => a.v === params.get('aba'))?.v ?? 'painel'

  useEffect(() => {
    get('/financeiro/opcoes').then(r => setOpcoes(unwrap<OpcaoEscopo[]>(r)))
      .catch(e => setErro(e instanceof ApiError ? e.message : 'Erro ao carregar contratos.'))
  }, [get])

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Execução financeira</h1>
        <p className="text-sm text-text-muted">Repasses, despesas e saldos das contas das OSS: consulta, lançamento, importação e fechamento.</p>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-b border-border-subtle" role="tablist">
        {abas.map(a => (
          <button key={a.v} type="button" role="tab" aria-selected={aba === a.v} onClick={() => setParams({ aba: a.v })}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${aba === a.v ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
            {a.label}
          </button>
        ))}
      </nav>
      <Erro msg={erro} />
      {aba === 'painel' && <PainelTab opcoes={opcoes} />}
      {aba === 'lancamento' && <LancamentoTab opcoes={opcoes} />}
      {aba === 'importar' && <ImportarTab opcoes={opcoes} />}
      {aba === 'observacoes' && <ObservacoesTab opcoes={opcoes} />}
      {aba === 'fechamento' && <FechamentoTab opcoes={opcoes} />}
    </div>
  )
}
