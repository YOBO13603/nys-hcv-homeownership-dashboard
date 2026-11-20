import {
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ScoredTract } from "../types";
import { NRI_COLORS } from "../lib/scale";
import { money0 } from "../lib/format";

type Point = {
  geoid: string;
  label: string;
  ami: number;
  gap: number;
  nri: number;
  wri: boolean;
};

export function ScatterPlot({ rows, onSelect }: { rows: ScoredTract[]; onSelect: (geoid: string) => void }) {
  const points: Point[] = rows.map((row) => ({
    geoid: row.tract.geoid,
    label: row.tract.tractLabel,
    ami: row.tract.tractAmiPct,
    gap: row.ledger.monthlyGap,
    nri: row.tract.nriQuintile,
    wri: row.tract.wri,
  }));
  const maxAmi = points.reduce((max, point) => Math.max(max, point.ami), 100);
  const minGap = points.reduce((min, point) => Math.min(min, point.gap), 0);
  const hasFeasibleHighAmi = points.some((point) => point.ami >= 100 && point.gap <= 0);

  return (
    <section className="rounded-xl border border-[#e3d9cb] bg-white p-4">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl text-[#1a2a24]">Opportunity vs. affordability</h2>
          <p className="text-sm text-[#5c564c]">
            High tract AMI and a monthly gap at or below $0 is the shaded target zone. Rings mark WRI tracts.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 text-[11px] text-[#5c564c]">
          {[1, 2, 3, 4, 5].map((quintile) => (
            <span key={quintile} className="inline-flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: NRI_COLORS[quintile] }} />
              NRI {quintile}
            </span>
          ))}
        </div>
      </div>
      <div className="h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 12, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="#efe6d8" />
            <XAxis
              type="number"
              dataKey="ami"
              name="Tract AMI"
              unit="%"
              tick={{ fontSize: 12 }}
              label={{ value: "Tract AMI %", position: "insideBottom", offset: -2, fontSize: 12 }}
            />
            <YAxis
              type="number"
              dataKey="gap"
              tick={{ fontSize: 12 }}
              width={64}
              domain={[(min: number) => Math.min(min, 0), (max: number) => Math.max(max, 0)]}
              tickFormatter={(value: number) => money0(value)}
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ payload }) => {
                const point = payload?.[0]?.payload as Point | undefined;
                if (!point) return null;
                return (
                  <div className="rounded-md border border-[#e3d9cb] bg-white px-2 py-1.5 text-xs shadow">
                    <p className="font-medium">{point.label}</p>
                    <p>AMI {point.ami.toFixed(1)}% · NRI {point.nri}{point.wri ? " · WRI" : ""}</p>
                    <p>{point.gap <= 0 ? "Surplus" : "Gap"} {money0(Math.abs(point.gap))}/mo</p>
                  </div>
                );
              }}
            />
            <ReferenceLine y={0} stroke="#1c2430" strokeDasharray="4 4" />
            {hasFeasibleHighAmi ? (
              <ReferenceArea x1={100} x2={maxAmi} y1={minGap} y2={0} fill="#0e6b45" fillOpacity={0.08} ifOverflow="hidden" />
            ) : null}
            <Scatter
              data={points}
              isAnimationActive={false}
              shape={(props: unknown) => <Dot {...(props as DotProps)} />}
              onClick={(item) => {
                const point = item as Point & { payload?: Point };
                const geoid = point.geoid ?? point.payload?.geoid;
                if (geoid) onSelect(geoid);
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

type DotProps = { cx?: number; cy?: number; payload?: Point };

function Dot({ cx, cy, payload }: DotProps) {
  if (cx == null || cy == null || !payload) return null;
  return (
    <g style={{ cursor: "pointer" }}>
      {payload.wri ? <circle cx={cx} cy={cy} r={6} fill="none" stroke="#1c2430" strokeOpacity={0.4} /> : null}
      <circle cx={cx} cy={cy} r={3.2} fill={NRI_COLORS[payload.nri] ?? "#888"} fillOpacity={0.9} />
    </g>
  );
}
