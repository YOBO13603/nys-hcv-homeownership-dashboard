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
  const maxAmi = points.reduce((max, point) => Math.max(max, point.ami), 0);
  const minGap = points.reduce((min, point) => Math.min(min, point.gap), 0);
  const maxGap = points.reduce((max, point) => Math.max(max, point.gap), 0);
  const xMax = Math.max(200, Math.ceil(maxAmi / 50) * 50);
  const yMin = Math.min(-3000, Math.floor(minGap / 1000) * 1000);
  const yMax = Math.max(7000, Math.ceil(maxGap / 1000) * 1000);
  const xTicks = Array.from({ length: xMax / 50 + 1 }, (_, index) => index * 50);
  const yTicks = Array.from({ length: (yMax - yMin) / 1000 + 1 }, (_, index) => yMin + index * 1000);
  const trend = fitLine(points, xMax);
  const hasFeasibleHighAmi = points.some((point) => point.ami >= 100 && point.gap <= 0);

  return (
    <section className="rounded-xl border border-[#e3d9cb] bg-white p-4">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl text-[#1a2a24]">Opportunity vs. affordability</h2>
          <p className="text-sm text-[#5c564c]">
            High tract AMI and a monthly gap at or below $0 is the shaded target zone. The line is the linear fit of the tracts in view.
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
              domain={[0, xMax]}
              ticks={xTicks}
              tick={{ fontSize: 12 }}
              tickFormatter={(value: number) => `${value}%`}
              label={{ value: "Tract AMI %", position: "insideBottom", offset: -2, fontSize: 12 }}
            />
            <YAxis
              type="number"
              dataKey="gap"
              tick={{ fontSize: 12 }}
              width={72}
              domain={[yMin, yMax]}
              ticks={yTicks}
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
            {trend ? (
              <ReferenceLine
                segment={[
                  { x: trend.x1, y: trend.y1 },
                  { x: trend.x2, y: trend.y2 },
                ]}
                stroke="#1a2a24"
                strokeWidth={1.5}
                ifOverflow="hidden"
              />
            ) : null}
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

function fitLine(points: Point[], xMax: number): { x1: number; y1: number; x2: number; y2: number } | null {
  const count = points.length;
  if (count < 2) return null;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  for (const point of points) {
    sumX += point.ami;
    sumY += point.gap;
    sumXX += point.ami * point.ami;
    sumXY += point.ami * point.gap;
  }
  const denominator = count * sumXX - sumX * sumX;
  if (Math.abs(denominator) < 1e-6) return null;
  const slope = (count * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / count;
  return { x1: 0, y1: intercept, x2: xMax, y2: intercept + slope * xMax };
}

type DotProps = { cx?: number; cy?: number; payload?: Point };

function Dot({ cx, cy, payload }: DotProps) {
  if (cx == null || cy == null || !payload) return null;
  return (
    <g style={{ cursor: "pointer" }}>
      <circle
        cx={cx}
        cy={cy}
        r={3.4}
        fill={NRI_COLORS[payload.nri] ?? "#888"}
        fillOpacity={0.92}
        stroke="#1a1a1a"
        strokeWidth={0.7}
      />
    </g>
  );
}
