export function formatDate(date) {
  return new Date(date).toLocaleDateString('zh-TW')
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
  }).format(amount)
}
