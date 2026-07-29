"use client";

import { useMemo } from "react";
import { Account } from "@/lib/types";
import { formatCurrency, formatDate, formatDaysToRenewal, renewalUrgencyColor } from "@/lib/format";
import HealthBadge from "./HealthBadge";

interface AttentionQueueProps {
  accounts: Account[];
  onSelect: (accountId: string) => void;
}

export default function AttentionQueue({ accounts, onSelect }: AttentionQueueProps) {
  const queue = useMemo(() => {
    return accounts
      .filter((a) => a.computedHealth === "Red" || a.isRenewal90)
      .sort((a, b) => b.arr - a.arr);
  }, [accounts]);

  return (
    <div className="rounded-lg border border-border bg-panel p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-medium text-text/80">Attention queue</h2>
        <span className="text-xs text-text/50 num">{queue.length} accounts</span>
      </div>
      {queue.length === 0 ? (
        <div className="p-6 text-center text-sm text-text/50">Nothing needs attention right now.</div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {queue.map((a) => (
            <button
              key={a.accountId}
              onClick={() => onSelect(a.accountId)}
              className="flex flex-col gap-2 rounded-lg border border-border bg-bg/60 p-3 text-left hover:border-accent/60"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-text">{a.accountName}</div>
                  <div className="text-xs text-text/50">
                    {a.tier} · {formatCurrency(a.arr)}
                  </div>
                </div>
                <HealthBadge health={a.computedHealth} overridden={a.healthOverridden} />
              </div>
              <div className="text-xs text-text/70 line-clamp-2">{a.nextAction || "No next action logged."}</div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text/50">{a.actionOwner || "Unassigned"}</span>
                <span className="num" style={{ color: renewalUrgencyColor(a.daysToRenewal) }}>
                  {a.isRenewal90 ? `Renews ${formatDaysToRenewal(a.daysToRenewal)}` : `Due ${formatDate(a.actionDueDate)}`}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
