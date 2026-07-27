/** Decimal precision heuristic: more decimals for sub-$1 assets (e.g. DOGE) than for BTC/SPY-scale prices. */
export function decimalsForPrice(price: number): number {
  const abs = Math.abs(price);
  if (abs >= 1) return 2;
  if (abs >= 0.01) return 4;
  return 6;
}

/** Locale-fixed grouped number string (no currency symbol), e.g. "5,349.89". */
export function formatNumber(amount: number, decimals = decimalsForPrice(amount)): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/** Locale-fixed USD string, e.g. "$5,349.89". */
export function formatCurrency(amount: number, decimals = decimalsForPrice(amount)): string {
  return `$${formatNumber(amount, decimals)}`;
}
