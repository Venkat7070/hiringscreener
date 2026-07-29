import { Account, Health } from "./types";

export type SortColumn =
  | "accountName"
  | "tier"
  | "aoOwner"
  | "arr"
  | "health"
  | "containmentPct"
  | "consumptionPct"
  | "botCsat"
  | "renewalDate"
  | "renewalStatus"
  | "expansionValue";

export type SortDirection = "asc" | "desc";

export interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

export const DEFAULT_SORT: SortState = { column: "arr", direction: "desc" };

const HEALTH_ORDER: Record<Health, number> = { Red: 0, Amber: 1, Green: 2 };

function compareValues(a: Account, b: Account, column: SortColumn): number {
  switch (column) {
    case "accountName":
      return a.accountName.localeCompare(b.accountName);
    case "tier":
      return a.tier.localeCompare(b.tier);
    case "aoOwner":
      return a.aoOwner.localeCompare(b.aoOwner);
    case "arr":
      return a.arr - b.arr;
    case "health":
      return HEALTH_ORDER[a.computedHealth] - HEALTH_ORDER[b.computedHealth];
    case "containmentPct":
      return a.containmentPct - b.containmentPct;
    case "consumptionPct":
      return a.consumptionPct - b.consumptionPct;
    case "botCsat":
      return a.botCsat - b.botCsat;
    case "renewalDate": {
      const av = a.daysToRenewal ?? Number.POSITIVE_INFINITY;
      const bv = b.daysToRenewal ?? Number.POSITIVE_INFINITY;
      return av - bv;
    }
    case "renewalStatus":
      return a.renewalStatus.localeCompare(b.renewalStatus);
    case "expansionValue":
      return a.expansionValue - b.expansionValue;
    default:
      return 0;
  }
}

export function sortAccounts(accounts: Account[], sort: SortState): Account[] {
  const sorted = [...accounts].sort((a, b) => compareValues(a, b, sort.column));
  return sort.direction === "asc" ? sorted : sorted.reverse();
}

export function sortStateFromParam(raw: string | null): SortState {
  if (!raw) return DEFAULT_SORT;
  const [column, direction] = raw.split(":");
  const validColumns: SortColumn[] = [
    "accountName",
    "tier",
    "aoOwner",
    "arr",
    "health",
    "containmentPct",
    "consumptionPct",
    "botCsat",
    "renewalDate",
    "renewalStatus",
    "expansionValue",
  ];
  if (!validColumns.includes(column as SortColumn)) return DEFAULT_SORT;
  return {
    column: column as SortColumn,
    direction: direction === "asc" ? "asc" : "desc",
  };
}

export function sortStateToParam(sort: SortState): string {
  return `${sort.column}:${sort.direction}`;
}
