import type { Tract } from "../types";

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim().length > 0));
}

function padDigits(raw: string, width: number, field: string): string {
  const cleaned = raw.trim().replace(/\.0+$/, "");
  if (!/^\d+$/.test(cleaned)) {
    throw new Error(`${field} is not an all-digit id: "${raw}"`);
  }
  return cleaned.padStart(width, "0");
}

function num(raw: string, field: string, geoid: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Bad ${field} for ${geoid}: "${raw}"`);
  }
  return value;
}

export function parseMasterTable(text: string): Tract[] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = parseRows(source);
  if (rows.length < 2) throw new Error("Master table is empty");

  const header = rows[0].map((cell) => cell.trim());
  const index = new Map(header.map((name, position) => [name, position]));
  const required = [
    "geoid",
    "county_fips",
    "msa_code",
    "msa_name",
    "county_name",
    "tract_label",
    "parent_zip",
    "median_home_value",
    "p25_home_value",
    "est_hmda_loan_costs",
    "hmda_sample_count",
    "is_imputed",
    "eff_property_tax_rate",
    "county_mrt_rate",
    "annual_home_insurance",
    "acs_pre1980_pct",
    "acs_pre1940_pct",
    "acs_substandard_pct",
    "llc_ownership_pct",
    "active_listings_zip",
    "wri",
    "nri_quintile",
    "local_dpa_cap",
    "ps_1br",
    "ps_2br",
    "ps_3br",
    "ps_4br",
    "monthly_utilities_est",
    "tract_ami_pct",
  ];
  for (const name of required) {
    if (!index.has(name)) throw new Error(`Master table is missing column ${name}`);
  }

  const cell = (cols: string[], name: string) => cols[index.get(name) as number] ?? "";
  const tracts: Tract[] = [];
  const seen = new Set<string>();

  for (const cols of rows.slice(1)) {
    const geoid = padDigits(cell(cols, "geoid"), 11, "geoid");
    if (seen.has(geoid)) throw new Error(`Duplicate geoid ${geoid}`);
    seen.add(geoid);
    const paymentStandard = (column: string) => num(cell(cols, column), column, geoid);
    tracts.push({
      geoid,
      countyFips: padDigits(cell(cols, "county_fips"), 5, "county_fips"),
      msaCode: cell(cols, "msa_code").trim(),
      msaName: cell(cols, "msa_name").trim(),
      countyName: cell(cols, "county_name").trim(),
      tractLabel: cell(cols, "tract_label").trim(),
      parentZip: padDigits(cell(cols, "parent_zip"), 5, "parent_zip"),
      medianHomeValue: num(cell(cols, "median_home_value"), "median_home_value", geoid),
      p25HomeValue: num(cell(cols, "p25_home_value"), "p25_home_value", geoid),
      estHmdaLoanCosts: num(cell(cols, "est_hmda_loan_costs"), "est_hmda_loan_costs", geoid),
      hmdaSampleCount: num(cell(cols, "hmda_sample_count"), "hmda_sample_count", geoid),
      isImputed: ["true", "1", "yes"].includes(cell(cols, "is_imputed").trim().toLowerCase()),
      countyMrtRate: num(cell(cols, "county_mrt_rate"), "county_mrt_rate", geoid),
      effPropertyTaxRate: num(cell(cols, "eff_property_tax_rate"), "eff_property_tax_rate", geoid),
      annualHomeInsurance: num(cell(cols, "annual_home_insurance"), "annual_home_insurance", geoid),
      monthlyUtilitiesEst: num(cell(cols, "monthly_utilities_est"), "monthly_utilities_est", geoid),
      tractAmiPct: num(cell(cols, "tract_ami_pct"), "tract_ami_pct", geoid),
      wri: cell(cols, "wri").trim() === "Yes",
      nriQuintile: num(cell(cols, "nri_quintile"), "nri_quintile", geoid),
      localDpaCap: num(cell(cols, "local_dpa_cap"), "local_dpa_cap", geoid),
      ps: {
        1: paymentStandard("ps_1br"),
        2: paymentStandard("ps_2br"),
        3: paymentStandard("ps_3br"),
        4: paymentStandard("ps_4br"),
      },
      acsPre1980Pct: num(cell(cols, "acs_pre1980_pct"), "acs_pre1980_pct", geoid),
      acsPre1940Pct: num(cell(cols, "acs_pre1940_pct"), "acs_pre1940_pct", geoid),
      acsSubstandardPct: num(cell(cols, "acs_substandard_pct"), "acs_substandard_pct", geoid),
      llcOwnershipPct: num(cell(cols, "llc_ownership_pct"), "llc_ownership_pct", geoid),
      activeListingsZip: num(cell(cols, "active_listings_zip"), "active_listings_zip", geoid),
    });
  }

  if (tracts.length !== 2104) {
    throw new Error(`Expected 2,104 tracts, parsed ${tracts.length}`);
  }
  return tracts;
}
