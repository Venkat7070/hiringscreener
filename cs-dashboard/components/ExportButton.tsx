"use client";

import { Account } from "@/lib/types";
import { toCsv } from "@/lib/csv";

const EXPORT_HEADERS = [
  "Account Name",
  "Tier",
  "Region",
  "Industry",
  "AO Owner",
  "FDE Pod",
  "ARR",
  "Computed Health",
  "Manual Health",
  "Containment %",
  "Consumption %",
  "Bot CSAT",
  "Renewal Date",
  "Days To Renewal",
  "Renewal Status",
  "Champion Status",
  "Blocker Type",
  "Expansion Stage",
  "Expansion Value",
  "Next Action",
  "Action Owner",
  "Action Due Date",
];

function toRow(a: Account): (string | number)[] {
  return [
    a.accountName,
    a.tier,
    a.region,
    a.industry,
    a.aoOwner,
    a.fdePod,
    a.arr,
    a.computedHealth,
    a.manualHealth ?? "",
    Math.round(a.containmentPct),
    Math.round(a.consumptionPct),
    Math.round(a.botCsat),
    a.renewalDate ?? "",
    a.daysToRenewal ?? "",
    a.renewalStatus,
    a.championStatus,
    a.blockerType,
    a.expansionStage,
    a.expansionValue,
    a.nextAction,
    a.actionOwner,
    a.actionDueDate ?? "",
  ];
}

export default function ExportButton({ accounts }: { accounts: Account[] }) {
  const handleExport = () => {
    const csv = toCsv(EXPORT_HEADERS, accounts.map(toRow));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `cs-account-review-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      disabled={accounts.length === 0}
      className="rounded-md border border-border bg-panel px-3 py-1.5 text-sm text-text hover:border-accent/60 disabled:opacity-50"
    >
      Export CSV
    </button>
  );
}
