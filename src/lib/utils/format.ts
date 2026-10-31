const pesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-PH");

export function formatCurrency(value: number): string {
  return pesoFormatter.format(value);
}

/** ₱420M, ₱1.2B, ₱850K */
export function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}₱${trim(abs / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${sign}₱${trim(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}₱${trim(abs / 1_000)}K`;
  return `${sign}₱${abs}`;
}

export function formatCompactNumber(value: number): string {
  return formatCompactCurrency(value).replace("₱", "");
}

function trim(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** Accepts a ratio (0.8412) and returns "84.12%". */
export function formatPercent(ratio: number, digits = 2): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function safeRatio(part: number, whole: number): number {
  return whole === 0 ? 0 : part / whole;
}
