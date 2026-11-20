import { useEffect, useMemo, useRef, useState } from "react";
import type { AddressHit, CameraRequest, Controls, LayerId, RiskMode } from "./types";
import { DEFAULT_CONTROLS } from "./types";
import { type Dataset, loadDataset } from "./lib/load";
import { assumptionsFrom, computeLedger, tractVisible } from "./lib/finance";
import { median } from "./lib/format";
import { locateTract, unionBBox } from "./lib/geo";
import { layerMetric, paintFor } from "./lib/scale";
import { KpiStrip } from "./components/KpiStrip";
import { Sidebar } from "./components/Sidebar";
import { MapView } from "./components/MapView";
import { SearchBar } from "./components/SearchBar";
import { LedgerDrawer, usePriceOverride } from "./components/LedgerDrawer";
import { ScatterPlot } from "./components/ScatterPlot";
import { TractTable } from "./components/TractTable";

const LAYERS: { id: LayerId; label: string }[] = [
  { id: "gap", label: "Monthly gap" },
  { id: "cash", label: "Net cash-to-close" },
  { id: "opportunity", label: "Opportunity tier" },
  { id: "ami", label: "Tract AMI" },
  { id: "risk", label: "Investor & aging housing" },
];

export function App() {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    loadDataset()
      .then((loaded) => {
        if (!cancel) setData(loaded);
      })
      .catch((reason: unknown) => {
        if (!cancel) setError(reason instanceof Error ? reason.message : "Could not load data");
      });
    return () => {
      cancel = true;
    };
  }, []);

  if (error) {
    return <Screen title="The dashboard could not load the tract data">{error}</Screen>;
  }
  if (!data) {
    return <Screen title="Loading 2,104 tracts">Reading the master table and census boundaries.</Screen>;
  }
  return <Dashboard data={data} />;
}

