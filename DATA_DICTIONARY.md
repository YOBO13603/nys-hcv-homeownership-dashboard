# Data dictionary

Master table for the NYS HCV Homeownership Feasibility Dashboard. One row is one Census tract.

| File | Role |
| --- | --- |
| `public/data/nys_hcv_master_table.csv` | The only master table. The app fetches this file, and `scripts/prepare_boundaries.py` reads it. |
| `public/data/nys_6msa_tracts.geojson` | Tract polygons for those 2,104 GEOIDs, EPSG:4326 |

The table has **2,104 rows**, **29 columns**, and no empty cells. `geoid`, `county_fips`, and `parent_zip` are identifiers. Keep them as strings. Do not cast them with `Number()`, or a leading zero would disappear. In this extract every tract GEOID already starts with `36`.

Percent columns are not all on the same scale. `tract_ami_pct` is already in percent points (`72.0` means 72%). The ACS and LLC share columns are fractions from 0 to 1 (`0.365` means 36.5%).

## Geography

| Column | Type | Meaning |
| --- | --- | --- |
| `geoid` | 11-digit string | Census tract GEOID. Primary key. |
| `county_fips` | 5-digit string | County FIPS. |
| `msa_code` | string | Metro code. CBSA codes are `15380` Buffalo (325), `27060` Ithaca (26), `35004` Long Island (665), `40380` Rochester (314), `45060` Syracuse (205). Hudson Valley is the label `HUDSON` (569). |
| `msa_name` | string | `Buffalo`, `Ithaca`, `Long Island`, `Rochester`, `Syracuse`, or `Hudson Valley`. |
| `county_name` | string | County name, including the word `County`. 20 counties. |
| `tract_label` | string | Display name, for example `Tract 100, Dutchess County`. |
| `parent_zip` | 5-digit string | ZIP code used for listing counts and search. |

## Prices and closing costs

| Column | Type | Meaning |
| --- | --- | --- |
| `median_home_value` | dollars | Tract median asking price. Default price in the ledger. |
| `p25_home_value` | dollars | Tract 25th-percentile asking price. |
| `est_hmda_loan_costs` | dollars | Estimated HMDA loan costs added to upfront cash. |
| `hmda_sample_count` | count | Loans behind that estimate. |
| `is_imputed` | `True` / `False` | `True` for 562 tracts whose HMDA costs were imputed. `False` for 1,542 observed tracts. |
| `county_mrt_rate` | rate | NY mortgage recording tax on the base loan. `0.0105` (1.05%, MCTD, 1,184 tracts) or `0.0075` (0.75%, upstate, 920 tracts). |

## Carrying cost

| Column | Type | Meaning |
| --- | --- | --- |
| `eff_property_tax_rate` | rate | Effective annual property tax as a share of price. Monthly tax is price times this rate, divided by 12. |
| `annual_home_insurance` | dollars | Annual premium. The ledger divides it by 12. |
| `monthly_utilities_est` | dollars | Monthly utilities added to carrying cost. |

## Policy and opportunity

| Column | Type | Meaning |
| --- | --- | --- |
| `tract_ami_pct` | percent points | Tract AMI relative to the area median. `100` means the tract is at 100% of AMI. |
| `wri` | `Yes` / `No` | Well-resourced area flag. `Yes` for 1,292 tracts, `No` for 812. |
| `nri_quintile` | integer 1–5 | Neighborhood opportunity quintile. Counts: 1 = 274, 2 = 269, 3 = 688, 4 = 437, 5 = 436. |
| `local_dpa_cap` | dollars | County default down-payment assistance cap. |
| `ps_1br` | dollars | 1-bedroom HCV payment standard. |
| `ps_2br` | dollars | 2-bedroom HCV payment standard. Dashboard default. |
| `ps_3br` | dollars | 3-bedroom HCV payment standard. |
| `ps_4br` | dollars | 4-bedroom HCV payment standard. |

## Secondary-market reality check

| Column | Type | Meaning |
| --- | --- | --- |
| `acs_pre1980_pct` | fraction 0–1 | Share of housing built before 1980. |
| `acs_pre1940_pct` | fraction 0–1 | Share of housing built before 1940. Above `0.30`, the ledger uses a $550 inspection instead of $400. |
| `acs_substandard_pct` | fraction 0–1 | Share of substandard housing. |
| `llc_ownership_pct` | fraction 0–1 | Share of ownership associated with LLC investors. |
| `active_listings_zip` | count | Active listings in `parent_zip`. The sidebar treats 100 as 100 or more. |

## Tract geometry

`public/data/nys_6msa_tracts.geojson` has 2,104 features in WGS84. Each feature’s only property is `geoid`, stored as an 11-character string, and it matches the master table one for one. The app joins the table to these polygons on that string.
