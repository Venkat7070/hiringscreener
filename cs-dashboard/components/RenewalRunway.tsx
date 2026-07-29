"use client";

import { useMemo, useRef, useState } from "react";
import { Account } from "@/lib/types";
import { HEALTH_HEX, formatCurrency, formatDaysToRenewal } from "@/lib/format";

const WIDTH = 1200;
const MARGIN = { top: 16, right: 24, bottom: 28, left: 24 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const RANGE_DAYS = 365;
const LANE_HEIGHT = 32;
const MAX_LANES = 7;
const MIN_LANES = 3;

function radiusFor(arr: number): number {
  return Math.min(28, Math.max(5, Math.sqrt(arr) / 55));
}

interface Bubble {
  account: Account;
  x: number;
  y: number;
  r: number;
}

function layoutBubbles(accounts: Account[]): { bubbles: Bubble[]; height: number } {
  const items = accounts
    .filter((a) => a.daysToRenewal != null && a.daysToRenewal >= 0 && a.daysToRenewal <= RANGE_DAYS)
    .map((a) => ({
      account: a,
      x: MARGIN.left + ((a.daysToRenewal as number) / RANGE_DAYS) * PLOT_WIDTH,
      r: radiusFor(a.arr),
    }))
    .sort((a, b) => a.x - b.x);

  const laneRightEdge: number[] = [];
  const placed: { account: Account; x: number; r: number; lane: number }[] = [];
  let maxLane = 0;

  for (const item of items) {
    let lane = 0;
    while (lane < MAX_LANES - 1) {
      const edge = laneRightEdge[lane];
      if (edge === undefined || item.x - item.r >= edge + 3) break;
      lane++;
    }
    laneRightEdge[lane] = item.x + item.r;
    maxLane = Math.max(maxLane, lane);
    placed.push({ account: item.account, x: item.x, r: item.r, lane });
  }

  const lanesUsed = Math.max(MIN_LANES, maxLane + 1);
  const bubbles: Bubble[] = placed.map((p) => ({
    account: p.account,
    x: p.x,
    r: p.r,
    y: MARGIN.top + p.lane * LANE_HEIGHT + LANE_HEIGHT / 2,
  }));

  return { bubbles, height: MARGIN.top + lanesUsed * LANE_HEIGHT + MARGIN.bottom };
}

function monthTicks(today: Date) {
  const ticks: { x: number; label: string }[] = [];
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  for (let i = 0; i <= 12; i++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const days = Math.round((d.getTime() - today.getTime()) / 86_400_000);
    if (days < 0 || days > RANGE_DAYS) continue;
    ticks.push({
      x: MARGIN.left + (days / RANGE_DAYS) * PLOT_WIDTH,
      label: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
    });
  }
  return ticks;
}

interface RenewalRunwayProps {
  accounts: Account[];
  onSelect: (accountId: string) => void;
}

export default function RenewalRunway({ accounts, onSelect }: RenewalRunwayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ bubble: Bubble; mx: number; my: number } | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }, []);

  const { bubbles, height } = useMemo(() => layoutBubbles(accounts), [accounts]);
  const ticks = useMemo(() => monthTicks(today), [today]);
  const baselineY = height - MARGIN.bottom;

  if (bubbles.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-panel p-6 text-center text-sm text-text/50">
        No renewals in the next 12 months for the current filters.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-panel p-3">
      <h2 className="mb-1 px-1 text-sm font-medium text-text/80">Renewal runway (next 12 months)</h2>
      <div ref={containerRef} className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          className="w-full min-w-[720px]"
          role="img"
          aria-label="Renewal runway timeline: bubble size is ARR, color is health"
        >
          <line x1={MARGIN.left} y1={baselineY} x2={WIDTH - MARGIN.right} y2={baselineY} stroke="#2A2F3A" strokeWidth={1} />
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={t.x} y1={MARGIN.top} x2={t.x} y2={baselineY} stroke="#2A2F3A" strokeWidth={1} strokeDasharray="2,4" />
              <text x={t.x} y={height - 8} fill="#8A8F9C" fontSize={11} textAnchor="middle">
                {t.label}
              </text>
            </g>
          ))}
          {bubbles.map((b) => (
            <circle
              key={b.account.accountId}
              cx={b.x}
              cy={b.y}
              r={b.r}
              fill={HEALTH_HEX[b.account.computedHealth]}
              fillOpacity={0.82}
              stroke="#121419"
              strokeWidth={1.5}
              className="cursor-pointer transition-opacity hover:opacity-100"
              onClick={() => onSelect(b.account.accountId)}
              onMouseEnter={(e) => {
                const rect = containerRef.current?.getBoundingClientRect();
                setHover({
                  bubble: b,
                  mx: rect ? e.clientX - rect.left : 0,
                  my: rect ? e.clientY - rect.top : 0,
                });
              }}
              onMouseMove={(e) => {
                const rect = containerRef.current?.getBoundingClientRect();
                setHover((prev) =>
                  prev ? { ...prev, mx: rect ? e.clientX - rect.left : 0, my: rect ? e.clientY - rect.top : 0 } : prev
                );
              }}
              onMouseLeave={() => setHover(null)}
            >
              <title>
                {b.account.accountName} — {formatCurrency(b.account.arr)} — {formatDaysToRenewal(b.account.daysToRenewal)}
              </title>
            </circle>
          ))}
        </svg>
        {hover && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs shadow-xl"
            style={{ left: hover.mx, top: hover.my - 10 }}
          >
            <div className="font-medium text-text">{hover.bubble.account.accountName}</div>
            <div className="text-text/60 num">
              {formatCurrency(hover.bubble.account.arr)} · {formatDaysToRenewal(hover.bubble.account.daysToRenewal)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
