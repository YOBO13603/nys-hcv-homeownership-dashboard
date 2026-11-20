export type AmiArea = {
  area: string;
  mfi: number;
};

/**
 * FY2026 HUD median family income by county.
 * Upstate and Long Island figures are the published medians whose 4-person
 * very-low limit is exactly 50% of the median. Ithaca ($118,000) and Kingston
 * ($117,300) match HUD's FY2026 income-limit summaries. Westchester and Putnam
 * use the FY2026 median reported for their HUD areas; those income limits are
 * housing-cost adjusted, so they are not a straight percentage of the median.
 * Rockland uses the FY2026 county median reported alongside the Westchester area.
 */
const AMI_BY_COUNTY: Record<string, AmiArea> = {
  "36029": { area: "Buffalo-Cheektowaga-Niagara Falls, NY MSA", mfi: 101500 },
  "36063": { area: "Buffalo-Cheektowaga-Niagara Falls, NY MSA", mfi: 101500 },
  "36051": { area: "Rochester, NY MSA", mfi: 107000 },
  "36055": { area: "Rochester, NY HUD Metro FMR Area", mfi: 107000 },
  "36069": { area: "Rochester, NY MSA", mfi: 107000 },
  "36073": { area: "Rochester, NY MSA", mfi: 107000 },
  "36117": { area: "Rochester, NY MSA", mfi: 107000 },
  "36123": { area: "Rochester, NY MSA", mfi: 107000 },
  "36053": { area: "Syracuse, NY MSA", mfi: 106800 },
  "36067": { area: "Syracuse, NY MSA", mfi: 106800 },
  "36075": { area: "Syracuse, NY MSA", mfi: 106800 },
  "36109": { area: "Ithaca, NY MSA", mfi: 118000 },
  "36059": { area: "Nassau-Suffolk, NY HUD Metro FMR Area", mfi: 164300 },
  "36103": { area: "Nassau-Suffolk, NY HUD Metro FMR Area", mfi: 164300 },
  "36027": { area: "Poughkeepsie-Newburgh-Middletown, NY HUD Metro FMR Area", mfi: 125900 },
  "36071": { area: "Poughkeepsie-Newburgh-Middletown, NY HUD Metro FMR Area", mfi: 125900 },
  "36079": { area: "New York, NY HUD Metro FMR Area", mfi: 104300 },
  "36087": { area: "Rockland County, NY", mfi: 128800 },
  "36111": { area: "Kingston, NY MSA", mfi: 117300 },
  "36119": { area: "Westchester County, NY Statutory Exception Area", mfi: 164200 },
};

export function amiForCounty(countyFips: string): AmiArea {
  const area = AMI_BY_COUNTY[countyFips];
  if (!area) throw new Error(`No FY2026 AMI for county ${countyFips}`);
  return area;
}
