import type { BBox, GeoFeature, Tract, TractCollection, TractSpatial } from "../types";
import { geometryBBox } from "./geo";
import { parseMasterTable } from "./parseCsv";

export type Dataset = {
  tracts: Tract[];
  byGeoid: Map<string, Tract>;
  geojson: TractCollection;
  index: TractSpatial[];
  bboxes: Map<string, BBox>;
};

function padGeoid(value: unknown): string {
  const text = String(value ?? "")
    .trim()
    .replace(/\.0+$/, "")
    .replace(/\D/g, "");
  return text.padStart(11, "0");
}

export async function loadDataset(): Promise<Dataset> {
  const [csvResponse, geoResponse] = await Promise.all([
    fetch("/data/nys_hcv_master_table.csv"),
    fetch("/data/nys_6msa_tracts.geojson"),
  ]);
  if (!csvResponse.ok) throw new Error(`Could not load master table (${csvResponse.status})`);
  if (!geoResponse.ok) throw new Error(`Could not load tract boundaries (${geoResponse.status})`);

  const tracts = parseMasterTable(await csvResponse.text());
  const geojson = (await geoResponse.json()) as TractCollection;
  const byGeoid = new Map(tracts.map((tract) => [tract.geoid, tract]));
  const index: TractSpatial[] = [];
  const bboxes = new Map<string, BBox>();
  const boundaryIds = new Set<string>();

  for (const feature of geojson.features) {
    const geoid = padGeoid(feature.properties?.geoid);
    feature.properties = { geoid };
    if (!byGeoid.has(geoid)) {
      throw new Error(`Boundary geoid ${geoid} is not in the master table`);
    }
    boundaryIds.add(geoid);
    const bbox = geometryBBox(feature.geometry);
    bboxes.set(geoid, bbox);
    index.push({ geoid, bbox, feature: feature as GeoFeature });
  }

  const missing = tracts.filter((tract) => !boundaryIds.has(tract.geoid)).map((tract) => tract.geoid);
  if (missing.length > 0 || boundaryIds.size !== tracts.length) {
    throw new Error(
      `Join failed: ${boundaryIds.size} / ${tracts.length} tracts matched, ${missing.length} missing geometries`,
    );
  }

  return { tracts, byGeoid, geojson, index, bboxes };
}
