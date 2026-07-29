import type { RecommendedStage } from "./types";

export const FINAL_YEAR_PATTERN =
  /\b(final[\s-]?year|final[\s-]?yr|final[\s-]?semester|7th\s*sem(ester)?|8th\s*sem(ester)?|currently\s+pursuing|pursuing\s+my|pursuing\s+b\.?tech|3rd\s*year|4th\s*year)\b/i;

// The model doesn't reliably follow the "never Shortlist a still-studying candidate"
// instruction on its own — enforce it mechanically regardless of what it returned.
export function capFinalYearStage(
  recommendedStage: RecommendedStage,
  text: string
): RecommendedStage {
  if (recommendedStage === "Shortlist" && FINAL_YEAR_PATTERN.test(text)) {
    return "Borderline";
  }
  return recommendedStage;
}
