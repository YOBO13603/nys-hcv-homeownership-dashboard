# NYS HCV Homeownership Feasibility Dashboard — Technical & Product Specification

Build a complete, interactive, policy-grade **New York State HCV (Housing Choice Voucher) Homeownership Feasibility Dashboard** powered by `data/nys_hcv_master_table.csv` (2,104 Census Tracts across 20 NYS counties in 6 MSAs) and the local NY Census Tract boundary file placed in `data/`.

First, inspect the existing repository structure so we integrate cleanly with the current stack (or scaffold a modern React + Vite/Next.js + Tailwind CSS + MapLibre GL JS + Turf.js + Recharts web app if starting fresh).

---

### 1. Local Data Loading & Boundary Preprocessing (Zero External Boundary APIs)
1. **Master Table (`data/nys_hcv_master_table.csv`)**:
   - Load `geoid` (11-char string), `county_fips` (5-char string), `msa_code`, and `parent_zip` (5-char string) strictly as **strings** to preserve leading zeros.
   - Exact columns in CSV (29 columns, 0 missing values):
     - IDs & Geography: `geoid`, `county_fips`, `msa_code`, `msa_name`, `county_name`, `tract_label`, `parent_zip`
     - Home Values & Closing: `median_home_value`, `p25_home_value`, `est_hmda_loan_costs`, `hmda_sample_count`, `is_imputed`, `county_mrt_rate`
     - Carrying Cost Inputs: `eff_property_tax_rate`, `annual_home_insurance`, `monthly_utilities_est`
     - Policy & Opportunity: `tract_ami_pct`, `wri` (`"Yes"` / `"No"`), `nri_quintile` (`1`–`5`), `local_dpa_cap`, `ps_1br`, `ps_2br`, `ps_3br`, `ps_4br`
     - Secondary Market Reality Check: `acs_pre1980_pct`, `acs_pre1940_pct`, `acs_substandard_pct`, `llc_ownership_pct`, `active_listings_zip`
2. **Local Census Tract Boundary Conversion (`data/*.zip` / `.shp` / `.geojson`)**:
   - Do NOT call any external TIGERweb boundary API. Instead, create and run a local preprocessing script (`scripts/prepare_boundaries.py` using `geopandas` or `pyshp`/`shapely`) that automatically locates the NY Census Tract boundary archive/file in `data/` (e.g., `data/cb_2023_36_tract_500k.zip`, `data/tl_2023_36_tract.zip`, or extracted `.shp`/`.geojson`).
   - Normalize its 11-character `GEOID` string, filter strictly to the exact **2,104 `geoid`s** present in `data/nys_hcv_master_table.csv` (automatically dropping NYC, non-target counties, and water tracts), reproject coordinates to WGS84 (`EPSG:4326`), simplify geometry lightly (`tolerance=0.0001`, preserving topology) for fast browser rendering, and save to `public/data/nys_6msa_tracts.geojson` (also copy `nys_hcv_master_table.csv` to `public/data/` if needed for client-side loading).
   - Print a verification check confirming `2,104 / 2,104` tracts matched cleanly with `0` missing geometries.

---

### 2. Google-Maps-Style Address & Keyword Autocomplete + Spatial Tract Lookup
Place a prominent **Address, ZIP, or Tract Search Bar** floating at the top of the interactive map:
1. **Hybrid Instant Autocomplete (Resilient Online + Offline)**:
   - **Local Instant Match (always works offline)**: Immediately filter matching `parent_zip`, `tract_label`, `county_name`, and `geoid` from the loaded dataset as the user types.
   - **Street-Level Address Autocomplete**: With a 300ms debounce, query the free, keyless **Photon Geocoding API** (`https://photon.komoot.io/api/?q={query}&lat=42.8&lon=-75.5&bbox=-79.8,40.4,-71.8,45.1&limit=6`) filtered to `state == "New York"` (with graceful fallback to US Census Geocoder `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress` if Photon is unreachable).
2. **Dropdown Suggestions**: Display clean Google-Maps-style dropdown items showing street address (or ZIP/Tract), city, county, and ZIP code.
3. **Fly-To & Point-in-Polygon Tract Selection**:
   - When the user selects an address suggestion, smoothly fly/zoom the map to `[lon, lat]` (zoom `13.5`) and drop a distinct location pin marker.
   - Use `@turf/boolean-point-in-polygon` against the loaded Census Tract GeoJSON polygons to immediately identify the containing 11-digit `geoid`.
   - Highlight that tract on the map and automatically slide open the **Itemized Gap Ledger Drawer** on the right.

---

### 3. Reactive Financial & Policy Calculation Engine
Compute both **Upfront Cash-to-Close** and **Monthly Carrying Cost vs. Voucher Coverage** dynamically across all 2,104 tracts whenever any sidebar control changes:
- **Selected Home Price (`P`)**: `median_home_value` OR `p25_home_value` (user toggle). In the right-hand Tract Drawer, also provide an interactive **"Custom Asking Price Override ($)"** input so housing counselors can plug in a real MLS/Zillow listing price for a searched address.
- **Ledger A — Upfront Cash-to-Close**:
  1. `down_payment = P * 0.035` (3.5% FHA minimum down payment)
  2. `base_loan = P * 0.965`
  3. `mrt_cost = base_loan * county_mrt_rate` (NY Mortgage Recording Tax: `1.05%` MCTD / `0.75%` Upstate)
  4. `inspection_fee = acs_pre1940_pct > 0.30 ? 550 : 400` (`$150` lead-paint inspection surcharge triggered when >30% of tract housing was built pre-1940)
  5. `gross_upfront_cash = down_payment + est_hmda_loan_costs + mrt_cost + inspection_fee`
  6. `applied_dpa`: Supports 3 modes:
     - **County Local Default** (`local_dpa_cap` from CSV)
     - **NYS SONYMA DPAL** (`min(15000, P * 0.03)`)
     - **Custom DPA Slider** (`$0` – `$50,000`)
  7. `net_cash_gap = max(0, gross_upfront_cash - applied_dpa)`
