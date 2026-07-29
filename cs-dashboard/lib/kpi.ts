import { Account } from "./types";

export interface KpiSummary {
  bookArr: number;
  arrAtRisk: number;
  arrAtRiskRed: number;
  renewal180Arr: number;
  renewal180Count: number;
  renewal180NotGreenArr: number;
  arrWeightedContainment: number;
  expansionPipeline: number;
}

export function computeKpis(accounts: Account[]): KpiSummary {
  let bookArr = 0;
  let arrAtRisk = 0;
  let arrAtRiskRed = 0;
  let renewal180Arr = 0;
  let renewal180Count = 0;
  let renewal180NotGreenArr = 0;
  let containmentWeighted = 0;
  let expansionPipeline = 0;

  for (const a of accounts) {
    bookArr += a.arr;
    if (a.computedHealth !== "Green") arrAtRisk += a.arr;
    if (a.computedHealth === "Red") arrAtRiskRed += a.arr;
    if (a.isRenewal180) {
      renewal180Arr += a.arr;
      renewal180Count += 1;
      if (a.computedHealth !== "Green") renewal180NotGreenArr += a.arr;
    }
    containmentWeighted += a.arr * a.containmentPct;
    if (a.expansionStage !== "None") expansionPipeline += a.expansionValue;
  }

  return {
    bookArr,
    arrAtRisk,
    arrAtRiskRed,
    renewal180Arr,
    renewal180Count,
    renewal180NotGreenArr,
    arrWeightedContainment: bookArr > 0 ? containmentWeighted / bookArr : 0,
    expansionPipeline,
  };
}
