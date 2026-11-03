export function formatDualPrice(usd: string | number, exchangeRate: string | number | null | undefined) {
  const usdValue = Number(usd);
  const rate = Number(exchangeRate);
  if (!Number.isFinite(rate) || rate <= 0) return `$${usdValue.toFixed(2)}`;
  const bolivars = usdValue * rate;
  const bs = new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(bolivars);
  return `$${usdValue.toFixed(2)} (Bs. ${bs})`;
}
