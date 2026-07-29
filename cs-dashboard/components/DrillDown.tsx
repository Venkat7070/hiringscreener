"use client";

import { useEffect } from "react";
import { Account } from "@/lib/types";
import {
  formatCurrency,
  formatCurrencyFull,
  formatDate,
  formatDaysToRenewal,
  formatPct,
  renewalUrgencyColor,
  thresholdColor,
} from "@/lib/format";
import HealthBadge from "./HealthBadge";

interface DrillDownProps {
  account: Account | null;
  sheetId?: string;
  onClose: () => void;
}

function MetricCard({
  label,
  value,
  title,
  color,
}: {
  label: string;
  value: string;
  title?: string;
  color?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-panel px-3 py-2">
      <div className="truncate text-xs uppercase tracking-wide text-text/50">{label}</div>
      <div
        className="mt-1 truncate font-display text-xl num"
        style={color ? { color } : undefined}
        title={title ?? value}
      >
        {value}
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wide text-text/50">{title}</h3>
      <div className="mt-1 text-sm text-text/90">{children}</div>
    </div>
  );
}

export default function DrillDown({ account, sheetId, onClose }: DrillDownProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!account) return null;

  const sheetUrl = sheetId
    ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=0&range=A${account.rowIndex}`
    : null;

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${account.accountName} details`}
        className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-border bg-panel p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-medium">{account.accountName}</h2>
            <div className="mt-1 flex items-center gap-2 text-sm text-text/60">
              <span>{account.tier}</span>
              <span>·</span>
              <span>{account.region}</span>
              <span>·</span>
              <span>{account.industry || "—"}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close details"
            className="rounded-md border border-border px-2 py-1 text-text/70 hover:border-accent/60 hover:text-text"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard label="ARR" value={formatCurrency(account.arr)} title={formatCurrencyFull(account.arr)} />
          <MetricCard
            label="Days to renewal"
            value={formatDaysToRenewal(account.daysToRenewal)}
            color={renewalUrgencyColor(account.daysToRenewal)}
          />
          <MetricCard
            label="Consumption"
            value={formatPct(account.consumptionPct)}
            color={thresholdColor(account.consumptionPct, 80, 50)}
          />
          <MetricCard
            label="Containment"
            value={formatPct(account.containmentPct)}
            color={thresholdColor(account.containmentPct, 80, 50)}
          />
        </div>

        <div className="mt-4 rounded-lg border border-border bg-bg/60 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-text/50">Health</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text/50">Computed</span>
              <HealthBadge health={account.computedHealth} />
            </div>
          </div>
          {account.manualHealth && (
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-xs text-text/50">
                CSM manual {account.healthOverridden && <span className="text-accent">· override</span>}
              </span>
              <HealthBadge health={account.manualHealth} />
            </div>
          )}
          <div className="mt-1.5 text-xs text-text/50 num">Score: {account.computedHealthScore}/100</div>
        </div>

        <div className="mt-4 rounded-lg border border-accent/40 bg-accent/10 p-3">
          <h3 className="text-xs uppercase tracking-wide text-accent">Next action</h3>
          <p className="mt-1 text-sm text-text">{account.nextAction || "No next action logged."}</p>
          <div className="mt-2 flex items-center justify-between text-xs text-text/60">
            <span>Owner: {account.actionOwner || "—"}</span>
            <span>Due: {formatDate(account.actionDueDate)}</span>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <Block title="Champion">
            {account.championStatus}
            {account.expansionStage !== "None" && (
              <span className="ml-2 text-text/50">Expansion: {account.expansionStage}</span>
            )}
          </Block>
          <Block title="Exec sponsor engaged">{account.execSponsorEngaged ? "Yes" : "No"}</Block>
          <Block title="Key stakeholders">{account.keyStakeholders || "—"}</Block>
          <Block title="Last EBR">{formatDate(account.lastEbrDate)}</Block>
        </div>

        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <Block title="Health reason">{account.healthReason || "—"}</Block>
          <Block title="Internal blockers">{account.internalBlockers || "—"}</Block>
          <Block title="External blockers">{account.externalBlockers || "—"}</Block>
          <Block title="Blocker type">{account.blockerType}</Block>
          <Block title="Payment status">
            <span className={account.paymentLate ? "text-health-red" : undefined}>{account.paymentStatus || "—"}</span>
          </Block>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-xs text-text/50">
          <span>Row {account.rowIndex}</span>
          {sheetUrl ? (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-border px-3 py-1.5 text-text/80 hover:border-accent/60 hover:text-accent"
            >
              Open in Sheet ↗
            </a>
          ) : (
            <span>Sample data — no source sheet</span>
          )}
        </div>
      </div>
    </div>
  );
}
