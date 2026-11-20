"""Filter local NY Census Tract boundaries to the HCV master-table GEOIDs.

Reads data/nys_hcv_master_table.csv (geoid kept as an 11-character string) and
the Census Tract boundary archive in data/ (.zip, .shp, .geojson, or .kml).
Keeps only those tracts, reprojects to EPSG:4326, lightly simplifies the
geometry, and writes public/data/nys_6msa_tracts.geojson.

No external boundary API is called. Run from the repo root:

    python scripts/prepare_boundaries.py
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

import geopandas as gpd
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
PUBLIC_DATA = ROOT / "public" / "data"
CSV_NAME = "nys_hcv_master_table.csv"
OUT_NAME = "nys_6msa_tracts.geojson"
EXPECTED_COUNT = 2104
SIMPLIFY_TOLERANCE = 0.0001
BOUNDARY_SUFFIXES = {".zip", ".shp", ".geojson", ".json", ".gpkg", ".kml"}
GEOID_COLUMNS = (
    "GEOID",
    "geoid",
    "GEOID20",
    "GEOID10",
    "GEOIDFQ",
)


def find_master_csv() -> Path:
    for path in (DATA_DIR / CSV_NAME, ROOT / CSV_NAME):
        if path.is_file():
            return path
    raise FileNotFoundError(
        f"Could not find {CSV_NAME} in {DATA_DIR} or {ROOT}"
    )


def find_boundary_files() -> list[Path]:
    """Locate local boundary archives, preferring Census Tract files."""
    found: list[Path] = []
    seen: set[Path] = set()
    search_dirs = [DATA_DIR, ROOT]
    for directory in search_dirs:
        if not directory.is_dir():
            continue
        for path in directory.iterdir():
            if not path.is_file() or path.suffix.lower() not in BOUNDARY_SUFFIXES:
                continue
            if path.name.lower() == OUT_NAME:
                continue
            resolved = path.resolve()
            if resolved in seen:
                continue
            seen.add(resolved)
            found.append(path)

    def rank(path: Path) -> tuple[int, str]:
        name = path.name.lower()
        if "tract" in name:
            kind = 0
        elif "cousub" in name or "county" in name:
            kind = 2
        else:
            kind = 1
        return (kind, name)

    found.sort(key=rank)
    return found


def normalize_geoid(series: pd.Series) -> pd.Series:
    text = series.astype("string").str.strip()
    text = text.str.replace(r"\.0+$", "", regex=True)
    text = text.str.replace(r"\D", "", regex=True)
    return text.str.zfill(11)


def load_target_geoids(csv_path: Path) -> set[str]:
    frame = pd.read_csv(
        csv_path,
        dtype={
            "geoid": "string",
            "county_fips": "string",
            "msa_code": "string",
            "parent_zip": "string",
        },
    )
    geoids = normalize_geoid(frame["geoid"])
    bad = geoids[geoids.str.len() != 11]
    if not bad.empty:
        raise SystemExit(f"{len(bad)} master geoids are not 11 characters")
    unique = set(geoids.tolist())
    if len(unique) != len(geoids):
        raise SystemExit(
            f"Master table geoids are not unique ({len(unique)} unique / {len(geoids)} rows)"
        )
    return unique


def geoid_column(frame: gpd.GeoDataFrame) -> str | None:
    lookup = {column.lower(): column for column in frame.columns}
    for name in GEOID_COLUMNS:
        if name in frame.columns:
            return name
        lowered = lookup.get(name.lower())
        if lowered:
            return lowered
    return None


def read_candidates(paths: list[Path], targets: set[str]) -> tuple[Path, gpd.GeoDataFrame]:
    best_path: Path | None = None
    best_frame: gpd.GeoDataFrame | None = None
    best_matched = -1
    print("Boundary scan:")
    for path in paths:
        try:
            frame = gpd.read_file(path)
        except Exception as exc:  # pyogrio raises several driver-specific errors
            print(f"  skip {path.name}: {exc}")
            continue
        column = geoid_column(frame)
        if column is None:
            print(f"  skip {path.name}: no GEOID column ({list(frame.columns)})")
            continue
        geoids = normalize_geoid(frame[column])
        matched = int(geoids.isin(targets).sum())
        print(
            f"  {path.name}: {matched} / {len(targets)} geoids overlap, "
            f"features={len(frame)}, crs={frame.crs}"
        )
        if matched > best_matched:
            best_matched = matched
            best_path = path
            best_frame = frame.copy()
            best_frame["geoid"] = geoids.to_numpy()
        if matched == len(targets):
            break

    if best_path is None or best_frame is None or best_matched <= 0:
        raise SystemExit(
            "No local boundary file contains the master-table tract GEOIDs. "
            "Place a NY Census Tract archive in data/ "
            "(for example cb_2023_36_tract_500k.zip)."
        )
    print(f"Using {best_path.name} ({best_matched} / {len(targets)} overlap)")
    return best_path, best_frame


def main() -> int:
    csv_path = find_master_csv()
    targets = load_target_geoids(csv_path)
    print(f"Master table: {csv_path} ({len(targets)} unique geoids)")

    boundaries = find_boundary_files()
    if not boundaries:
        raise SystemExit(f"No boundary file found in {DATA_DIR}")

    _, frame = read_candidates(boundaries, targets)
    selected = frame[frame["geoid"].isin(targets)].copy()
    selected = selected.drop_duplicates(subset="geoid")

    if selected.crs is None:
        selected = selected.set_crs(epsg=4326)
    else:
        selected = selected.to_crs(epsg=4326)

    selected["geometry"] = selected.geometry.simplify(
        SIMPLIFY_TOLERANCE,
        preserve_topology=True,
    )
    selected = selected[selected.geometry.notna() & ~selected.geometry.is_empty].copy()
    output = selected[["geoid", "geometry"]]

    matched = set(output["geoid"].tolist())
    missing = sorted(targets - matched)
    extra = sorted(matched - targets)
    print(
        f"Verification: {len(matched)} / {len(targets)} tracts matched, "
        f"{len(missing)} missing geometries"
    )
    if extra:
        print(f"Unexpected extra geoids: {len(extra)}")
    if missing or len(matched) != len(targets) or len(output) != EXPECTED_COUNT:
        preview = ", ".join(missing[:15])
        if preview:
            print(f"Missing geoids (first 15): {preview}")
        print("Exact match failed.")
        return 1

    PUBLIC_DATA.mkdir(parents=True, exist_ok=True)
    out_path = PUBLIC_DATA / OUT_NAME
    output.to_file(out_path, driver="GeoJSON")

    csv_dest = PUBLIC_DATA / CSV_NAME
    if csv_path.resolve() != csv_dest.resolve():
        shutil.copy2(csv_path, csv_dest)

    print(f"Wrote {out_path}")
    print(f"Copied {CSV_NAME} to {csv_dest}")
    print(f"Exact match: {len(output)} / {len(targets)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
