"use client";

import { BlockerType, Health, Tier } from "@/lib/types";
import { FilterState, RenewalWindow, isFilterActive } from "@/lib/filters";
import MultiSelectFilter from "./MultiSelectFilter";

const TIERS: Tier[] = ["Strategic", "Enterprise", "Growth", "Tech-touch"];
const HEALTHS: Health[] = ["Green", "Amber", "Red"];
const BLOCKER_TYPES: BlockerType[] = [
  "None",
  "Customer IT",
  "Integration",
  "Scope",
  "Budget",
  "Adoption",
  "Competitive",
  "Product Gap",
];

interface FilterBarProps {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onReset: () => void;
  regionOptions: string[];
  aoOwnerOptions: string[];
  fdePodOptions: string[];
}

export default function FilterBar({
  filters,
  onChange,
  onReset,
  regionOptions,
  aoOwnerOptions,
  fdePodOptions,
}: FilterBarProps) {
  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-panel/60 p-3">
      <MultiSelectFilter label="Tier" options={TIERS} selected={filters.tier} onChange={(v) => set("tier", v as Tier[])} />
      <MultiSelectFilter label="Health" options={HEALTHS} selected={filters.health} onChange={(v) => set("health", v as Health[])} />
      <MultiSelectFilter label="Region" options={regionOptions} selected={filters.region} onChange={(v) => set("region", v)} />
      <MultiSelectFilter label="AO Owner" options={aoOwnerOptions} selected={filters.aoOwner} onChange={(v) => set("aoOwner", v)} />
      <MultiSelectFilter label="FDE Pod" options={fdePodOptions} selected={filters.fdePod} onChange={(v) => set("fdePod", v)} />
      <MultiSelectFilter
        label="Blocker"
        options={BLOCKER_TYPES}
        selected={filters.blockerType}
        onChange={(v) => set("blockerType", v as BlockerType[])}
      />

      <select
        value={filters.renewalWindow}
        onChange={(e) => set("renewalWindow", e.target.value as RenewalWindow)}
        className="rounded-md border border-border bg-panel px-3 py-1.5 text-sm text-text hover:border-accent/60"
        aria-label="Renewal window"
      >
        <option value="all">All renewals</option>
        <option value="90">Next 90 days</option>
        <option value="180">Next 180 days</option>
        <option value="365">Next 365 days</option>
      </select>

      <input
        type="search"
        value={filters.q}
        onChange={(e) => set("q", e.target.value)}
        placeholder="Search name, industry, use case…"
        className="min-w-[220px] flex-1 rounded-md border border-border bg-panel px-3 py-1.5 text-sm text-text placeholder:text-text/40"
        aria-label="Search accounts"
      />

      {isFilterActive(filters) && (
        <button
          onClick={onReset}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-text/70 hover:border-accent/60 hover:text-text"
        >
          Reset
        </button>
      )}
    </div>
  );
}
