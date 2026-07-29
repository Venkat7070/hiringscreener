import { Account, AccountComputed, AccountRaw, Health } from "./types";

const WEIGHTS = {
  consumption: 0.25,
  containment: 0.2,
  useCases: 0.15,
  championExec: 0.15,
  payment: 0.1,
  csat: 0.1,
  renewal: 0.05,
} as const;

const RENEWAL_STATUS_SCORE: Record<AccountRaw["renewalStatus"], number> = {
  Committed: 100,
  Likely: 75,
  "In Negotiation": 50,
  "At Risk": 15,
  Churned: 0,
};

const CHAMPION_SCORE: Record<AccountRaw["championStatus"], number> = {
  Active: 100,
  "At Risk": 50,
  Departed: 0,
};

const GREEN_THRESHOLD = 75;
const AMBER_THRESHOLD = 50;

export function computeConsumptionPct(raw: Pick<AccountRaw, "committedConversations" | "consumedConversations">): number {
  if (raw.committedConversations <= 0) {
    return raw.consumedConversations > 0 ? 100 : 0;
  }
  return (raw.consumedConversations / raw.committedConversations) * 100;
}

function computeUseCasePct(raw: Pick<AccountRaw, "liveUseCases" | "contractedUseCases">): number {
  if (raw.contractedUseCases <= 0) return 100;
  return (raw.liveUseCases / raw.contractedUseCases) * 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export interface HealthResult {
  score: number;
  health: Health;
}

/** Weighted composite health score (0-100) with hard overrides to Red. */
export function computeHealthScore(raw: AccountRaw, consumptionPct: number): HealthResult {
  const containmentPct = raw.containmentPct;

  const consumptionScore = clamp(consumptionPct, 0, 100);
  const containmentScore = clamp(containmentPct, 0, 100);
  const useCaseScore = clamp(computeUseCasePct(raw), 0, 100);
  const championExecScore =
    0.7 * CHAMPION_SCORE[raw.championStatus] + 0.3 * (raw.execSponsorEngaged ? 100 : 0);
  const paymentScore = raw.paymentLate ? 0 : 100;
  const csatScore = clamp(raw.botCsat, 0, 100);
  const renewalScore = RENEWAL_STATUS_SCORE[raw.renewalStatus];

  const score =
    WEIGHTS.consumption * consumptionScore +
    WEIGHTS.containment * containmentScore +
    WEIGHTS.useCases * useCaseScore +
    WEIGHTS.championExec * championExecScore +
    WEIGHTS.payment * paymentScore +
    WEIGHTS.csat * csatScore +
    WEIGHTS.renewal * renewalScore;

  const hardOverride =
    consumptionPct < 40 || containmentPct < 40 || raw.championStatus === "Departed";

  let health: Health;
  if (hardOverride) {
    health = "Red";
  } else if (score >= GREEN_THRESHOLD) {
    health = "Green";
  } else if (score >= AMBER_THRESHOLD) {
    health = "Amber";
  } else {
    health = "Red";
  }

  return { score: Math.round(score * 10) / 10, health };
}

function daysBetween(fromMs: number, toIso: string): number {
  const toMs = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((toMs - fromMs) / 86_400_000);
}

/** Adds computed/derived fields (health score, consumption %, renewal windows) to a raw record. */
export function computeAccount(raw: AccountRaw, now: Date = new Date()): Account {
  const consumptionPct = computeConsumptionPct(raw);
  const { score, health } = computeHealthScore(raw, consumptionPct);

  const nowMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysToRenewal = raw.renewalDate ? daysBetween(nowMs, raw.renewalDate) : null;
  const isRenewal90 = daysToRenewal != null && daysToRenewal >= 0 && daysToRenewal <= 90;
  const isRenewal180 = daysToRenewal != null && daysToRenewal >= 0 && daysToRenewal <= 180;

  const computed: AccountComputed = {
    consumptionPct,
    daysToRenewal,
    isRenewal90,
    isRenewal180,
    computedHealth: health,
    computedHealthScore: score,
    healthOverridden: raw.manualHealth != null && raw.manualHealth !== health,
  };

  return { ...raw, ...computed };
}
