import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { AddressHit, LocalHit, Tract } from "../types";
import { geocodeAddress } from "../lib/geocode";
import { localMatches, prefersStreetResults } from "../lib/search";

type SearchBarProps = {
  tracts: Tract[];
  note: string | null;
  onTract: (geoid: string) => void;
  onCounty: (county: string) => void;
  onMsa: (msa: string) => void;
  onAddress: (hit: AddressHit) => void;
};

export function SearchBar({ tracts, note, onTract, onCounty, onMsa, onAddress }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [addresses, setAddresses] = useState<AddressHit[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  const local = useMemo(() => localMatches(tracts, query), [tracts, query]);
  const streetFirst = prefersStreetResults(query);
  const showRemote = query.trim().length >= 3 && !/^\d+$/.test(query.trim());
  const rows = useMemo(() => {
    const localRows = local.map((hit) => ({ kind: "local" as const, hit }));
    const addressRows = showRemote ? addresses.map((hit) => ({ kind: "address" as const, hit })) : [];
    return streetFirst ? [...addressRows, ...localRows] : [...localRows, ...addressRows];
  }, [local, addresses, showRemote, streetFirst]);

  useEffect(() => {
    setActive(0);
  }, [query, addresses]);

  useEffect(() => {
    if (!showRemote) {
      setAddresses([]);
      setStatus("idle");
      setError(null);
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    const timer = window.setTimeout(() => {
      geocodeAddress(query.trim(), controller.signal)
        .then((hits) => {
          setAddresses(hits);
          setStatus("done");
          setError(null);
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setAddresses([]);
          setStatus("error");
          setError(reason instanceof Error ? reason.message : "Address search failed");
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, showRemote]);

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function choose(index: number) {
    const row = rows[index];
    if (!row) return;
    if (row.kind === "address") onAddress(row.hit);
    else if (row.hit.kind === "tract") onTract(row.hit.geoid);
    else if (row.hit.kind === "county") onCounty(row.hit.title);
    else onMsa(row.hit.title);
    setOpen(false);
  }

  function onKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(rows.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Enter" && open && rows.length > 0) {
      event.preventDefault();
      choose(active);
    }
  }

  return (
    <div ref={wrapRef} className="absolute top-3 left-1/2 z-20 w-[min(560px,calc(100%-18rem))] -translate-x-1/2">
      <label className="sr-only" htmlFor="place-search">
        Address, ZIP, or tract search
      </label>
      <div className="flex items-center gap-2 rounded-full border border-[#e4d9c8] bg-white/95 px-4 py-2.5 shadow-[0_10px_30px_rgb(28_36_48_/_12%)]">
        <span aria-hidden className="text-[#6d6256]">
          ⌕
        </span>
        <input
          id="place-search"
          data-testid="search"
          value={query}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder="Address, ZIP, tract, or county"
          className="w-full bg-transparent text-[15px] outline-none placeholder:text-[#8a7f72]"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
        />
        {query ? (
          <button
            type="button"
            className="text-sm text-[#6d6256]"
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
          >
            Clear
          </button>
        ) : null}
      </div>
      {open && query.trim().length >= 2 ? (
        <div
          id={listId}
          role="listbox"
          className="mt-2 max-h-80 overflow-auto rounded-2xl border border-[#e4d9c8] bg-white shadow-xl"
        >
          {streetFirst ? (
            <AddressSection
              rows={rows}
              active={active}
              status={status}
              error={error}
              showRemote={showRemote}
              onActive={setActive}
              onChoose={choose}
            />
          ) : null}
          {local.length > 0 ? (
            <SectionLabel>{streetFirst ? "Tract / ZIP shortcuts" : "Tracts, ZIPs, and counties"}</SectionLabel>
          ) : null}
          {rows.map((row, index) =>
            row.kind === "local" ? (
              <ResultButton
                key={row.hit.kind === "tract" ? row.hit.geoid : `${row.hit.kind}-${row.hit.title}`}
                active={index === active}
                title={row.hit.title}
                detail={row.hit.detail}
                kicker={kicker(row.hit)}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(index)}
              />
            ) : null,
          )}
          {streetFirst ? null : (
            <AddressSection
              rows={rows}
              active={active}
              status={status}
              error={error}
              showRemote={showRemote}
              onActive={setActive}
              onChoose={choose}
            />
          )}
          {local.length === 0 && !showRemote ? (
            <p className="px-4 py-3 text-sm text-[#6d6256]">No ZIP, tract, or county match.</p>
          ) : null}
        </div>
      ) : null}
      {note ? (
        <p className="mt-2 rounded-xl bg-[#fff8f2] px-3 py-2 text-sm text-[#9d1c1c] shadow">{note}</p>
      ) : null}
    </div>
  );
}

function AddressSection({
  rows,
  active,
  status,
  error,
  showRemote,
  onActive,
  onChoose,
}: {
  rows: Array<{ kind: "local"; hit: LocalHit } | { kind: "address"; hit: AddressHit }>;
  active: number;
  status: "idle" | "loading" | "done" | "error";
  error: string | null;
  showRemote: boolean;
  onActive: (index: number) => void;
  onChoose: (index: number) => void;
}) {
  if (!showRemote) return null;
  const addressCount = rows.filter((row) => row.kind === "address").length;
  return (
    <>
      <SectionLabel>Street addresses</SectionLabel>
      {status === "loading" ? <p className="px-4 py-2 text-sm text-[#6d6256]">Looking up addresses…</p> : null}
      {status === "error" ? <p className="px-4 py-2 text-sm text-[#9d1c1c]">{error}</p> : null}
      {status === "done" && addressCount === 0 ? (
        <p className="px-4 py-2 text-sm text-[#6d6256]">No New York address match.</p>
      ) : null}
      {rows.map((row, index) =>
        row.kind === "address" ? (
          <ResultButton
            key={row.hit.id}
            active={index === active}
            title={row.hit.label}
            detail={row.hit.detail}
            kicker={row.hit.source === "photon" ? "Address" : "Census"}
            onMouseEnter={() => onActive(index)}
            onClick={() => onChoose(index)}
          />
        ) : null,
      )}
    </>
  );
}

function kicker(hit: LocalHit): string {
  if (hit.kind === "tract") return "Tract";
  if (hit.kind === "county") return "County";
  return "Metro";
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="px-4 pt-3 pb-1 text-[11px] tracking-[0.14em] text-[#8a7f72] uppercase">
      {children}
    </p>
  );
}

function ResultButton({
  active,
  title,
  detail,
  kicker: label,
  onClick,
  onMouseEnter,
}: {
  active: boolean;
  title: string;
  detail: string;
  kicker: string;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      className={`flex w-full items-start justify-between gap-3 px-4 py-2 text-left ${active ? "bg-[#f3eee4]" : "bg-white"}`}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      <span>
        <span className="block text-sm text-[#1c2430]">{title}</span>
        <span className="block text-xs text-[#6d6256]">{detail}</span>
      </span>
      <span className="pt-0.5 text-[10px] tracking-wide text-[#8a7f72] uppercase">{label}</span>
    </button>
  );
}
