export function formatDate(date: string | number | Date): string {
  return new Date(date).toLocaleDateString('zh-TW')
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
  }).format(amount)
}
