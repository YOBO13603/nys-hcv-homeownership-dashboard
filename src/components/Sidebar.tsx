import { useState, type ReactNode } from "react";
import type { Controls } from "../types";
import { DEFAULT_CONTROLS } from "../types";
import { money0 } from "../lib/format";

const MSAS = ["Buffalo", "Rochester", "Syracuse", "Ithaca", "Hudson Valley", "Long Island"];

type SidebarProps = {
  controls: Controls;
  counties: string[];
  onChange: (next: Controls) => void;
  onRegion: (msa: string, county: string) => void;
  onReset: () => void;
};

export function Sidebar({ controls, counties, onChange, onRegion, onReset }: SidebarProps) {
  const patch = (partial: Partial<Controls>) => onChange({ ...controls, ...partial });

  return (
    <aside className="max-h-[calc(100vh-188px)] overflow-y-auto border-r border-[#e3d9cb] bg-[#f7f3eb] px-4 py-4 xl:min-h-[560px]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-[#1a2a24] uppercase">Policy & market</h2>
        <button type="button" className="text-xs text-[#0e6b45] underline" onClick={onReset}>
          Reset
        </button>
      </div>

      <Group title="Region & county">
        <div className="flex flex-wrap gap-1.5">
          <Chip active={controls.msa === "all"} onClick={() => onRegion("all", "all")}>
            All 6 metros
          </Chip>
          {MSAS.map((msa) => (
            <Chip key={msa} active={controls.msa === msa} onClick={() => onRegion(msa, "all")}>
              {msa}
            </Chip>
          ))}
        </div>
        <label className="mt-3 block text-xs text-[#5c564c]">
          County
          <select
            className="mt-1 w-full rounded-md border border-[#e3d9cb] bg-white px-2 py-1.5 text-sm"
            value={controls.county}
            onChange={(event) => onRegion(controls.msa, event.target.value)}
          >
            <option value="all">All counties in view</option>
            {counties.map((county) => (
              <option key={county} value={county}>
                {county}
              </option>
            ))}
          </select>
        </label>
      </Group>

      <Group title="Price & voucher">
        <div className="flex gap-1.5">
          <Chip active={controls.priceTier === "median"} onClick={() => patch({ priceTier: "median" })}>
            Median price
          </Chip>
          <Chip active={controls.priceTier === "p25"} onClick={() => patch({ priceTier: "p25" })}>
            25th percentile
          </Chip>
        </div>
        <p className="mt-3 text-xs text-[#5c564c]">Bedroom size</p>
        <div className="mt-1 flex gap-1.5">
          {([1, 2, 3, 4] as const).map((size) => (
            <Chip key={size} active={controls.bedrooms === size} onClick={() => patch({ bedrooms: size })}>
              {size}BR
            </Chip>
          ))}
        </div>
        <Slider
          label="Payment standard"
          min={90}
          max={110}
          step={1}
          value={controls.psPct}
          display={`${controls.psPct}%`}
          onChange={(psPct) => patch({ psPct })}
        />
        <Slider
          label="Interest rate"
          min={5}
          max={8.5}
          step={0.1}
          value={controls.ratePct}
          display={`${controls.ratePct.toFixed(1)}%`}
          onChange={(ratePct) => patch({ ratePct: Math.round(ratePct * 10) / 10 })}
        />
        <p className="mt-3 text-xs text-[#5c564c]">Down-payment assistance</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Chip active={controls.dpaMode === "county"} onClick={() => patch({ dpaMode: "county" })}>
            County default
          </Chip>
          <Chip active={controls.dpaMode === "sonyma"} onClick={() => patch({ dpaMode: "sonyma" })}>
            SONYMA DPAL
          </Chip>
          <Chip active={controls.dpaMode === "custom"} onClick={() => patch({ dpaMode: "custom" })}>
            Custom
          </Chip>
        </div>
        <p className="mt-1 text-[11px] text-[#6d6256]">
          {controls.dpaMode === "county"
            ? "Uses each tract’s local DPA cap."
            : controls.dpaMode === "sonyma"
              ? "min($15,000, 3% of price)."
              : "Applies the same dollar amount in every tract."}
        </p>
        {controls.dpaMode === "custom" ? (
          <Slider
            label="Custom DPA"
            min={0}
            max={50000}
            step={500}
            value={controls.customDpa}
            display={money0(controls.customDpa)}
            onChange={(customDpa) => patch({ customDpa })}
          />
        ) : null}
        <Slider
          label="Buyer cash savings"
          min={0}
          max={15000}
          step={500}
          value={controls.buyerCash}
          display={money0(controls.buyerCash)}
          onChange={(buyerCash) => patch({ buyerCash })}
        />
        <label className="mt-3 flex items-center justify-between gap-3 text-sm">
          <span>Count household share</span>
          <input
            type="checkbox"
            checked={controls.useFamilyShare}
            onChange={(event) => patch({ useFamilyShare: event.target.checked })}
          />
        </label>
        {controls.useFamilyShare ? (
          <>
            <Slider
              label="Household AMI share"
              min={30}
              max={80}
              step={1}
              value={controls.householdAmiPct}
              display={`${controls.householdAmiPct}%`}
              onChange={(householdAmiPct) => patch({ householdAmiPct })}
            />
            <p className="text-[11px] leading-snug text-[#6d6256]">
              Income is the FY2026 HUD median family income for the tract’s county, times this share.
              The family pays 30% of that monthly income. In the New York HUD Metro, published income
              limits are raised for housing costs and are not a straight cut of the median.
            </p>
          </>
        ) : (
          <p className="text-[11px] text-[#6d6256]">Off: voucher coverage is tested with a $0 family share.</p>
        )}
      </Group>

      <Accordion
        title="High opportunity"
        badge={
          Number(controls.wriOnly) +
          Number(controls.nriMin !== DEFAULT_CONTROLS.nriMin) +
          Number(controls.nriMax !== DEFAULT_CONTROLS.nriMax)
        }
      >
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Well-resourced areas only</span>
          <input
            type="checkbox"
            checked={controls.wriOnly}
            onChange={(event) => patch({ wriOnly: event.target.checked })}
          />
        </label>
        <Slider
          label="NRI quintile from"
          min={1}
          max={5}
          step={1}
          value={controls.nriMin}
          display={String(controls.nriMin)}
          onChange={(nriMin) => patch({ nriMin, nriMax: Math.max(nriMin, controls.nriMax) })}
        />
        <Slider
          label="NRI quintile to"
          min={1}
          max={5}
          step={1}
          value={controls.nriMax}
          display={String(controls.nriMax)}
          onChange={(nriMax) => patch({ nriMax, nriMin: Math.min(controls.nriMin, nriMax) })}
        />
      </Accordion>

      <Accordion
        title="Secondary-market reality check"
        badge={
          Number(controls.maxLlc < DEFAULT_CONTROLS.maxLlc) +
          Number(controls.maxPre1980 < DEFAULT_CONTROLS.maxPre1980) +
          Number(controls.minListings > DEFAULT_CONTROLS.minListings)
        }
      >
        <Slider
          label="Max LLC ownership"
          min={0}
          max={100}
          step={1}
          value={controls.maxLlc}
          display={`${controls.maxLlc}%`}
          onChange={(maxLlc) => patch({ maxLlc })}
        />
        <Slider
          label="Max pre-1980 housing"
          min={0}
          max={100}
          step={1}
          value={controls.maxPre1980}
          display={`${controls.maxPre1980}%`}
          onChange={(maxPre1980) => patch({ maxPre1980 })}
        />
        <Slider
          label="Min active ZIP listings"
          min={0}
          max={100}
          step={1}
          value={controls.minListings}
          display={controls.minListings === 100 ? "100+" : String(controls.minListings)}
          onChange={(minListings) => patch({ minListings })}
        />
      </Accordion>

      <p className="mt-4 text-[11px] leading-relaxed text-[#6d6256]">
        Screening math uses a 3.5% FHA down payment, 1.75% upfront MIP, 0.55% annual MIP, and a 30-year
        fixed loan. The inspection fee is $550 when more than 30% of tract homes were built before 1940,
        otherwise $400. Defaults match a pure voucher test at {DEFAULT_CONTROLS.ratePct.toFixed(1)}%.
      </p>
    </aside>
  );
}

function Accordion({ title, badge, children }: { title: string; badge: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-4 border-t border-[#e3d9cb] pt-3">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="text-[11px] tracking-[0.16em] text-[#6d6256] uppercase">{title}</span>
        <span className="flex items-center gap-2">
          {badge > 0 ? (
            <span className="rounded-full bg-[#1a2a24] px-1.5 py-0.5 text-[10px] leading-none text-[#f6f1e8]">
              {badge}
            </span>
          ) : null}
          <span className="text-sm text-[#6d6256]" aria-hidden>
            {open ? "−" : "+"}
          </span>
        </span>
      </button>
      {open ? <div className="pt-2">{children}</div> : null}
    </section>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4 border-t border-[#e3d9cb] pt-3 first:mt-0 first:border-0 first:pt-0">
      <h3 className="mb-2 text-[11px] tracking-[0.16em] text-[#6d6256] uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs ${
        active ? "bg-[#1a2a24] text-[#f6f1e8]" : "bg-white text-[#1c2430] ring-1 ring-[#e3d9cb]"
      }`}
    >
      {children}
    </button>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  display,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="mt-3 block">
      <span className="flex items-baseline justify-between text-[13px]">
        <span>{label}</span>
        <span className="font-medium tabular-nums">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
