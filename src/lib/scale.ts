import type { LayerId, RiskMode, ScoredTract } from "../types";

export const NRI_COLORS: Record<number, string> = {
  1: "#1d4e89",
  2: "#1f7a6b",
  3: "#c4922a",
  4: "#d2652b",
  5: "#8f2d2d",
};

export type PaintStop = { value: number; color: string };

export type PaintSpec =
  | { kind: "interpolate"; stops: PaintStop[] }
  | { kind: "step"; defaultColor: string; stops: { at: number; color: string }[] };

export type LegendItem = { color: string; label: string };

export type LayerPaint = {
  spec: PaintSpec;
  legend: LegendItem[];
  title: string;
};

export function layerMetric(row: ScoredTract, layer: LayerId, riskMode: RiskMode): number {
  if (layer === "gap") return row.ledger.monthlyGap;
  if (layer === "cash") return row.ledger.netCashGap;
  if (layer === "opportunity") return row.tract.nriQuintile;
  if (layer === "ami") return row.tract.tractAmiPct;
  if (riskMode === "llc") return row.tract.llcOwnershipPct * 100;
  if (riskMode === "pre1980") return row.tract.acsPre1980Pct * 100;
  return ((row.tract.llcOwnershipPct + row.tract.acsPre1980Pct) / 2) * 100;
}

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  return sorted[low] * (high - index) + sorted[high] * (index - low);
}

function tighten(stops: PaintStop[]): PaintStop[] {
  const next = stops.map((stop) => ({ ...stop }));
  for (let i = 1; i < next.length; i += 1) {
    if (next[i].value <= next[i - 1].value) next[i].value = next[i - 1].value + 1;
  }
  return next;
}

function moneyLabel(value: number): string {
  const sign = value < 0 ? "−" : "";
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString("en-US")}`;
}

export function paintFor(layer: LayerId, rows: ScoredTract[], riskMode: RiskMode): LayerPaint {
  const pool = rows.some((row) => row.visible) ? rows.filter((row) => row.visible) : rows;
  const values = pool.map((row) => layerMetric(row, layer, riskMode)).sort((a, b) => a - b);

  if (layer === "opportunity") {
    return {
      title: "NRI quintile",
      spec: {
        kind: "step",
        defaultColor: NRI_COLORS[1],
        stops: [2, 3, 4, 5].map((quintile) => ({ at: quintile, color: NRI_COLORS[quintile] })),
      },
      legend: [1, 2, 3, 4, 5].map((quintile) => ({
        color: NRI_COLORS[quintile],
        label: `Quintile ${quintile}`,
      })),
    };
  }

  if (layer === "gap") {
    const negatives = values.filter((value) => value < 0);
    const low = negatives.length > 0 ? quantile(negatives, 0.2) : 0;
    const high = Math.max(0, quantile(values, 0.9));
    const stops: PaintStop[] = [];
    if (low < -1) {
      stops.push({ value: low, color: "#0e6b45" }, { value: low / 2, color: "#8dceb4" });
    }
    stops.push({ value: 0, color: "#f4efe4" });
    if (high > 1) {
      stops.push({ value: high / 2, color: "#e39155" }, { value: high, color: "#9d1c1c" });
    }
    const safe = tighten(stops.length >= 2 ? stops : [...stops, { value: 1, color: "#f4efe4" }]);
    return {
      title: "Monthly gap",
      spec: { kind: "interpolate", stops: safe },
      legend: safe.map((stop) => ({
        color: stop.color,
        label: stop.value === 0 ? "$0" : `${moneyLabel(stop.value)}/mo`,
      })),
    };
  }

  const low = quantile(values, layer === "cash" ? 0 : 0.08);
  const mid = quantile(values, 0.5);
  const high = Math.max(quantile(values, 0.92), low + 1);
  const ramp =
    layer === "cash"
      ? ["#f6f1e4", "#e0b15a", "#7a4b12"]
      : layer === "ami"
        ? ["#e7f0f6", "#4f86b8", "#1a3e5c"]
        : ["#f6f1e4", "#b56b8a", "#6b2d5b"];
  const stops = tighten([
    { value: Math.min(low, mid), color: ramp[0] },
    { value: mid, color: ramp[1] },
    { value: Math.max(high, mid + 1), color: ramp[2] },
  ]);
  const suffix = layer === "ami" || layer === "risk" ? "%" : "";
  const title =
    layer === "cash"
      ? "Net cash-to-close"
      : layer === "ami"
        ? "Tract AMI"
        : riskMode === "llc"
          ? "LLC ownership"
          : riskMode === "pre1980"
            ? "Pre-1980 housing"
            : "Investor & aging-stock risk";
  return {
    title,
    spec: { kind: "interpolate", stops },
    legend: stops.map((stop) => ({
      color: stop.color,
      label: layer === "cash" ? moneyLabel(stop.value) : `${Math.round(stop.value)}${suffix}`,
    })),
  };
}
