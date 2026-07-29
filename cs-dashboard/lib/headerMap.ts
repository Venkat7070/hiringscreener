/**
 * Maps sheet column headers to canonical field keys, matching
 * case/punctuation-insensitively (e.g. "ARR ($)" -> "arr", "CSM Owner" -> "aoOwner").
 */

export type FieldKey =
  | "accountId"
  | "accountName"
  | "region"
  | "industry"
  | "tier"
  | "aoOwner"
  | "fdePod"
  | "arr"
  | "contractStart"
  | "renewalDate"
  | "lastEbrDate"
  | "actionDueDate"
  | "renewalStatus"
  | "paymentStatus"
  | "committedConversations"
  | "consumedConversations"
  | "containmentPct"
  | "botCsat"
  | "liveUseCases"
  | "contractedUseCases"
  | "channelsLive"
  | "primaryUseCase"
  | "championStatus"
  | "execSponsorEngaged"
  | "keyStakeholders"
  | "healthReason"
  | "internalBlockers"
  | "externalBlockers"
  | "nextAction"
  | "actionOwner"
  | "blockerType"
  | "health"
  | "expansionStage"
  | "expansionValue";

/** Lowercase, strip everything but letters/digits, so "ARR ($)" and "arr" collide. */
export function normalizeHeader(header: string): string {
  return header
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Normalized alias -> canonical field key. Order doesn't matter; keys are pre-normalized. */
const ALIASES: Record<string, FieldKey> = {
  accountid: "accountId",
  id: "accountId",
  accountname: "accountName",
  account: "accountName",
  customer: "accountName",
  customername: "accountName",
  region: "region",
  industry: "industry",
  tier: "tier",
  aoowner: "aoOwner",
  accountowner: "aoOwner",
  csmowner: "aoOwner",
  csm: "aoOwner",
  owner: "aoOwner",
  fdepod: "fdePod",
  pod: "fdePod",
  fde: "fdePod",
  arr: "arr",
  arrusd: "arr",
  contractstart: "contractStart",
  contractstartdate: "contractStart",
  renewaldate: "renewalDate",
  renewal: "renewalDate",
  lastebrdate: "lastEbrDate",
  lastebr: "lastEbrDate",
  actionduedate: "actionDueDate",
  duedate: "actionDueDate",
  renewalstatus: "renewalStatus",
  paymentstatus: "paymentStatus",
  committedconversations: "committedConversations",
  consumedconversations: "consumedConversations",
  containmentpct: "containmentPct",
  containment: "containmentPct",
  botcsat: "botCsat",
  csat: "botCsat",
  liveusecases: "liveUseCases",
  contractedusecases: "contractedUseCases",
  channelslive: "channelsLive",
  primaryusecase: "primaryUseCase",
  championstatus: "championStatus",
  execsponsorengaged: "execSponsorEngaged",
  execsponsor: "execSponsorEngaged",
  keystakeholders: "keyStakeholders",
  healthreason: "healthReason",
  internalblockers: "internalBlockers",
  externalblockers: "externalBlockers",
  nextaction: "nextAction",
  actionowner: "actionOwner",
  blockertype: "blockerType",
  health: "health",
  expansionstage: "expansionStage",
  expansionvalue: "expansionValue",
};

/**
 * Given the sheet's header row, returns a map of field key -> column index.
 * Headers that don't match any known alias are silently ignored.
 */
export function mapHeaders(headers: string[]): Partial<Record<FieldKey, number>> {
  const result: Partial<Record<FieldKey, number>> = {};
  headers.forEach((raw, index) => {
    const normalized = normalizeHeader(raw);
    const field = ALIASES[normalized];
    if (field && result[field] === undefined) {
      result[field] = index;
    }
  });
  return result;
}
