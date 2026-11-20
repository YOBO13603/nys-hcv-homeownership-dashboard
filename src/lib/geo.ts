import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import type { BBox, GeoFeature, TractSpatial } from "../types";

export function geometryBBox(geometry: GeoFeature["geometry"]): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const walk = (coords: unknown): void => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      const x = coords[0];
      const y = coords[1];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      return;
    }
    for (const child of coords) walk(child);
  };
  walk(geometry.coordinates);
  return [minX, minY, maxX, maxY];
}

export function unionBBox(boxes: BBox[]): BBox | null {
  if (boxes.length === 0) return null;
  return boxes.reduce<BBox>(
    (acc, box) => [
      Math.min(acc[0], box[0]),
      Math.min(acc[1], box[1]),
      Math.max(acc[2], box[2]),
      Math.max(acc[3], box[3]),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
}

export function locateTract(index: TractSpatial[], lon: number, lat: number): string | null {
  const probe = point([lon, lat]);
  for (const item of index) {
    const [minX, minY, maxX, maxY] = item.bbox;
    if (lon < minX || lon > maxX || lat < minY || lat > maxY) continue;
    if (booleanPointInPolygon(probe, item.feature as never)) return item.geoid;
  }
  return null;
}
