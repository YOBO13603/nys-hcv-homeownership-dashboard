import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Controls, Ledger, Tract } from "../types";
import { deduction, money, money0, ratePercent, sharePercent } from "../lib/format";

type DrawerProps = {
  tract: Tract;
  ledger: Ledger;
  controls: Controls;
  addressLabel: string | null;
  priceText: string;
  onPriceText: (value: string) => void;
  onClose: () => void;
  onShowMap: () => void;
};

export function LedgerDrawer({
  tract,
  ledger,
  controls,
  addressLabel,
  priceText,
  onPriceText,
  onClose,
  onShowMap,
}: DrawerProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const priceInvalid = priceText.trim() !== "" && !(Number(priceText.replace(/[$,]/g, "")) > 0);
  const banner = ledger.fullyFeasible
    ? { tone: "good" as const, title: "Fully feasible", body: "Monthly cost is covered and cash due is within buyer savings." }
    : ledger.monthlyFeasible
      ? { tone: "mid" as const, title: "Monthly feasible", body: "The voucher covers the carrying cost. Cash to close still exceeds buyer savings." }
      : { tone: "bad" as const, title: "Monthly gap", body: "Carrying cost is above the voucher and any family share." };

  return (
    <aside
      data-testid="drawer"
      className="fixed top-0 right-0 z-40 flex h-screen w-[min(440px,100%)] flex-col bg-[#fbf8f2] shadow-[-16px_0_40px_rgb(20_24_32_/_18%)]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-[#e3d9cb] px-4 py-3">
        <div>
          <p className="text-[11px] tracking-[0.14em] text-[#6d6256] uppercase">Tract ledger</p>
          <h2 className="font-serif text-xl leading-tight text-[#1a2a24]">{tract.tractLabel}</h2>
          <p className="text-sm text-[#5c564c]">
            {tract.countyName} · {tract.msaName} · ZIP {tract.parentZip}
          </p>
          <p className="mt-1 font-mono text-xs text-[#6d6256]">{tract.geoid}</p>
          {addressLabel ? <p className="mt-1 text-sm text-[#1c2430]">{addressLabel}</p> : null}
        </div>
        <button type="button" className="rounded-full px-2 py-1 text-sm text-[#5c564c]" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="mb-3 flex flex-wrap gap-1.5">
          <Badge tone={tract.wri ? "good" : "plain"}>{tract.wri ? "WRI Yes" : "WRI No"}</Badge>
          <Badge tone="plain">NRI {tract.nriQuintile}</Badge>
          <Badge tone="plain">Tract AMI {sharePercent(tract.tractAmiPct / 100, 1)}</Badge>
        </div>

        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            banner.tone === "good"
              ? "bg-[#e5f4ec] text-[#0e6b45]"
              : banner.tone === "mid"
                ? "bg-[#fbf3df] text-[#7a5620]"
                : "bg-[#fdecea] text-[#9d1c1c]"
          }`}
        >
          <p className="font-semibold">{banner.title}</p>
          <p>{banner.body}</p>
        </div>

        <label className="mt-4 block text-sm">
          <span className="font-medium">Custom asking price override ($)</span>
          <input
            data-testid="price-override"
            inputMode="decimal"
            value={priceText}
            placeholder={money0(ledger.tierPrice)}
            className="mt-1 w-full rounded-md border border-[#e3d9cb] bg-white px-3 py-2 tabular-nums"
            onChange={(event) => onPriceText(event.target.value)}
          />
        </label>
        <div className="mt-1 flex items-center justify-between text-[11px] text-[#6d6256]">
          <span>
            {ledger.priceSource === "custom"
              ? "Ledger uses this asking price."
              : `Ledger uses the ${ledger.priceSource === "median" ? "median" : "25th percentile"} price.`}
          </span>
          {priceText ? (
            <button type="button" className="text-[#0e6b45] underline" onClick={() => onPriceText("")}>
              Use tier price
            </button>
          ) : null}
        </div>
        {priceInvalid ? <p className="text-[11px] text-[#9d1c1c]">Enter a price greater than zero.</p> : null}
        <p className="mt-1 text-[11px] text-[#6d6256]">Map, KPIs, and the table stay on the sidebar price tier.</p>

        <Section title="Ledger A · Upfront cash-to-close">
          <Headline
            label="Asking price"
            hint={
              ledger.priceSource === "custom"
                ? "Counselor override"
                : ledger.priceSource === "median"
                  ? "Tract median home value"
                  : "Tract 25th percentile home value"
            }
            value={money(ledger.price)}
          />
          <Headline label="Gross upfront cash" hint="Down payment + HMDA costs + MRT + inspection" value={money(ledger.grossUpfront)} />
          <Headline
            label="Applied DPA"
            hint={
              ledger.programDpa > ledger.grossUpfront
                ? `${ledger.dpaLabel}. Program offers ${money(ledger.programDpa)}; ${money(ledger.appliedDpa)} covers the cash due.`
                : ledger.dpaLabel
            }
            value={deduction(ledger.appliedDpa)}
            tone="good"
          />
          <Headline
            label="Net cash gap"
            hint={
              ledger.netCashGap <= controls.buyerCash
                ? `Within buyer savings of ${money0(controls.buyerCash)}`
                : `Above buyer savings of ${money0(controls.buyerCash)}`
            }
            value={money(ledger.netCashGap)}
            tone={ledger.netCashGap <= controls.buyerCash ? "good" : "bad"}
          />
          <div className="mt-2 rounded-lg bg-[#f7f3eb] px-3 py-1">
            <p className="pt-1 text-[10px] tracking-[0.14em] text-[#8a7f72] uppercase">Cash components</p>
            <Line label="Down payment" hint="3.5% × price" value={money(ledger.downPayment)} />
            <Line label="Base loan" hint="Price − down payment (96.5%)" value={money(ledger.baseLoan)} />
            <Line
              label="HMDA loan costs"
              hint={`${tract.hmdaSampleCount.toLocaleString("en-US")} loan sample · ${tract.isImputed ? "imputed" : "observed"}`}
              value={money(ledger.hmdaCosts)}
            />
            <Line
              label="NY mortgage recording tax"
              hint={`${ledger.mrtLabel} ${ratePercent(tract.countyMrtRate)} × base loan`}
              value={money(ledger.mrtCost)}
            />
            <Line
              label="Inspection fee"
              hint={
                ledger.leadTrigger
                  ? "Pre-1940 stock is over 30%, so the $150 lead-paint surcharge applies"
                  : "Pre-1940 stock is 30% or less"
              }
              value={money(ledger.inspectionFee)}
            />
          </div>
        </Section>

        <Section title="Ledger B · Monthly carrying cost">
          <Headline label="Total monthly cost" value={money(ledger.totalMonthly)} />
          <Headline
            label="Voucher standard"
            hint={`${controls.bedrooms}BR ${money(ledger.nominalPaymentStandard)} × ${controls.psPct}%`}
            value={deduction(ledger.effectivePaymentStandard)}
            tone="good"
          />
          <Headline
            label={ledger.monthlyGap <= 0 ? "Monthly surplus" : "Monthly gap"}
            hint="Total cost − payment standard − family share"
            value={ledger.monthlyGap <= 0 ? money(Math.abs(ledger.monthlyGap)) : money(ledger.monthlyGap)}
            tone={ledger.monthlyGap <= 0 ? "good" : "bad"}
          />
          <div className="mt-2 rounded-lg bg-[#f7f3eb] px-3 py-1">
            <p className="pt-1 text-[10px] tracking-[0.14em] text-[#8a7f72] uppercase">Monthly components</p>
            <Line label="FHA upfront MIP" hint="1.75% × base loan, financed" value={money(ledger.upfrontMip)} />
            <Line label="Total FHA loan" hint="Base loan × 1.0175" value={money(ledger.totalFhaLoan)} />
            <Line
              label="Principal & interest"
              hint={`30-year fixed at ${controls.ratePct.toFixed(1)}% on the FHA loan`}
              value={money(ledger.monthlyPi)}
            />
            <Line
              label="Property tax"
              hint={`${ratePercent(tract.effPropertyTaxRate)} × price ÷ 12`}
              value={money(ledger.monthlyTax)}
            />
            <Line label="Home insurance" hint="Annual premium ÷ 12" value={money(ledger.monthlyIns)} />
            <Line label="FHA annual MIP" hint="0.55% × base loan ÷ 12" value={money(ledger.monthlyMip)} />
            <Line label="Utilities" hint="Tract estimate" value={money(ledger.monthlyUtilities)} />
            <Line
              label="Family contribution"
              hint={
                controls.useFamilyShare
                  ? `30% of monthly income at ${controls.householdAmiPct}% of ${money0(ledger.annualAmi)} (${ledger.amiArea})`
                  : "Turned off — pure voucher test"
              }
              value={deduction(ledger.familyContribution)}
              tone="good"
            />
          </div>
        </Section>

        <section className="mt-4 rounded-lg border border-[#e3d9cb] bg-white px-3 py-2">
          <h3 className="text-[11px] tracking-[0.14em] text-[#6d6256] uppercase">Market reality check</h3>
          <dl className="mt-2 space-y-1.5 text-sm">
            <Fact label="Pre-1980 stock" value={sharePercent(tract.acsPre1980Pct)} />
            <Fact label="Pre-1940 stock" value={sharePercent(tract.acsPre1940Pct)} />
            <Fact label="Substandard housing" value={sharePercent(tract.acsSubstandardPct)} />
            <Fact label="LLC investor ownership" value={sharePercent(tract.llcOwnershipPct)} />
            <Fact label={`Active listings in ${tract.parentZip}`} value={tract.activeListingsZip.toLocaleString("en-US")} />
            <Fact
              label="HMDA sample"
              value={`${tract.hmdaSampleCount.toLocaleString("en-US")} · ${tract.isImputed ? "Imputed" : "Observed"}`}
            />
          </dl>
          <p
            className={`mt-3 inline-block rounded-full px-2.5 py-1 text-xs ${
              ledger.leadTrigger ? "bg-[#fdecea] text-[#9d1c1c]" : "bg-[#eef3f6] text-[#1c2430]"
            }`}
          >
            {ledger.leadTrigger ? "$550 lead-paint inspection triggered" : "$400 inspection · lead surcharge not triggered"}
          </p>
        </section>

        <button type="button" className="mt-4 text-sm text-[#0e6b45] underline" onClick={onShowMap}>
          Show this tract on the map
        </button>
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="text-[11px] tracking-[0.14em] text-[#6d6256] uppercase">{title}</h3>
      <div className="mt-1">{children}</div>
    </section>
  );
}

function Headline({
  label,
  hint,
  value,
  tone = "plain",
}: {
  label: string;
  hint?: string;
  value: string;
  tone?: "plain" | "good" | "bad";
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#efeae0] py-2 last:border-0">
      <div>
        <p className="text-sm font-semibold text-[#1a2a24]">{label}</p>
        {hint ? <p className="text-[11px] leading-snug text-[#6d6256]">{hint}</p> : null}
      </div>
      <p
        className={`font-serif text-xl leading-none tabular-nums ${
          tone === "good" ? "text-[#0e6b45]" : tone === "bad" ? "text-[#9d1c1c]" : "text-[#1a2a24]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Line({
  label,
  hint,
  value,
  strong,
  tone = "plain",
}: {
  label: string;
  hint?: string;
  value: string;
  strong?: boolean;
  tone?: "plain" | "good" | "bad";
}) {
  return (
    <div className={`flex items-start justify-between gap-4 py-1.5 ${strong ? "mt-1 border-t border-[#e3d9cb] pt-2" : ""}`}>
      <div>
        <p className={`text-[13px] ${strong ? "font-semibold" : ""}`}>{label}</p>
        {hint ? <p className="text-[11px] leading-snug text-[#6d6256]">{hint}</p> : null}
      </div>
      <p
        className={`text-[13px] tabular-nums ${strong ? "font-semibold" : ""} ${
          tone === "good" ? "text-[#0e6b45]" : tone === "bad" ? "text-[#9d1c1c]" : "text-[#1c2430]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone: "good" | "plain" }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] ${
        tone === "good" ? "bg-[#e5f4ec] text-[#0e6b45]" : "bg-[#efeae0] text-[#1c2430]"
      }`}
    >
      {children}
    </span>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[#5c564c]">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

export function usePriceOverride(selectedGeoid: string | null): [string, (value: string) => void, number | null] {
  const [priceText, setPriceText] = useState("");
  const geoidRef = useRef(selectedGeoid);
  if (geoidRef.current !== selectedGeoid) {
    geoidRef.current = selectedGeoid;
    if (priceText !== "") setPriceText("");
  }
  const parsed = Number(priceText.replace(/[$,\s]/g, ""));
  const override = priceText.trim() !== "" && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  return [priceText, setPriceText, override];
}
