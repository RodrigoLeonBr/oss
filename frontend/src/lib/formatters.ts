const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const numberFormatter = new Intl.NumberFormat('pt-BR')

export function formatCurrency(value: number): string {
  return brlFormatter.format(value)
}

export function formatPercent(value: number): string {
  return percentFormatter.format(value / 100)
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('pt-BR')
}

export function formatMesReferencia(mesRef: string): string {
  const [ano, mes] = mesRef.split('-')
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ]
  return `${meses[parseInt(mes) - 1]}/${ano}`
}

export function statusColor(status: string): string {
  switch (status) {
    case 'cumprido': return 'text-cumprido'
    case 'parcial': return 'text-parcial'
    case 'nao_cumprido': return 'text-nao-cumprido'
    case 'aguardando': return 'text-na'
    default: return 'text-na'
  }
}

export function statusBgColor(status: string): string {
  switch (status) {
    case 'cumprido': return 'bg-cumprido/10 text-cumprido'
    case 'parcial': return 'bg-parcial/10 text-parcial'
    case 'nao_cumprido': return 'bg-nao-cumprido/10 text-nao-cumprido'
    case 'aguardando': return 'bg-na/10 text-na'
    default: return 'bg-na/10 text-na'
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'cumprido': return 'Cumprido'
    case 'parcial': return 'Parcial'
    case 'nao_cumprido': return 'Não Cumprido'
    case 'nao_aplicavel': return 'N/A'
    case 'aguardando': return 'Aguardando'
    default: return status
  }
}

export function aprovacaoLabel(status: string): string {
  switch (status) {
    case 'rascunho': return 'Rascunho'
    case 'submetido': return 'Submetido'
    case 'aprovado': return 'Aprovado'
    case 'rejeitado': return 'Rejeitado'
    default: return status
  }
}
