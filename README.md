# NYS HCV Homeownership Feasibility Dashboard

Policy screening map for Housing Choice Voucher homeownership across 2,104 Census tracts in six New York State metros.

**Live Dashboard:** https://nys-hcv-dashboard.netlify.app/

Netlify builds from `main`:

- Build command: `npm run build`
- Publish directory: `dist`

## Project layout

| Path | What it is |
| --- | --- |
| `src/` | React app: map, ledger, filters, scatterplot, and table |
| `public/data/nys_hcv_master_table.csv` | The only copy of the tract table. This is the file to edit. |
| `public/data/nys_6msa_tracts.geojson` | Tract boundaries joined to that table |
| `DATA_DICTIONARY.md` | Column definitions for the master table |
| `scripts/prepare_boundaries.py` | Rebuilds the GeoJSON from the master table and a local Census tract file in `data/` |
| `netlify.toml` | Build command and publish directory |

`geoid`, `county_fips`, and `parent_zip` are text identifiers. Do not let a spreadsheet turn them into numbers.

## Update the master table on GitHub

1. Open [public/data/nys_hcv_master_table.csv](https://github.com/YOBO13603/nys-hcv-homeownership-dashboard/blob/main/public/data/nys_hcv_master_table.csv).
2. Click the pencil (**Edit this file**). For a large replacement, choose **Upload files** and upload the new CSV into `public/data/` with the same filename.
3. Keep the header row and the 29 columns listed in `DATA_DICTIONARY.md`. The app expects 2,104 tracts and an 11-character `geoid` on every row.
4. Commit directly to `main`. Netlify rebuilds and publishes the site from that commit.
5. Do not add another copy of the CSV at the repo root or in `data/`.

## Update the data dictionary

1. Open [DATA_DICTIONARY.md](https://github.com/YOBO13603/nys-hcv-homeownership-dashboard/blob/main/DATA_DICTIONARY.md).
2. Click the pencil, edit the column notes, and commit to `main`.

A dictionary change does not by itself change the dashboard. If a column is added, renamed, or removed, update `src/lib/parseCsv.ts` in the same commit so the app still reads the table.

## Local preview

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:5173`. `npm run build` typechecks and writes `dist/`.
