import type { Assumptions, Controls, Ledger, Tract } from "../types";
import { amiForCounty } from "./ami";

export function cents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function assumptionsFrom(controls: Controls): Assumptions {
  return {
    priceTier: controls.priceTier,
    bedrooms: controls.bedrooms,
    psPct: controls.psPct,
    annualRate: controls.ratePct / 100,
    dpaMode: controls.dpaMode,
    customDpa: controls.customDpa,
    buyerCash: controls.buyerCash,
    useFamilyShare: controls.useFamilyShare,
    householdAmiPct: controls.householdAmiPct,
  };
}

function monthlyPayment(principal: number, annualRate: number, months = 360): number {
  const monthlyRate = annualRate / 12;
  if (monthlyRate === 0) return principal / months;
  const growth = (1 + monthlyRate) ** months;
  return (principal * monthlyRate * growth) / (growth - 1);
}

export function computeLedger(
  tract: Tract,
  assumptions: Assumptions,
  priceOverride?: number | null,
): Ledger {
  const tierPrice =
    assumptions.priceTier === "median" ? tract.medianHomeValue : tract.p25HomeValue;
  const custom = priceOverride != null && Number.isFinite(priceOverride) && priceOverride > 0;
  const price = custom ? (priceOverride as number) : tierPrice;
  const priceSource = custom ? "custom" : assumptions.priceTier;

  const downPayment = cents(price * 0.035);
  const baseLoan = cents(price - downPayment);
  const mrtCost = cents(baseLoan * tract.countyMrtRate);
  const leadTrigger = tract.acsPre1940Pct > 0.3;
  const inspectionFee = leadTrigger ? 550 : 400;
  const hmdaCosts = cents(tract.estHmdaLoanCosts);
  const grossUpfront = cents(downPayment + hmdaCosts + mrtCost + inspectionFee);

  let programDpa = tract.localDpaCap;
  let dpaLabel = "County local cap";
  if (assumptions.dpaMode === "sonyma") {
    // HCR rule: the greater of $3,000 or 3% of price, and never more than $15,000.
    // DPAL has no monthly payment, so it only reduces cash-to-close.
    programDpa = Math.max(3000, Math.min(15000, cents(price * 0.03)));
    dpaLabel = "NYS SONYMA DPAL · greater of $3,000 or 3% of price, capped at $15,000";
  } else if (assumptions.dpaMode === "custom") {
    programDpa = assumptions.customDpa;
    dpaLabel = "Custom DPA";
  }
  programDpa = cents(programDpa);
  const appliedDpa = cents(Math.min(programDpa, grossUpfront));
  const netCashGap = cents(Math.max(0, grossUpfront - programDpa));

  const upfrontMip = cents(baseLoan * 0.0175);
  const totalFhaLoan = cents(baseLoan + upfrontMip);
  const monthlyPi = cents(monthlyPayment(totalFhaLoan, assumptions.annualRate));
  const monthlyTax = cents((price * tract.effPropertyTaxRate) / 12);
  const monthlyIns = cents(tract.annualHomeInsurance / 12);
  const monthlyMip = cents((baseLoan * 0.0055) / 12);
  const monthlyUtilities = cents(tract.monthlyUtilitiesEst);
  const totalMonthly = cents(monthlyPi + monthlyTax + monthlyIns + monthlyMip + monthlyUtilities);

  const nominalPaymentStandard = tract.ps[assumptions.bedrooms];
  const effectivePaymentStandard = cents(nominalPaymentStandard * (assumptions.psPct / 100));
  const ami = amiForCounty(tract.countyFips);
  const annualHouseholdIncome = ami.mfi * (assumptions.householdAmiPct / 100);
  const monthlyHouseholdIncome = annualHouseholdIncome / 12;
  const familyContribution = assumptions.useFamilyShare
    ? cents(monthlyHouseholdIncome * 0.3)
    : 0;
  const monthlyGap = cents(totalMonthly - effectivePaymentStandard - familyContribution);

  return {
    price,
    priceSource,
    tierPrice,
    downPayment,
    baseLoan,
    mrtCost,
    mrtLabel: tract.countyMrtRate >= 0.01 ? "MCTD" : "Upstate",
    inspectionFee,
    leadTrigger,
    hmdaCosts,
    grossUpfront,
    programDpa,
    appliedDpa,
    dpaLabel,
    netCashGap,
    upfrontMip,
    totalFhaLoan,
    monthlyPi,
    monthlyTax,
    monthlyIns,
    monthlyMip,
    monthlyUtilities,
    totalMonthly,
    nominalPaymentStandard,
    effectivePaymentStandard,
    amiArea: ami.area,
    annualAmi: ami.mfi,
    annualHouseholdIncome,
    monthlyHouseholdIncome,
    familyContribution,
    monthlyGap,
    monthlyFeasible: monthlyGap <= 0,
    fullyFeasible: monthlyGap <= 0 && netCashGap <= assumptions.buyerCash,
  };
}

export function tractVisible(tract: Tract, controls: Controls): boolean {
  if (controls.msa !== "all" && tract.msaName !== controls.msa) return false;
  if (controls.county !== "all" && tract.countyName !== controls.county) return false;
  if (controls.wriOnly && !tract.wri) return false;
  if (tract.nriQuintile < controls.nriMin || tract.nriQuintile > controls.nriMax) return false;
  if (controls.minListings > 0 && tract.activeListingsZip < controls.minListings) return false;
  return true;
}
