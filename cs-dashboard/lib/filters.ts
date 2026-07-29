import { Account, BlockerType, Health, Tier } from "./types";

export type RenewalWindow = "all" | "90" | "180" | "365";

export interface FilterState {
  tier: Tier[];
  health: Health[];
  region: string[];
  aoOwner: string[];
  fdePod: string[];
  renewalWindow: RenewalWindow;
  blockerType: BlockerType[];
  q: string;
}

export const DEFAULT_FILTERS: FilterState = {
  tier: [],
  health: [],
  region: [],
  aoOwner: [],
  fdePod: [],
  renewalWindow: "all",
  blockerType: [],
  q: "",
};

const MULTI_KEYS = ["tier", "health", "region", "aoOwner", "fdePod", "blockerType"] as const;
const QUERY_KEY: Record<(typeof MULTI_KEYS)[number], string> = {
  tier: "tier",
  health: "health",
  region: "region",
  aoOwner: "ao",
  fdePod: "pod",
  blockerType: "blocker",
};

export function filtersFromSearchParams(params: URLSearchParams): FilterState {
  const state: FilterState = { ...DEFAULT_FILTERS };
  for (const key of MULTI_KEYS) {
    const raw = params.get(QUERY_KEY[key]);
    if (raw) {
      (state[key] as string[]) = raw.split(",").filter(Boolean);
    }
  }
  const window = params.get("window");
  if (window === "90" || window === "180" || window === "365") {
    state.renewalWindow = window;
  }
  const q = params.get("q");
  if (q) state.q = q;
  return state;
}

export function filtersToSearchParams(filters: FilterState, extra?: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of MULTI_KEYS) {
    const values = filters[key] as string[];
    if (values.length > 0) params.set(QUERY_KEY[key], values.join(","));
  }
  if (filters.renewalWindow !== "all") params.set("window", filters.renewalWindow);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) params.set(k, v);
    }
  }
  return params;
}

export function isFilterActive(filters: FilterState): boolean {
  return (
    filters.tier.length > 0 ||
    filters.health.length > 0 ||
    filters.region.length > 0 ||
    filters.aoOwner.length > 0 ||
    filters.fdePod.length > 0 ||
    filters.blockerType.length > 0 ||
    filters.renewalWindow !== "all" ||
    filters.q.trim().length > 0
  );
}

function withinRenewalWindow(account: Account, window: RenewalWindow): boolean {
  if (window === "all") return true;
  const days = account.daysToRenewal;
  if (days == null || days < 0) return false;
  const max = Number(window);
  return days <= max;
}

export function filterAccounts(accounts: Account[], filters: FilterState): Account[] {
  const q = filters.q.trim().toLowerCase();
  return accounts.filter((a) => {
    if (filters.tier.length && !filters.tier.includes(a.tier)) return false;
    if (filters.health.length && !filters.health.includes(a.computedHealth)) return false;
    if (filters.region.length && !filters.region.includes(a.region)) return false;
    if (filters.aoOwner.length && !filters.aoOwner.includes(a.aoOwner)) return false;
    if (filters.fdePod.length && !filters.fdePod.includes(a.fdePod)) return false;
    if (filters.blockerType.length && !filters.blockerType.includes(a.blockerType)) return false;
    if (!withinRenewalWindow(a, filters.renewalWindow)) return false;
    if (q) {
      const haystack = `${a.accountName} ${a.industry} ${a.primaryUseCase}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}
