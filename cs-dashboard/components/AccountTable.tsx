"use client";

import { Account } from "@/lib/types";
import { SortColumn, SortState } from "@/lib/sort";
import { formatCurrency, formatDate, formatDaysToRenewal, renewalUrgencyColor, thresholdColor } from "@/lib/format";
import HealthBadge from "./HealthBadge";
import ProgressBar from "./ProgressBar";

interface Column {
  key: SortColumn;
  label: string;
  align?: "left" | "right";
}

const COLUMNS: Column[] = [
  { key: "accountName", label: "Account" },
  { key: "tier", label: "Tier" },
  { key: "aoOwner", label: "AO" },
  { key: "arr", label: "ARR", align: "right" },
  { key: "health", label: "Health" },
  { key: "containmentPct", label: "Containment", align: "right" },
  { key: "consumptionPct", label: "Consumption", align: "right" },
  { key: "botCsat", label: "CSAT", align: "right" },
  { key: "renewalDate", label: "Renewal", align: "right" },
  { key: "renewalStatus", label: "Status" },
  { key: "expansionValue", label: "Expansion", align: "right" },
];

interface AccountTableProps {
  accounts: Account[];
  sort: SortState;
  onSortChange: (next: SortState) => void;
  onSelect: (accountId: string) => void;
}

export default function AccountTable({ accounts, sort, onSortChange, onSelect }: AccountTableProps) {
  const toggleSort = (column: SortColumn) => {
    if (sort.column === column) {
      onSortChange({ column, direction: sort.direction === "asc" ? "desc" : "asc" });
    } else {
      onSortChange({ column, direction: "desc" });
    }
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[960px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-panel/80 text-left text-xs uppercase tracking-wide text-text/60">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2 font-medium ${col.align === "right" ? "text-right" : ""}`}
                aria-sort={sort.column === col.key ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
              >
                <button onClick={() => toggleSort(col.key)} className="inline-flex items-center gap-1 hover:text-text">
                  {col.label}
                  {sort.column === col.key && <span aria-hidden>{sort.direction === "asc" ? "▲" : "▼"}</span>}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr
              key={a.accountId}
              onClick={() => onSelect(a.accountId)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSelect(a.accountId);
              }}
              className="cursor-pointer border-b border-border/60 hover:bg-white/5 focus:bg-white/5"
            >
              <td className="px-3 py-2">
                <div className="font-medium text-text">{a.accountName}</div>
                <div className="text-xs text-text/50">{a.industry || "—"}</div>
              </td>
              <td className="px-3 py-2 text-text/80">{a.tier}</td>
              <td className="px-3 py-2 text-text/80">{a.aoOwner || "—"}</td>
              <td className="px-3 py-2 text-right num">{formatCurrency(a.arr)}</td>
              <td className="px-3 py-2">
                <HealthBadge health={a.computedHealth} overridden={a.healthOverridden} />
              </td>
              <td className="px-3 py-2 text-right num" style={{ color: thresholdColor(a.containmentPct, 80, 50) }}>
                {Math.round(a.containmentPct)}%
              </td>
              <td className="px-3 py-2">
                <ProgressBar pct={a.consumptionPct} color={thresholdColor(a.consumptionPct, 80, 50)} />
              </td>
              <td className="px-3 py-2 text-right num">{Math.round(a.botCsat)}</td>
              <td className="px-3 py-2 text-right">
                <div className="num">{formatDate(a.renewalDate)}</div>
                <div className="num text-xs" style={{ color: renewalUrgencyColor(a.daysToRenewal) }}>
                  {formatDaysToRenewal(a.daysToRenewal)}
                </div>
              </td>
              <td className="px-3 py-2 text-text/80">{a.renewalStatus}</td>
              <td className="px-3 py-2 text-right num">{a.expansionValue > 0 ? formatCurrency(a.expansionValue) : "—"}</td>
            </tr>
          ))}
          {accounts.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-text/50">
                No accounts match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
