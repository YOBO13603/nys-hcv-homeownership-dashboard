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

const MONEY_STEPS = [100, 250, 500, 1000, 1500, 2000, 2500, 5000, 10000, 20000, 25000, 50000];
const PERCENT_STEPS = [5, 10, 20, 25, 50];

export function layerMetric(row: ScoredTract, layer: LayerId, riskMode: RiskMode): number {
  if (layer === "gap") return row.ledger.monthlyGap;
  if (layer === "cash") return row.ledger.netCashGap;
  if (layer === "opportunity") return row.tract.nriQuintile;
  if (layer === "ami") return row.tract.tractAmiPct;
  if (riskMode === "llc") return row.tract.llcOwnershipPct * 100;
  if (riskMode === "pre1980") return row.tract.acsPre1980Pct * 100;
  return ((row.tract.llcOwnershipPct + row.tract.acsPre1980Pct) / 2) * 100;
}

function roundNice(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function classEdges(min: number, max: number, steps: number[]): number[] {
  let best: number[] | null = null;
  let bestScore = Infinity;
  for (const step of steps) {
    let start = Math.floor(min / step) * step;
    let end = Math.ceil(max / step) * step;
    if (end <= start) end = start + step;
    let classes = Math.round((end - start) / step);
    while (classes < 5) {
      if (end - max <= min - start) end += step;
      else start -= step;
      classes += 1;
    }
    if (classes > 7) continue;
    const score = Math.abs(classes - 6) + step / 1_000_000;
    if (score < bestScore) {
      bestScore = score;
      const edges: number[] = [];
      for (let value = start; value <= end + step * 0.001; value += step) edges.push(roundNice(value));
      best = edges;
    }
  }
  if (best && best.length >= 2) return best;
  const step = steps[steps.length - 1];
  const start = Math.floor(min / step) * step;
  const end = Math.max(start + step * 5, Math.ceil(max / step) * step);
  const edges: number[] = [];
  for (let value = start; value <= end + step * 0.001 && edges.length < 8; value += step) {
    edges.push(roundNice(value));
  }
  return edges;
}

function moneyLabel(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString("en-US")}`;
}

function rangeLabels(edges: number[], kind: "money" | "percent"): string[] {
  const labels: string[] = [];
  for (let index = 0; index < edges.length - 1; index += 1) {
    const start = edges[index];
    const end = edges[index + 1];
    labels.push(kind === "money" ? `${moneyLabel(start)} to ${moneyLabel(end)}` : `${start}–${end}%`);
  }
  return labels;
}

function sampleRamp(ramp: string[], count: number): string[] {
  if (count <= 1) return [ramp[0]];
  return Array.from({ length: count }, (_, index) => {
    const slot = Math.round((index / (count - 1)) * (ramp.length - 1));
    return ramp[slot];
  });
}

function gapColors(edges: number[]): string[] {
  const greens = ["#0e6b45", "#3d9a6e", "#8dceb4"];
  const warms = ["#f4efe4", "#f3c48a", "#e39155", "#d2652b", "#9d1c1c"];
  const classes = edges.length - 1;
  const negative: number[] = [];
  const positive: number[] = [];
  for (let index = 0; index < classes; index += 1) {
    if (edges[index + 1] <= 0) negative.push(index);
    else positive.push(index);
  }
  const colors = new Array<string>(classes);
  negative.forEach((index, order) => {
    const slot = greens.length - negative.length + order;
    colors[index] = greens[Math.max(0, Math.min(greens.length - 1, slot))];
  });
  positive.forEach((index, order) => {
    colors[index] = warms[Math.min(warms.length - 1, order)];
  });
  return colors;
}

function stepped(
  title: string,
  edges: number[],
  colors: string[],
  kind: "money" | "percent",
): LayerPaint {
  const labels = rangeLabels(edges, kind);
  return {
    title,
    spec: {
      kind: "step",
      defaultColor: colors[0],
      stops: edges.slice(1, -1).map((at, index) => ({ at, color: colors[index + 1] ?? colors[colors.length - 1] })),
    },
    legend: labels.map((label, index) => ({ color: colors[index], label })),
  };
}

export function paintFor(layer: LayerId, rows: ScoredTract[], riskMode: RiskMode): LayerPaint {
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

  const pool = rows.some((row) => row.visible) ? rows.filter((row) => row.visible) : rows;
  const values = pool.map((row) => layerMetric(row, layer, riskMode));
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;

  if (layer === "gap") {
    const edges = classEdges(Math.min(min, 0), Math.max(max, 0), MONEY_STEPS);
    return stepped("Monthly gap", edges, gapColors(edges), "money");
  }

  if (layer === "cash") {
    const edges = classEdges(Math.min(min, 0), Math.max(max, 0), MONEY_STEPS);
    const colors = sampleRamp(["#f6f1e4", "#f0d7a0", "#e0b15a", "#c4843a", "#8a5420", "#5c3812"], edges.length - 1);
    return stepped("Net cash-to-close", edges, colors, "money");
  }

  if (layer === "ami") {
    const edges = classEdges(min, max, PERCENT_STEPS);
    const colors = sampleRamp(["#e7f0f6", "#b7d0e6", "#6fa0c8", "#3d74a3", "#1a3e5c"], edges.length - 1);
    return stepped("Tract AMI", edges, colors, "percent");
  }

  const title =
    riskMode === "llc" ? "LLC ownership" : riskMode === "pre1980" ? "Pre-1980 housing" : "Investor & aging-stock risk";
  const edges = classEdges(Math.min(min, 0), Math.max(max, 1), PERCENT_STEPS);
  const colors = sampleRamp(["#f6f1e4", "#efd0dc", "#d792ae", "#a85b82", "#6b2d5b"], edges.length - 1);
  return stepped(title, edges, colors, "percent");
}
