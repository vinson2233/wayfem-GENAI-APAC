export function formatCurrency(amount: number, currency: string): string {
  // Try Intl with the ISO code; fall back to a simple "{code} {amount}" format.
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}
