export function predictNextPrice(closes: number[]): number {
  const n = closes.length;
  if (n === 0) return 0;
  if (n === 1) return closes[0];

  const xMean = (n - 1) / 2;
  const yMean = closes.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - xMean;
    const dy = closes[i] - yMean;
    numerator += dx * dy;
    denominator += dx * dx;
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;

  return slope * n + intercept;
}
