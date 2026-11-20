import { useEffect, useRef } from "react";
import type { FeatureCollection } from "geojson";
import maplibregl, { type ExpressionSpecification, type Map } from "maplibre-gl";
import type { CameraRequest, TractCollection } from "../types";
import type { PaintSpec } from "../lib/scale";
import "maplibre-gl/dist/maplibre-gl.css";

const STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

type FeatureState = { id: string; metric: number; on: number; wri: number };

type MapViewProps = {
  geojson: TractCollection;
  states: FeatureState[];
  paint: PaintSpec;
  opportunity: boolean;
  selectedGeoid: string | null;
  spotlightGeoid: string | null;
  pin: { lon: number; lat: number; label: string } | null;
  camera: CameraRequest | null;
  onSelect: (geoid: string) => void;
};

function paintExpression(spec: PaintSpec): ExpressionSpecification {
  const metric = ["coalesce", ["feature-state", "metric"], 0] as ExpressionSpecification;
  if (spec.kind === "step") {
    return [
      "step",
      metric,
      spec.defaultColor,
      ...spec.stops.flatMap((stop) => [stop.at, stop.color]),
    ] as ExpressionSpecification;
  }
  if (spec.stops.length < 2) return (spec.stops[0]?.color ?? "#ddd") as unknown as ExpressionSpecification;
  return [
    "interpolate",
    ["linear"],
    metric,
    ...spec.stops.flatMap((stop) => [stop.value, stop.color]),
  ] as ExpressionSpecification;
}

