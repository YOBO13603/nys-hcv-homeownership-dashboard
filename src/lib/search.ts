import type { LocalHit, Tract } from "../types";

const STREET_WORD = /\b(st|street|ave|avenue|pl|place|rd|road|blvd|boulevard|dr|drive)\b/i;

/** Street-style queries should list geocoder hits above local tract and ZIP shortcuts. */
export function prefersStreetResults(rawQuery: string): boolean {
  const query = rawQuery.trim();
  if (query.length < 3 || /^\d+$/.test(query)) return false;
  return STREET_WORD.test(query) || /\d/.test(query);
}

export function localMatches(tracts: Tract[], rawQuery: string): LocalHit[] {
  const query = rawQuery.trim().toLowerCase();
  if (query.length < 2) return [];
  const digits = query.replace(/\D/g, "");
  const ranked: { score: number; hit: LocalHit }[] = [];
  const countyCounts = new Map<string, number>();
  const msaCounts = new Map<string, number>();

  for (const tract of tracts) {
    countyCounts.set(tract.countyName, (countyCounts.get(tract.countyName) ?? 0) + 1);
    msaCounts.set(tract.msaName, (msaCounts.get(tract.msaName) ?? 0) + 1);
    let score = 0;
    if (digits.length >= 3 && tract.geoid.startsWith(digits)) score = 100;
    else if (digits.length >= 3 && tract.parentZip.startsWith(digits)) score = 92;
    else if (tract.tractLabel.toLowerCase().includes(query)) score = 74;
    else if (tract.countyName.toLowerCase().includes(query)) score = 62;
    else if (tract.msaName.toLowerCase().includes(query)) score = 48;
    if (score === 0) continue;
    ranked.push({
      score,
      hit: {
        kind: "tract",
        geoid: tract.geoid,
        title: tract.tractLabel,
        detail: `${tract.countyName} · ${tract.msaName} · ZIP ${tract.parentZip}`,
      },
    });
  }

  for (const [name, count] of countyCounts) {
    if (name.toLowerCase().includes(query)) {
      ranked.push({
        score: 84,
        hit: { kind: "county", title: name, detail: `${count.toLocaleString("en-US")} tracts` },
      });
    }
  }
  for (const [name, count] of msaCounts) {
    if (name.toLowerCase().includes(query)) {
      ranked.push({
        score: 80,
        hit: { kind: "msa", title: name, detail: `${count.toLocaleString("en-US")} tracts` },
      });
    }
  }

  ranked.sort((a, b) => b.score - a.score || a.hit.title.localeCompare(b.hit.title));
  const results: LocalHit[] = [];
  let tractCount = 0;
  const seen = new Set<string>();
  for (const item of ranked) {
    const key =
      item.hit.kind === "tract" ? item.hit.geoid : `${item.hit.kind}:${item.hit.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (item.hit.kind === "tract") {
      if (tractCount >= 8) continue;
      tractCount += 1;
    }
    results.push(item.hit);
    if (results.length >= 10) break;
  }
  return results;
}
