"use client";

import { KpiSummary } from "@/lib/kpi";
import { formatCurrency, formatCurrencyFull, formatPct } from "@/lib/format";

function Tile({
  label,
  value,
  sub,
  subClassName,
}: {
  label: string;
  value: string;
  sub?: string;
  subClassName?: string;
}) {
  return (
    <div className="flex-1 min-w-[180px] rounded-lg border border-border bg-panel px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-text/60">{label}</div>
      <div className="mt-1 font-display text-2xl font-medium num" title={value}>
        {value}
      </div>
      {sub && <div className={`mt-0.5 text-xs num ${subClassName ?? "text-text/50"}`}>{sub}</div>}
    </div>
  );
}

export default function KpiStrip({ kpi }: { kpi: KpiSummary }) {
  return (
    <div className="flex flex-wrap gap-3" role="region" aria-label="Portfolio KPIs">
      <Tile label="Book ARR" value={formatCurrency(kpi.bookArr)} sub={formatCurrencyFull(kpi.bookArr)} />
      <Tile
        label="ARR at risk"
        value={formatCurrency(kpi.arrAtRisk)}
        sub={`${formatCurrency(kpi.arrAtRiskRed)} Red`}
        subClassName="text-health-red"
      />
      <Tile
        label="Renewal exposure (180d)"
        value={formatCurrency(kpi.renewal180Arr)}
        sub={`${kpi.renewal180Count} accounts · ${formatCurrency(kpi.renewal180NotGreenArr)} not green`}
        subClassName="text-health-amber"
      />
      <Tile label="ARR-weighted containment" value={formatPct(kpi.arrWeightedContainment, 1)} />
      <Tile label="Expansion pipeline" value={formatCurrency(kpi.expansionPipeline)} />
    </div>
  );
}
