const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function money(value: number): string {
  return usd.format(value);
}

export function money0(value: number): string {
  return usd0.format(value);
}

export function deduction(value: number): string {
  return `−${usd.format(Math.abs(value))}`;
}

export function integer(value: number): string {
  return value.toLocaleString("en-US");
}

export function sharePercent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function ratePercent(fraction: number): string {
  return `${(fraction * 100).toFixed(2)}%`;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}