function Dashboard({ data }: { data: Dataset }) {
  const [controls, setControls] = useState<Controls>(DEFAULT_CONTROLS);
  const [layer, setLayer] = useState<LayerId>("gap");
  const [riskMode, setRiskMode] = useState<RiskMode>("combined");
  const [selectedGeoid, setSelectedGeoid] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pin, setPin] = useState<{ lon: number; lat: number; label: string } | null>(null);
  const [spotlightGeoid, setSpotlightGeoid] = useState<string | null>(null);
  const [addressLabel, setAddressLabel] = useState<string | null>(null);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [camera, setCamera] = useState<CameraRequest | null>(null);
  const token = useRef(0);
  const mapAnchor = useRef<HTMLDivElement | null>(null);
  const [priceText, setPriceText, priceOverride] = usePriceOverride(selectedGeoid);

  useEffect(() => {
    const bbox = unionBBox([...data.bboxes.values()]);
    if (bbox) setCamera({ token: ++token.current, kind: "bounds", bbox });
  }, [data]);

  const assumptions = useMemo(() => assumptionsFrom(controls), [controls]);
  const scored = useMemo(
    () =>
      data.tracts.map((tract) => ({
        tract,
        ledger: computeLedger(tract, assumptions),
        visible: tractVisible(tract, controls),
      })),
    [data, assumptions, controls],
  );
  const visibleRows = useMemo(() => scored.filter((row) => row.visible), [scored]);
  const summary = useMemo(() => {
    const count = visibleRows.length;
    const monthlyCount = visibleRows.filter((row) => row.ledger.monthlyFeasible).length;
    const fullCount = visibleRows.filter((row) => row.ledger.fullyFeasible).length;
    return {
      count,
      monthlyCount,
      monthlyPct: count ? (monthlyCount / count) * 100 : 0,
      fullCount,
      fullPct: count ? (fullCount / count) * 100 : 0,
      wriMonthlyCount: visibleRows.filter((row) => row.tract.wri && row.ledger.monthlyFeasible).length,
      medianCash: median(visibleRows.map((row) => row.ledger.netCashGap)),
      medianGap: median(visibleRows.map((row) => row.ledger.monthlyGap)),
    };
  }, [visibleRows]);
  const paint = useMemo(() => paintFor(layer, scored, riskMode), [layer, scored, riskMode]);
  const states = useMemo(
    () =>
      scored.map((row) => ({
        id: row.tract.geoid,
        metric: layerMetric(row, layer, riskMode),
        on: row.visible ? 1 : 0,
        wri: row.tract.wri ? 1 : 0,
      })),
    [scored, layer, riskMode],
  );
  const counties = useMemo(() => {
    const names = new Set<string>();
    for (const tract of data.tracts) {
      if (controls.msa === "all" || tract.msaName === controls.msa) names.add(tract.countyName);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [data, controls.msa]);

  function frameRegion(msa: string, county: string) {
    const boxes = [];
    for (const tract of data.tracts) {
      if (msa !== "all" && tract.msaName !== msa) continue;
      if (county !== "all" && tract.countyName !== county) continue;
      const bbox = data.bboxes.get(tract.geoid);
      if (bbox) boxes.push(bbox);
    }
    const bbox = unionBBox(boxes);
    if (bbox) setCamera({ token: ++token.current, kind: "bounds", bbox });
  }

  function clearSpotlight() {
    setSpotlightGeoid(null);
    setPin(null);
    setAddressLabel(null);
    setSelectedGeoid(null);
    setDrawerOpen(false);
    setSearchNote(null);
  }

  function selectTract(geoid: string) {
    setSelectedGeoid(geoid);
    setDrawerOpen(true);
    setSearchNote(null);
    setSpotlightGeoid(null);
    setPin(null);
    setAddressLabel(null);
    const bbox = data.bboxes.get(geoid);
    if (bbox) setCamera({ token: ++token.current, kind: "bounds", bbox });
    mapAnchor.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function onAddress(hit: AddressHit) {
    const label = [hit.label, hit.detail].filter(Boolean).join(" · ");
    setPin({ lon: hit.lon, lat: hit.lat, label: hit.label });
    setAddressLabel(label);
    setCamera({ token: ++token.current, kind: "point", lon: hit.lon, lat: hit.lat, zoom: 14.5 });
    const geoid = locateTract(data.index, hit.lon, hit.lat);
    mapAnchor.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    if (!geoid) {
      setSpotlightGeoid(null);
      setSelectedGeoid(null);
      setSearchNote("That address is outside the 2,104 tracts in these six metros.");
      setDrawerOpen(false);
      return;
    }
    setSpotlightGeoid(geoid);
    setSelectedGeoid(geoid);
    setDrawerOpen(true);
    setSearchNote(null);
  }

  const selected = selectedGeoid ? (data.byGeoid.get(selectedGeoid) ?? null) : null;
  const drawerLedger = selected ? computeLedger(selected, assumptions, priceOverride) : null;
  const outsideFilters = selected ? !tractVisible(selected, controls) : false;

  return (
    <div className="min-h-screen">
      <header className="border-b border-[#e3d9cb] bg-[#f7f3eb]">
        <div className="flex flex-wrap items-end justify-between gap-2 px-4 pt-3 pb-2">
          <div>
            <p className="text-[11px] tracking-[0.18em] text-[#6d6256] uppercase">
              New York State · Housing Choice Voucher
            </p>
            <h1 className="font-serif text-[1.7rem] leading-none text-[#1a2a24]">Homeownership feasibility</h1>
          </div>
          <p className="text-sm text-[#5c564c]">2,104 / 2,104 tracts joined · 20 counties · 6 metros</p>
        </div>
        <KpiStrip summary={summary} />
      </header>
      <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)]">
        <Sidebar
          controls={controls}
          counties={counties}
          onChange={setControls}
          onRegion={(msa, county) => {
            setControls((current) => ({ ...current, msa, county }));
            frameRegion(msa, county);
          }}
          onReset={() => {
            setControls(DEFAULT_CONTROLS);
            frameRegion("all", "all");
          }}
        />
        <div ref={mapAnchor} className="relative h-[calc(100vh-188px)] min-h-[560px]">
          <MapView
            geojson={data.geojson}
            states={states}
            paint={paint.spec}
            opportunity={layer === "opportunity"}
            selectedGeoid={selectedGeoid}
            spotlightGeoid={spotlightGeoid}
            pin={pin}
            camera={camera}
            onSelect={selectTract}
          />
          <SearchBar
            tracts={data.tracts}
            note={searchNote}
            onTract={selectTract}
            onCounty={(county) => {
              const msa = data.tracts.find((tract) => tract.countyName === county)?.msaName ?? "all";
              setControls((current) => ({ ...current, msa, county }));
              frameRegion(msa, county);
            }}
            onMsa={(msa) => {
              setControls((current) => ({ ...current, msa, county: "all" }));
              frameRegion(msa, "all");
            }}
            onAddress={onAddress}
          />
          {spotlightGeoid ? (
            <button
              type="button"
              data-testid="clear-spotlight"
              className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2 rounded-full bg-[#14241c] px-4 py-2 text-sm font-medium text-[#f6f1e8] shadow-[0_8px_24px_rgb(20_24_32_/_28%)]"
              onClick={clearSpotlight}
            >
              Clear Selection / Show All Tracts
            </button>
          ) : null}
          <div className="absolute top-3 left-3 z-10 flex w-44 flex-col gap-1">
            {LAYERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setLayer(item.id)}
                className={`rounded-md px-2 py-1 text-left text-xs shadow ${
                  layer === item.id ? "bg-[#1a2a24] text-[#f6f1e8]" : "bg-white text-[#1c2430]"
                }`}
              >
                {item.label}
              </button>
            ))}
            {layer === "risk" ? (
              <div className="mt-1 flex flex-col gap-1 rounded-md bg-white p-1 text-[11px] shadow">
                {(
                  [
                    ["combined", "Combined"],
                    ["llc", "LLC share"],
                    ["pre1980", "Pre-1980"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`rounded px-1.5 py-0.5 text-left ${riskMode === id ? "bg-[#efeae0]" : ""}`}
                    onClick={() => setRiskMode(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="absolute bottom-8 left-3 z-10 max-w-[280px] rounded-lg bg-white/90 px-3 py-2 text-xs shadow">
            <p className="mb-1 font-medium">{paint.title}</p>
            <ul className="space-y-1">
              {paint.legend.map((item) => (
                <li key={`${item.label}-${item.color}`} className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-sm border border-[#e3d9cb]" style={{ background: item.color }} />
                  {item.label}
                </li>
              ))}
              {layer === "opportunity" ? (
                <li className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 border-2 border-[#14241c]" />
                  WRI outline
                </li>
              ) : null}
            </ul>
            <p className="mt-1 text-[10px] text-[#6d6256]">Faded tracts are outside the current filters.</p>
          </div>
        </div>
      </div>
      <section className="grid grid-cols-1 gap-4 p-4 2xl:grid-cols-2">
        <ScatterPlot rows={visibleRows} onSelect={selectTract} />
        <TractTable rows={visibleRows} selectedGeoid={selectedGeoid} onSelect={selectTract} />
      </section>
      {drawerOpen && selected && drawerLedger ? (
        <LedgerDrawer
          tract={selected}
          ledger={drawerLedger}
          controls={controls}
          addressLabel={outsideFilters ? `Hidden by the current filters. ${addressLabel ?? ""}`.trim() : addressLabel}
          priceText={priceText}
          onPriceText={setPriceText}
          onClose={() => setDrawerOpen(false)}
          onShowMap={() => {
            const bbox = data.bboxes.get(selected.geoid);
            if (bbox) setCamera({ token: ++token.current, kind: "bounds", bbox });
            mapAnchor.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />
      ) : null}
    </div>
  );
}

function Screen({ title, children }: { title: string; children: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#efeae0] px-6">
      <div className="max-w-lg text-center">
        <h1 className="font-serif text-3xl text-[#1a2a24]">{title}</h1>
        <p className="mt-2 text-[#5c564c]">{children}</p>
      </div>
    </div>
  );
}