- **Ledger B — Monthly Carrying Cost vs. HCV Subsidy**:
  1. `total_fha_loan = base_loan * 1.0175` (includes 1.75% FHA Upfront MIP)
  2. `monthly_pi`: Standard 30-year fixed monthly P&I on `total_fha_loan` at interest rate `r` (default `6.5%`, slider `5.0%`–`8.5%`)
  3. `monthly_tax = (P * eff_property_tax_rate) / 12`
  4. `monthly_ins = annual_home_insurance / 12`
  5. `monthly_mip = (base_loan * 0.0055) / 12` (0.55% annual FHA MIP)
  6. `total_monthly_cost = monthly_pi + monthly_tax + monthly_ins + monthly_mip + monthly_utilities_est`
  7. `effective_payment_standard = ps_{selected_br} * (ps_pct / 100)` (`selected_br` in `1BR`–`4BR`, default `2BR`; `ps_pct` slider `90%`–`110%`, default `100%`)
  8. `family_contribution`: Optional toggle/slider for household monthly contribution (default `$0` to evaluate pure voucher coverage, or `30%` of monthly household income at user-adjustable household AMI % `30%`–`80%`)
  9. `monthly_gap = total_monthly_cost - (effective_payment_standard + family_contribution)`
- **Feasibility Classification**:
  - **Monthly Feasible**: `monthly_gap <= 0`
  - **Fully Feasible (Monthly + Cash)**: `monthly_gap <= 0` AND `net_cash_gap <= buyer_cash_savings` (default `$3,000`, slider `$0`–`$15,000`)

---

### 4. UI Architecture & Interactive Components
1. **Left Policy & Reality Filter Sidebar**:
   - **Region & County**: All 6 MSAs or zoom to `Buffalo`, `Hudson Valley`, `Ithaca`, `Long Island`, `Rochester`, `Syracuse` + County dropdown.
   - **Price & Voucher Levers**: Price Tier (`Median` vs `25th Percentile`), Bedroom Size (`1-BR` to `4-BR`), Payment Standard % (`90%–110%`), Interest Rate (`5.0%–8.5%`), DPA Mode & Slider, Buyer Cash Savings (`$0–$15,000`), Family Contribution toggle.
   - **High-Opportunity Filters**: Toggle `Well-Resourced Area (WRI = Yes) Only` + `NRI Quintile` range (`1`–`5`).
   - **Secondary Market "Reality Check" Sliders**: Max LLC Ownership % (`0%–100%`), Max Pre-1980 Housing % (`0%–100%`), Min Active ZIP Listings (`0–100+`).
2. **Top Executive KPI Strip** (live reactive):
   - **Monthly Feasible Tracts** (count & `%`)
   - **Fully Feasible Tracts (Monthly + Cash)** (count & `%`)
   - **High-Opportunity (`WRI = Yes`) Feasible Tracts** (count)
   - **Median Net Cash-to-Close** (`$`) & **Median Monthly Gap/Surplus** (`$/mo`)
3. **Interactive Choropleth Map + Right-Hand Itemized Gap Ledger Drawer**:
   - Switchable map layers: (1) Monthly Affordability Gap (`$/mo`, green = surplus/covered, red = gap), (2) Net Cash-to-Close (`$`), (3) Opportunity Tier (`WRI` & `NRI Quintile 1–5`), (4) Tract AMI (`%`), (5) Investor & Aging Housing Risk (`llc_ownership_pct` / `acs_pre1980_pct`).
   - **Click-to-Inspect / Address-Matched Slide-Over Drawer**:
     - Displays the Tract/Address header, `WRI` & `NRI Quintile` badges, `tract_ami_pct`, and an interactive **"Custom Asking Price Override ($)"** input box.
     - Renders **both complete itemized financial ledgers** (every single line item listed in Section 3 with dollar amounts, subtotals, applied DPA/voucher deductions, and final green/red gap callouts) so users see the exact math behind every dollar.
     - Renders a **"Market Reality Check" Card** showing: Pre-1980 & Pre-1940 stock %, `$550` Lead Inspection trigger badge (if `pre1940 > 30%`), Substandard housing %, LLC investor ownership %, Active listings in `parent_zip`, and HMDA sample count / imputation indicator (`is_imputed`).
4. **Bottom Analytical Section**:
   - **Opportunity vs. Affordability Quadrant Scatter Plot**: X-axis = `tract_ami_pct`, Y-axis = `monthly_gap` (with `$0` reference line), points colored by `nri_quintile` (`1`–`5`), highlighting the bottom-right "High-Opportunity & Feasible" target zone.
   - **Filterable, Sortable Tract Table + CSV Export** for counselors and researchers.