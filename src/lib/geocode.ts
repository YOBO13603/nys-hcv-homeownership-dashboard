import type { AddressHit } from "../types";

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    county?: string;
    state?: string;
    postcode?: string;
  };
};

type CensusMatch = {
  matchedAddress?: string;
  coordinates?: { x?: number; y?: number };
};

function isNewYork(state: string | undefined): boolean {
  const value = (state ?? "").trim().toLowerCase();
  return value === "new york" || value === "ny";
}

function withNewYork(query: string): string {
  return /\b(ny|new york)\b/i.test(query) ? query : `${query}, NY`;
}

async function photon(query: string, signal: AbortSignal): Promise<AddressHit[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", withNewYork(query));
  url.searchParams.set("lat", "42.8");
  url.searchParams.set("lon", "-75.5");
  url.searchParams.set("bbox", "-79.8,40.4,-71.8,45.1");
  url.searchParams.set("limit", "6");
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Photon returned ${response.status}`);
  const body = (await response.json()) as { features?: PhotonFeature[] };
  const hits: AddressHit[] = [];
  for (const feature of body.features ?? []) {
    const props = feature.properties ?? {};
    if (!isNewYork(props.state)) continue;
    const coords = feature.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    const street = [props.housenumber, props.street].filter(Boolean).join(" ");
    const label = street || props.name || "Address";
    const detail = [props.city, props.county, props.postcode].filter(Boolean).join(" · ");
    hits.push({
      id: `photon-${hits.length}-${label}`,
      label,
      detail,
      lon: coords[0],
      lat: coords[1],
      source: "photon",
    });
  }
  return hits.slice(0, 6);
}

async function census(query: string, signal: AbortSignal): Promise<AddressHit[]> {
  const address = withNewYork(query);
  const url = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
  url.searchParams.set("address", address);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Census geocoder returned ${response.status}`);
  const body = (await response.json()) as { result?: { addressMatches?: CensusMatch[] } };
  const hits: AddressHit[] = [];
  for (const match of body.result?.addressMatches ?? []) {
    const matched = match.matchedAddress ?? "";
    if (!/\bNY\b|New York/i.test(matched)) continue;
    const lon = match.coordinates?.x;
    const lat = match.coordinates?.y;
    if (lon == null || lat == null) continue;
    const parts = matched.split(",").map((part) => part.trim());
    hits.push({
      id: `census-${hits.length}-${matched}`,
      label: parts[0] || matched,
      detail: parts.slice(1).join(" · "),
      lon,
      lat,
      source: "census",
    });
  }
  return hits.slice(0, 6);
}

export async function geocodeAddress(query: string, signal: AbortSignal): Promise<AddressHit[]> {
  let photonFailed = false;
  try {
    const hits = await photon(query, signal);
    if (hits.length > 0) return hits;
  } catch (error) {
    if (signal.aborted) throw error;
    photonFailed = true;
  }
  try {
    return await census(query, signal);
  } catch (error) {
    if (signal.aborted) throw error;
    if (photonFailed) {
      throw new Error("Address search is unreachable. ZIP, tract, and county matches still work.");
    }
    return [];
  }
}