export function MapView({
  geojson,
  states,
  paint,
  opportunity,
  selectedGeoid,
  spotlightGeoid,
  pin,
  camera,
  onSelect,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const readyRef = useRef(false);
  const selectRef = useRef(onSelect);
  const seenCamera = useRef(0);
  selectRef.current = onSelect;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;
    const map = new maplibregl.Map({
      container,
      style: STYLE,
      center: [-76.3, 42.15],
      zoom: 6.3,
      minZoom: 5.2,
      maxBounds: [
        [-80.6, 40.15],
        [-71.2, 45.35],
      ],
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("tracts", {
        type: "geojson",
        data: geojson as unknown as FeatureCollection,
        promoteId: "geoid",
      });
      const beforeLabels = map.getStyle().layers?.find((layer) => layer.type === "symbol")?.id;
      const addTractLayer = (layer: maplibregl.LayerSpecification) => {
        if (beforeLabels) map.addLayer(layer, beforeLabels);
        else map.addLayer(layer);
      };
      addTractLayer({
        id: "tract-fill",
        type: "fill",
        source: "tracts",
        paint: {
          "fill-color": "#d7c4a3",
          "fill-opacity": ["case", ["==", ["feature-state", "on"], 0], 0.05, 0.72],
        },
      });
      addTractLayer({
        id: "tract-line",
        type: "line",
        source: "tracts",
        paint: {
          "line-color": "#f4f1ea",
          "line-width": 0.45,
          "line-opacity": 0.9,
        },
      });
      addTractLayer({
        id: "tract-glow",
        type: "line",
        source: "tracts",
        filter: ["==", ["get", "geoid"], ""],
        paint: {
          "line-color": "#0c1612",
          "line-width": 16,
          "line-blur": 5,
          "line-opacity": 0,
        },
      });
      addTractLayer({
        id: "tract-highlight",
        type: "line",
        source: "tracts",
        filter: ["==", ["get", "geoid"], ""],
        paint: {
          "line-color": "#14241c",
          "line-width": 2.6,
        },
      });
      map.on("click", "tract-fill", (event) => {
        const geoid = event.features?.[0]?.properties?.geoid;
        if (typeof geoid === "string" && geoid.length > 0) selectRef.current(geoid);
      });
      map.on("mouseenter", "tract-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "tract-fill", () => {
        map.getCanvas().style.cursor = "";
      });
      readyRef.current = true;
      map.resize();
    });

    return () => {
      readyRef.current = false;
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [geojson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (!readyRef.current) return;
      for (const state of states) {
        map.setFeatureState(
          { source: "tracts", id: state.id },
          { metric: state.metric, on: state.on, wri: state.wri },
        );
      }
      map.setPaintProperty("tract-fill", "fill-color", paintExpression(paint));
      const hidden = ["==", ["feature-state", "on"], 0] as ExpressionSpecification;
      map.setPaintProperty("tract-line", "line-color", [
        "case",
        hidden,
        "#c9c3b8",
        opportunity ? ["case", ["==", ["feature-state", "wri"], 1], "#1a2a24", "#f7f4ee"] : "#f7f4ee",
      ] as ExpressionSpecification);
      map.setPaintProperty("tract-line", "line-width", [
        "case",
        hidden,
        0.45,
        opportunity ? ["case", ["==", ["feature-state", "wri"], 1], 0.7, 0.35] : 0.4,
      ] as ExpressionSpecification);
      map.setPaintProperty("tract-line", "line-opacity", [
        "case",
        hidden,
        0.8,
        0.9,
      ] as ExpressionSpecification);
    };
    if (readyRef.current) apply();
    else map.once("idle", apply);
  }, [states, paint, opportunity]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (!map.getLayer("tract-highlight") || !map.getLayer("tract-glow")) return;
      const outlineId = spotlightGeoid ?? selectedGeoid ?? "";
      map.setFilter("tract-highlight", ["==", ["get", "geoid"], outlineId]);
      map.setFilter("tract-glow", ["==", ["get", "geoid"], spotlightGeoid ?? ""]);
      map.setPaintProperty("tract-glow", "line-opacity", spotlightGeoid ? 0.7 : 0);
      map.setPaintProperty("tract-highlight", "line-width", spotlightGeoid ? 4.5 : 2.6);
      map.setPaintProperty("tract-highlight", "line-color", spotlightGeoid ? "#0c1612" : "#14241c");
      map.setPaintProperty(
        "tract-fill",
        "fill-opacity",
        spotlightGeoid
          ? (["case", ["==", ["get", "geoid"], spotlightGeoid], 0.96, 0.12] as ExpressionSpecification)
          : (["case", ["==", ["feature-state", "on"], 0], 0.05, 0.72] as ExpressionSpecification),
      );
    };
    if (readyRef.current) apply();
    else map.once("idle", apply);
  }, [selectedGeoid, spotlightGeoid]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !camera || camera.token === seenCamera.current) return;
    const run = () => {
      if (!readyRef.current) return;
      seenCamera.current = camera.token;
      if (camera.kind === "point") {
        map.flyTo({ center: [camera.lon, camera.lat], zoom: camera.zoom, essential: true });
      } else {
        map.fitBounds(
          [
            [camera.bbox[0], camera.bbox[1]],
            [camera.bbox[2], camera.bbox[3]],
          ],
          { padding: 48, maxZoom: 12.5, duration: 900 },
        );
      }
    };
    if (readyRef.current) run();
    else map.once("idle", run);
  }, [camera]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const sync = () => {
      markerRef.current?.remove();
      markerRef.current = null;
      if (!pin) return;
      const element = document.createElement("div");
      element.className = "spot-pin";
      const halo = document.createElement("span");
      halo.className = "spot-halo";
      const halo2 = document.createElement("span");
      halo2.className = "spot-halo-2";
      const dot = document.createElement("span");
      dot.className = "spot-dot";
      const tip = document.createElement("span");
      tip.className = "spot-label";
      tip.textContent = pin.label;
      element.append(halo, halo2, dot, tip);
      markerRef.current = new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat([pin.lon, pin.lat])
        .addTo(map);
    };
    if (readyRef.current) sync();
    else map.once("idle", sync);
  }, [pin]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
