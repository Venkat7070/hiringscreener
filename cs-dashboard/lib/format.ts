import { Health } from "./types";

export function formatCurrency(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function formatCurrencyFull(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatCurrencyK(n: number): string {
  return `$${Math.round(n / 1000)}K`;
}

export function formatPct(n: number, digits = 0): string {
  return `${n.toFixed(digits)}%`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function formatDaysToRenewal(days: number | null): string {
  if (days == null) return "—";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  return `${days}d`;
}

export const HEALTH_HEX: Record<Health, string> = {
  Green: "#3ECF8E",
  Amber: "#F5A623",
  Red: "#F0554E",
};

export const HEALTH_BADGE_CLASS: Record<Health, string> = {
  Green: "bg-health-green/15 text-health-green border-health-green/40",
  Amber: "bg-health-amber/15 text-health-amber border-health-amber/40",
  Red: "bg-health-red/15 text-health-red border-health-red/40",
};

export function thresholdColor(value: number, greenMin: number, amberMin: number): string {
  if (value >= greenMin) return HEALTH_HEX.Green;
  if (value >= amberMin) return HEALTH_HEX.Amber;
  return HEALTH_HEX.Red;
}

export function renewalUrgencyColor(daysToRenewal: number | null): string {
  if (daysToRenewal == null) return "#8A8F9C";
  if (daysToRenewal <= 30) return HEALTH_HEX.Red;
  if (daysToRenewal <= 90) return HEALTH_HEX.Amber;
  return HEALTH_HEX.Green;
}
