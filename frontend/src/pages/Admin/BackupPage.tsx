import { useState, useEffect, useCallback, useRef } from 'react'
import { DatabaseBackup, Download, Trash2, RefreshCw, Upload, AlertTriangle } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../contexts/AuthContext'
import { usePermission } from '../../hooks/usePermission'

interface Arquivo { nome: string; tamanhoBytes: number; criadoEm: string }
interface Listagem { banco: string; arquivos: Arquivo[] }

const fmtTamanho = (b: number) =>
  b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`

export default function BackupPage() {
  const { get, post, del, request } = useApi()
  const { token } = useAuth()
  const { canInsert, canUpdate, canDelete } = usePermission('backup')
  const [lista, setLista] = useState<Listagem | null>(null)
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [confirmacao, setConfirmacao] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setErro('')
    try {
      const res = await get<{ data: Listagem }>('/backup')
      setLista(res.data)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao listar backups.')
    }
  }, [get])

  useEffect(() => { void load() }, [load])

  const executar = async (rotulo: string, fn: () => Promise<void>) => {
    setOcupado(rotulo); setErro(''); setMsg('')
    try {
      await fn()
      await load()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha na operação.')
    } finally {
      setOcupado(null)
    }
  }

  const gerar = () => executar('Gerando backup…', async () => {
    const res = await post<{ message: string }>('/backup/gerar', {})
    setMsg(res.message)
  })

  const baixar = (nome: string) => executar(`Baixando ${nome}…`, async () => {
    const res = await fetch(`/api/backup/${encodeURIComponent(nome)}/download`, {
      headers: { Authorization: `Bearer ${token ?? ''}` },
    })
    if (!res.ok) throw new Error(`Erro HTTP ${res.status} ao baixar.`)
    const url = URL.createObjectURL(await res.blob())
    const a = document.createElement('a')
    a.href = url
    a.download = nome
    a.click()
    URL.revokeObjectURL(url)
  })

  const remover = (nome: string) => {
    if (!window.confirm(`Remover ${nome}? Não é possível desfazer.`)) return
    void executar(`Removendo ${nome}…`, async () => { await del(`/backup/${encodeURIComponent(nome)}`) })
  }

  const restaurar = () => {
    if (!arquivo || !lista) return
    if (confirmacao !== lista.banco) {
      setErro(`Digite exatamente "${lista.banco}" para confirmar.`)
      return
    }
    if (!window.confirm(`Substituir TODOS os dados de "${lista.banco}" pelo conteúdo de ${arquivo.name}? Um backup de segurança será criado antes.`)) return
    void executar('Restaurando banco… não feche a página.', async () => {
      const res = await request<{ message: string }>(
        `/backup/restaurar?confirmar=${encodeURIComponent(lista.banco)}`,
        { method: 'POST', body: arquivo, headers: { 'Content-Type': 'application/octet-stream' } },
      )
      setMsg(res.message)
      setArquivo(null)
      setConfirmacao('')
      if (inputRef.current) inputRef.current.value = ''
    })
  }

  const busy = ocupado !== null

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <header className="flex items-center gap-3">
        <DatabaseBackup size={22} />
        <div>
          <h1 className="text-xl font-semibold">Backup e restauração do banco</h1>
          <p className="text-sm opacity-70">Banco: <strong>{lista?.banco ?? '…'}</strong></p>
        </div>
      </header>

      {erro && <div className="rounded border border-red-300 bg-red-50 text-red-800 p-3 text-sm">{erro}</div>}
      {msg && <div className="rounded border border-green-300 bg-green-50 text-green-800 p-3 text-sm">{msg}</div>}
      {ocupado && <div className="text-sm opacity-80">{ocupado}</div>}

      <section className="space-y-3">
        <div className="flex gap-2">
          {canInsert && (
            <button onClick={() => void gerar()} disabled={busy} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm disabled:opacity-50">
              Gerar backup agora
            </button>
          )}
          <button onClick={() => void load()} disabled={busy} className="px-3 py-1.5 rounded border text-sm flex items-center gap-1">
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>

        <table className="w-full text-sm border">
          <thead className="bg-gray-100 text-left">
            <tr><th className="p-2">Arquivo</th><th className="p-2">Tamanho</th><th className="p-2">Criado em</th><th className="p-2 text-right">Ações</th></tr>
          </thead>
          <tbody>
            {(lista?.arquivos ?? []).length === 0 && (
              <tr><td colSpan={4} className="p-3 opacity-60">Nenhum backup ainda.</td></tr>
            )}
            {(lista?.arquivos ?? []).map((a) => (
              <tr key={a.nome} className="border-t">
                <td className="p-2 font-mono text-xs">{a.nome}</td>
                <td className="p-2">{fmtTamanho(a.tamanhoBytes)}</td>
                <td className="p-2">{new Date(a.criadoEm).toLocaleString('pt-BR')}</td>
                <td className="p-2 text-right space-x-2">
                  <button onClick={() => void baixar(a.nome)} disabled={busy} className="inline-flex items-center gap-1 text-blue-700">
                    <Download size={14} /> Baixar
                  </button>
                  {canDelete && (
                    <button onClick={() => remover(a.nome)} disabled={busy} className="inline-flex items-center gap-1 text-red-700">
                      <Trash2 size={14} /> Remover
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {canUpdate && (
        <section className="rounded border border-red-300 p-4 space-y-3">
          <h2 className="font-semibold flex items-center gap-2 text-red-800">
            <AlertTriangle size={16} /> Restaurar a partir de um arquivo
          </h2>
          <p className="text-sm">
            Substitui <strong>todos</strong> os dados do banco. Envie um arquivo gerado por este módulo (.sql ou .sql.gz).
            Antes de restaurar é criado um backup de segurança na lista acima.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".sql,.gz"
            disabled={busy}
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="confirmar-banco">Digite <code>{lista?.banco ?? ''}</code> para confirmar:</label>
            <input
              id="confirmar-banco"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              disabled={busy}
              className="border rounded px-2 py-1 font-mono"
            />
          </div>
          <button
            onClick={() => restaurar()}
            disabled={busy || !arquivo || confirmacao !== lista?.banco}
            className="px-3 py-1.5 rounded bg-red-700 text-white text-sm disabled:opacity-40 flex items-center gap-1"
          >
            <Upload size={14} /> Restaurar banco
          </button>
        </section>
      )}
    </div>
  )
}
