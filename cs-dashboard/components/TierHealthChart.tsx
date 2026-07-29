"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Account, Tier } from "@/lib/types";
import { HEALTH_HEX } from "@/lib/format";

const TIERS: Tier[] = ["Strategic", "Enterprise", "Growth", "Tech-touch"];

interface Row {
  tier: Tier;
  Green: number;
  Amber: number;
  Red: number;
}

function buildData(accounts: Account[]): Row[] {
  const map = new Map<Tier, Row>(TIERS.map((t) => [t, { tier: t, Green: 0, Amber: 0, Red: 0 }]));
  for (const a of accounts) {
    const row = map.get(a.tier);
    if (!row) continue;
    row[a.computedHealth] += Math.round(a.arr / 1000);
  }
  return TIERS.map((t) => map.get(t) as Row);
}

interface TooltipPayloadItem {
  dataKey: string;
  value: number;
  fill: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-border bg-bg px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 font-medium text-text">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2" style={{ color: p.fill }}>
          <span>{p.dataKey}</span>
          <span className="num text-text/80">${p.value}K</span>
        </div>
      ))}
    </div>
  );
}

export default function TierHealthChart({ accounts }: { accounts: Account[] }) {
  const data = buildData(accounts);
  return (
    <div className="rounded-lg border border-border bg-panel p-3">
      <h2 className="mb-2 px-1 text-sm font-medium text-text/80">ARR by tier × health</h2>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#2A2F3A" vertical={false} />
            <XAxis dataKey="tier" tick={{ fill: "#8A8F9C", fontSize: 12 }} axisLine={{ stroke: "#2A2F3A" }} tickLine={false} />
            <YAxis
              tick={{ fill: "#8A8F9C", fontSize: 12 }}
              axisLine={{ stroke: "#2A2F3A" }}
              tickLine={false}
              tickFormatter={(v: number) => `$${v}K`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#8A8F9C" }} />
            <Bar dataKey="Green" stackId="h" fill={HEALTH_HEX.Green} />
            <Bar dataKey="Amber" stackId="h" fill={HEALTH_HEX.Amber} />
            <Bar dataKey="Red" stackId="h" fill={HEALTH_HEX.Red} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
