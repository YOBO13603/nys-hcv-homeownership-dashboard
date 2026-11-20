import { useMemo, useState } from "react";
import type { ScoredTract } from "../types";
import { integer, money0, sharePercent } from "../lib/format";

type SortKey = "label" | "county" | "msa" | "zip" | "price" | "gap" | "cash" | "status" | "wri" | "nri" | "ami" | "llc" | "old" | "listings";

const PAGE = 25;

export function TractTable({
  rows,
  selectedGeoid,
  onSelect,
}: {
  rows: ScoredTract[];
  selectedGeoid: string | null;
  onSelect: (geoid: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("gap");
  const [ascending, setAscending] = useState(true);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = needle
      ? rows.filter((row) => {
          const tract = row.tract;
          return (
            tract.tractLabel.toLowerCase().includes(needle) ||
            tract.countyName.toLowerCase().includes(needle) ||
            tract.msaName.toLowerCase().includes(needle) ||
            tract.parentZip.includes(needle) ||
            tract.geoid.includes(needle)
          );
        })
      : rows;
    const sorted = [...matched].sort((a, b) => compare(a, b, sortKey) * (ascending ? 1 : -1));
    return sorted;
  }, [rows, query, sortKey, ascending]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, pages - 1);
  const visible = filtered.slice(safePage * PAGE, safePage * PAGE + PAGE);

  function sortBy(key: SortKey) {
    if (key === sortKey) setAscending((value) => !value);
    else {
      setSortKey(key);
      setAscending(key === "label" || key === "county" || key === "msa" || key === "zip");
    }
    setPage(0);
  }

  return (
    <section className="rounded-xl border border-[#e3d9cb] bg-white p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl text-[#1a2a24]">Tract table</h2>
          <p className="text-sm text-[#5c564c]">{integer(filtered.length)} tracts after sidebar filters and this search.</p>
        </div>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Search tract, county, ZIP, GEOID"
            className="w-64 rounded-md border border-[#e3d9cb] px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            className="rounded-md bg-[#1a2a24] px-3 py-1.5 text-sm text-[#f6f1e8]"
            onClick={() => downloadCsv(filtered)}
          >
            Export CSV
          </button>
        </div>
      </div>
      <div className="overflow-auto">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead className="text-[11px] tracking-wide text-[#6d6256] uppercase">
            <tr>
              <Th label="Tract" k="label" sortKey={sortKey} ascending={ascending} onSort={sortBy} />
              <Th label="County" k="county" sortKey={sortKey} ascending={ascending} onSort={sortBy} />
              <Th label="Metro" k="msa" sortKey={sortKey} ascending={ascending} onSort={sortBy} />
              <Th label="ZIP" k="zip" sortKey={sortKey} ascending={ascending} onSort={sortBy} />
              <Th label="Price" k="price" sortKey={sortKey} ascending={ascending} onSort={sortBy} />
              <Th label="Monthly gap" k="gap" sortKey={sortKey} ascending={ascending} onSort={sortBy} />
              <Th label="Net cash" k="cash" sortKey={sortKey} ascending={ascending} onSort={sortBy} />
              <Th label="Feasible" k="status" sortKey={sortKey} ascending={ascending} onSort={sortBy} />
              <Th label="WRI" k="wri" sortKey={sortKey} ascending={ascending} onSort={sortBy} />
              <Th label="NRI" k="nri" sortKey={sortKey} ascending={ascending} onSort={sortBy} />
              <Th label="AMI" k="ami" sortKey={sortKey} ascending={ascending} onSort={sortBy} />
              <Th label="LLC" k="llc" sortKey={sortKey} ascending={ascending} onSort={sortBy} />
              <Th label="Pre-1980" k="old" sortKey={sortKey} ascending={ascending} onSort={sortBy} />
              <Th label="Listings" k="listings" sortKey={sortKey} ascending={ascending} onSort={sortBy} />
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const selected = row.tract.geoid === selectedGeoid;
              const status = row.ledger.fullyFeasible ? "Full" : row.ledger.monthlyFeasible ? "Monthly" : "Gap";
              return (
                <tr
                  key={row.tract.geoid}
                  className={`cursor-pointer border-t border-[#f0e8dc] ${selected ? "bg-[#f3eee4]" : "hover:bg-[#faf7f2]"}`}
                  onClick={() => onSelect(row.tract.geoid)}
                >
                  <td className="py-1.5 pr-3">
                    <div>{row.tract.tractLabel}</div>
                    <div className="font-mono text-[11px] text-[#6d6256]">{row.tract.geoid}</div>
                  </td>
                  <td className="pr-3">{row.tract.countyName.replace(" County", "")}</td>
                  <td className="pr-3">{row.tract.msaName}</td>
                  <td className="pr-3 tabular-nums">{row.tract.parentZip}</td>
                  <td className="pr-3 tabular-nums">{money0(row.ledger.price)}</td>
                  <td className={`pr-3 tabular-nums ${row.ledger.monthlyGap <= 0 ? "text-[#0e6b45]" : "text-[#9d1c1c]"}`}>
                    {money0(row.ledger.monthlyGap)}
                  </td>
                  <td className="pr-3 tabular-nums">{money0(row.ledger.netCashGap)}</td>
                  <td className="pr-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        status === "Full"
                          ? "bg-[#e5f4ec] text-[#0e6b45]"
                          : status === "Monthly"
                            ? "bg-[#fbf3df] text-[#7a5620]"
                            : "bg-[#fdecea] text-[#9d1c1c]"
                      }`}
                    >
                      {status}
                    </span>
                  </td>
                  <td className="pr-3">{row.tract.wri ? "Yes" : "No"}</td>
                  <td className="pr-3 tabular-nums">{row.tract.nriQuintile}</td>
                  <td className="pr-3 tabular-nums">{sharePercent(row.tract.tractAmiPct / 100, 0)}</td>
                  <td className="pr-3 tabular-nums">{sharePercent(row.tract.llcOwnershipPct, 0)}</td>
                  <td className="pr-3 tabular-nums">{sharePercent(row.tract.acsPre1980Pct, 0)}</td>
                  <td className="tabular-nums">{integer(row.tract.activeListingsZip)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-[#5c564c]">
        <span>
          {filtered.length === 0
            ? "No rows"
            : `${safePage * PAGE + 1}–${Math.min(filtered.length, safePage * PAGE + PAGE)} of ${integer(filtered.length)}`}
        </span>
        <div className="flex gap-2">
          <button type="button" className="rounded border border-[#e3d9cb] px-2 py-1" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
            Previous
          </button>
          <button
            type="button"
            className="rounded border border-[#e3d9cb] px-2 py-1"
            disabled={safePage >= pages - 1}
            onClick={() => setPage(safePage + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

function Th({
  label,
  k,
  sortKey,
  ascending,
  onSort,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  ascending: boolean;
  onSort: (key: SortKey) => void;
}) {
  const mark = sortKey === k ? (ascending ? " ↑" : " ↓") : "";
  return (
    <th className="pr-3 pb-2 font-medium">
      <button type="button" className="text-left" onClick={() => onSort(k)}>
        {label}
        {mark}
      </button>
    </th>
  );
}

function statusRank(row: ScoredTract): number {
  if (row.ledger.fullyFeasible) return 2;
  if (row.ledger.monthlyFeasible) return 1;
  return 0;
}

function compare(a: ScoredTract, b: ScoredTract, key: SortKey): number {
  const tract = a.tract;
  const other = b.tract;
  switch (key) {
    case "label":
      return tract.tractLabel.localeCompare(other.tractLabel);
    case "county":
      return tract.countyName.localeCompare(other.countyName);
    case "msa":
      return tract.msaName.localeCompare(other.msaName);
    case "zip":
      return tract.parentZip.localeCompare(other.parentZip);
    case "price":
      return a.ledger.price - b.ledger.price;
    case "gap":
      return a.ledger.monthlyGap - b.ledger.monthlyGap;
    case "cash":
      return a.ledger.netCashGap - b.ledger.netCashGap;
    case "status":
      return statusRank(a) - statusRank(b);
    case "wri":
      return Number(tract.wri) - Number(other.wri);
    case "nri":
      return tract.nriQuintile - other.nriQuintile;
    case "ami":
      return tract.tractAmiPct - other.tractAmiPct;
    case "llc":
      return tract.llcOwnershipPct - other.llcOwnershipPct;
    case "old":
      return tract.acsPre1980Pct - other.acsPre1980Pct;
    case "listings":
      return tract.activeListingsZip - other.activeListingsZip;
    default:
      return 0;
  }
}

function excelText(value: string): string {
  return `"=""${value}"""`;
}

function downloadCsv(rows: ScoredTract[]) {
  const header = [
    "geoid",
    "county_fips",
    "parent_zip",
    "tract_label",
    "county_name",
    "msa_name",
    "price",
    "monthly_gap",
    "net_cash_gap",
    "monthly_feasible",
    "fully_feasible",
    "wri",
    "nri_quintile",
    "tract_ami_pct",
    "llc_ownership_pct",
    "acs_pre1980_pct",
    "active_listings_zip",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    const tract = row.tract;
    lines.push(
      [
        excelText(tract.geoid),
        excelText(tract.countyFips),
        excelText(tract.parentZip),
        csvText(tract.tractLabel),
        csvText(tract.countyName),
        csvText(tract.msaName),
        row.ledger.price.toFixed(2),
        row.ledger.monthlyGap.toFixed(2),
        row.ledger.netCashGap.toFixed(2),
        row.ledger.monthlyFeasible ? "Yes" : "No",
        row.ledger.fullyFeasible ? "Yes" : "No",
        tract.wri ? "Yes" : "No",
        String(tract.nriQuintile),
        tract.tractAmiPct.toFixed(2),
        tract.llcOwnershipPct.toFixed(4),
        tract.acsPre1980Pct.toFixed(4),
        String(tract.activeListingsZip),
      ].join(","),
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "nys_hcv_tracts.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function csvText(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
