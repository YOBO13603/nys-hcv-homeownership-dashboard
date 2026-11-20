import type { Summary } from "../types";
import { integer, money0 } from "../lib/format";

export function KpiStrip({ summary }: { summary: Summary }) {
  const gap = summary.medianGap;
  const gapLabel = gap == null ? "—" : gap <= 0 ? "Median monthly surplus" : "Median monthly gap";
  return (
    <div className="grid grid-cols-2 gap-2 px-4 pb-3 md:grid-cols-3 xl:grid-cols-5">
      <Card
        testId="kpi-monthly"
        label="Monthly feasible tracts"
        value={summary.count ? integer(summary.monthlyCount) : "—"}
        hint={summary.count ? `${summary.monthlyPct.toFixed(1)}% of ${integer(summary.count)} in view` : "No tracts in view"}
      />
      <Card
        testId="kpi-full"
        label="Fully feasible, monthly + cash"
        value={summary.count ? integer(summary.fullCount) : "—"}
        hint={summary.count ? `${summary.fullPct.toFixed(1)}% of tracts in view` : "Cash within buyer savings"}
      />
      <Card
        testId="kpi-wri"
        label="High-opportunity feasible"
        value={summary.count ? integer(summary.wriMonthlyCount) : "—"}
        hint="WRI = Yes and monthly gap ≤ $0"
      />
      <Card
        testId="kpi-cash"
        label="Median net cash-to-close"
        value={summary.medianCash == null ? "—" : money0(summary.medianCash)}
        hint="After applied down-payment aid"
      />
      <Card
        testId="kpi-gap"
        label={gapLabel}
        value={gap == null ? "—" : `${gap > 0 ? "" : gap < 0 ? "−" : ""}${money0(Math.abs(gap))}/mo`}
        hint="Cost minus voucher and family share"
      />
    </div>
  );
}

function Card({
  label,
  value,
  hint,
  testId,
}: {
  label: string;
  value: string;
  hint: string;
  testId: string;
}) {
  return (
    <article data-testid={testId} className="rounded-lg border border-[#e3d9cb] bg-white/75 px-3 py-2">
      <p className="text-[11px] tracking-wide text-[#6d6256] uppercase">{label}</p>
      <p className="font-serif text-[1.65rem] leading-tight text-[#1a2a24] tabular-nums">{value}</p>
      <p className="text-xs text-[#5c564c]">{hint}</p>
    </article>
  );
}
