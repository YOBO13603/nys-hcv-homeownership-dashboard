export type BBox = [number, number, number, number];

export type Bedrooms = 1 | 2 | 3 | 4;

export type PriceTier = "median" | "p25";

export type DpaMode = "county" | "sonyma" | "custom";

export type LayerId = "gap" | "cash" | "opportunity" | "ami" | "risk";

export type RiskMode = "combined" | "llc" | "pre1980";

export type Tract = {
  geoid: string;
  countyFips: string;
  msaCode: string;
  msaName: string;
  countyName: string;
  tractLabel: string;
  parentZip: string;
  medianHomeValue: number;
  p25HomeValue: number;
  estHmdaLoanCosts: number;
  hmdaSampleCount: number;
  isImputed: boolean;
  countyMrtRate: number;
  effPropertyTaxRate: number;
  annualHomeInsurance: number;
  monthlyUtilitiesEst: number;
  tractAmiPct: number;
  wri: boolean;
  nriQuintile: number;
  localDpaCap: number;
  ps: Record<Bedrooms, number>;
  acsPre1980Pct: number;
  acsPre1940Pct: number;
  acsSubstandardPct: number;
  llcOwnershipPct: number;
  activeListingsZip: number;
};

export type Controls = {
  msa: string;
  county: string;
  priceTier: PriceTier;
  bedrooms: Bedrooms;
  psPct: number;
  ratePct: number;
  dpaMode: DpaMode;
  customDpa: number;
  buyerCash: number;
  useFamilyShare: boolean;
  householdAmiPct: number;
  wriOnly: boolean;
  nriMin: number;
  nriMax: number;
  minListings: number;
};

export const DEFAULT_CONTROLS: Controls = {
  msa: "all",
  county: "all",
  priceTier: "median",
  bedrooms: 2,
  psPct: 100,
  ratePct: 6.5,
  dpaMode: "county",
  customDpa: 10000,
  buyerCash: 3000,
  useFamilyShare: false,
  householdAmiPct: 50,
  wriOnly: false,
  nriMin: 1,
  nriMax: 5,
  minListings: 0,
};

export type Assumptions = {
  priceTier: PriceTier;
  bedrooms: Bedrooms;
  psPct: number;
  annualRate: number;
  dpaMode: DpaMode;
  customDpa: number;
  buyerCash: number;
  useFamilyShare: boolean;
  householdAmiPct: number;
};

export type Ledger = {
  price: number;
  priceSource: "median" | "p25" | "custom";
  tierPrice: number;
  downPayment: number;
  baseLoan: number;
  mrtCost: number;
  mrtLabel: string;
  inspectionFee: number;
  leadTrigger: boolean;
  hmdaCosts: number;
  grossUpfront: number;
  programDpa: number;
  appliedDpa: number;
  dpaLabel: string;
  netCashGap: number;
  upfrontMip: number;
  totalFhaLoan: number;
  monthlyPi: number;
  monthlyTax: number;
  monthlyIns: number;
  monthlyMip: number;
  monthlyUtilities: number;
  totalMonthly: number;
  nominalPaymentStandard: number;
  effectivePaymentStandard: number;
  amiArea: string;
  annualAmi: number;
  annualHouseholdIncome: number;
  monthlyHouseholdIncome: number;
  familyContribution: number;
  monthlyGap: number;
  monthlyFeasible: boolean;
  fullyFeasible: boolean;
};

export type ScoredTract = {
  tract: Tract;
  ledger: Ledger;
  visible: boolean;
};

export type Summary = {
  count: number;
  monthlyCount: number;
  monthlyPct: number;
  fullCount: number;
  fullPct: number;
  wriMonthlyCount: number;
  medianCash: number | null;
  medianGap: number | null;
};

export type CameraRequest =
  | { token: number; kind: "point"; lon: number; lat: number; zoom: number }
  | { token: number; kind: "bounds"; bbox: BBox };

export type GeoFeature = {
  type: "Feature";
  properties: { geoid: string };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[] | number[][] | number[][][] | number[][][][];
  };
};

export type TractCollection = {
  type: "FeatureCollection";
  features: GeoFeature[];
};

export type TractSpatial = {
  geoid: string;
  bbox: BBox;
  feature: GeoFeature;
};

export type AddressHit = {
  id: string;
  label: string;
  detail: string;
  lon: number;
  lat: number;
  source: "photon" | "census";
};

export type LocalHit =
  | { kind: "tract"; geoid: string; title: string; detail: string }
  | { kind: "county"; title: string; detail: string }
  | { kind: "msa"; title: string; detail: string };
