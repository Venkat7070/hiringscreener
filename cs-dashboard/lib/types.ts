export type Tier = "Strategic" | "Enterprise" | "Growth" | "Tech-touch";

export type RenewalStatus =
  | "Committed"
  | "Likely"
  | "In Negotiation"
  | "At Risk"
  | "Churned";

export type ChampionStatus = "Active" | "At Risk" | "Departed";

export type BlockerType =
  | "None"
  | "Customer IT"
  | "Integration"
  | "Scope"
  | "Budget"
  | "Adoption"
  | "Competitive"
  | "Product Gap";

export type Health = "Green" | "Amber" | "Red";

export type ExpansionStage = "None" | "Identified" | "Qualified" | "Proposed";

/** Raw parsed record, straight off the sheet row, before computed fields. */
export interface AccountRaw {
  accountId: string;
  accountName: string;
  region: string;
  industry: string;
  tier: Tier;
  aoOwner: string;
  fdePod: string;
  arr: number;
  contractStart: string | null;
  renewalDate: string | null;
  lastEbrDate: string | null;
  actionDueDate: string | null;
  renewalStatus: RenewalStatus;
  paymentStatus: string;
  paymentLate: boolean;
  committedConversations: number;
  consumedConversations: number;
  containmentPct: number;
  botCsat: number;
  liveUseCases: number;
  contractedUseCases: number;
  channelsLive: number;
  primaryUseCase: string;
  championStatus: ChampionStatus;
  execSponsorEngaged: boolean;
  keyStakeholders: string;
  healthReason: string;
  internalBlockers: string;
  externalBlockers: string;
  nextAction: string;
  actionOwner: string;
  blockerType: BlockerType;
  manualHealth: Health | null;
  expansionStage: ExpansionStage;
  expansionValue: number;
  /** 1-indexed row number in the source sheet, for the "Open in Sheet" deep link. */
  rowIndex: number;
}

/** Fields computed server-side from AccountRaw. */
export interface AccountComputed {
  consumptionPct: number;
  daysToRenewal: number | null;
  isRenewal90: boolean;
  isRenewal180: boolean;
  computedHealth: Health;
  computedHealthScore: number;
  healthOverridden: boolean;
}

export type Account = AccountRaw & AccountComputed;

export interface ParseDiagnostics {
  totalRows: number;
  parsedRows: number;
  skippedRows: number;
  skippedReasons: string[];
}

export interface AccountsResponse {
  accounts: Account[];
  diagnostics: ParseDiagnostics;
  source: "sheet" | "sample" | "stale-cache";
  fetchedAt: string;
  stale?: boolean;
  staleReason?: string;
  /** Present only in "sheet"/"stale-cache" mode; used to build "Open in Sheet" deep links. */
  sheetId?: string;
  sheetTab?: string;
}
