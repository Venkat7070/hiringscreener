"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AccountsResponse } from "@/lib/types";
import {
  DEFAULT_FILTERS,
  FilterState,
  filterAccounts,
  filtersFromSearchParams,
  filtersToSearchParams,
  uniqueSorted,
} from "@/lib/filters";
import { SortState, sortAccounts, sortStateFromParam, sortStateToParam } from "@/lib/sort";
import { computeKpis } from "@/lib/kpi";
import KpiStrip from "./KpiStrip";
import FilterBar from "./FilterBar";
import AccountTable from "./AccountTable";
import DrillDown from "./DrillDown";
import StaleBanner from "./StaleBanner";
import DiagnosticsPopover from "./DiagnosticsPopover";
import EmptyState from "./EmptyState";
import RenewalRunway from "./RenewalRunway";
import TierHealthChart from "./TierHealthChart";
import AttentionQueue from "./AttentionQueue";
import ExportButton from "./ExportButton";

export default function DashboardShell() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [data, setData] = useState<AccountsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);
  const sort = useMemo(() => sortStateFromParam(searchParams.get("sort")), [searchParams]);

  const updateUrl = useCallback(
    (nextFilters: FilterState, nextSort: SortState) => {
      const params = filtersToSearchParams(nextFilters, { sort: sortStateToParam(nextSort) });
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  const setFilters = (next: FilterState) => updateUrl(next, sort);
  const setSort = (next: SortState) => updateUrl(filters, next);
  const resetFilters = () => updateUrl(DEFAULT_FILTERS, sort);

  const load = useCallback(async (fresh: boolean) => {
    if (fresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts${fresh ? "?fresh=1" : ""}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      setData(json as AccountsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const accounts = useMemo(() => data?.accounts ?? [], [data]);
  const filtered = useMemo(() => filterAccounts(accounts, filters), [accounts, filters]);
  const sorted = useMemo(() => sortAccounts(filtered, sort), [filtered, sort]);
  const kpi = useMemo(() => computeKpis(filtered), [filtered]);

  const regionOptions = useMemo(() => uniqueSorted(accounts.map((a) => a.region)), [accounts]);
  const aoOwnerOptions = useMemo(() => uniqueSorted(accounts.map((a) => a.aoOwner)), [accounts]);
  const fdePodOptions = useMemo(() => uniqueSorted(accounts.map((a) => a.fdePod)), [accounts]);

  const selectedAccount = accounts.find((a) => a.accountId === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-text">
            CS Account Review <span className="text-accent">·</span> yellow.ai
          </h1>
          <p className="text-sm text-text/50">Portfolio health, renewal risk, and expansion console</p>
        </div>
        <div className="flex items-center gap-2">
          {data && <DiagnosticsPopover diagnostics={data.diagnostics} />}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="rounded-md border border-border bg-panel px-3 py-1.5 text-sm text-text hover:border-accent/60 disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {data?.stale && (
        <div className="mb-4">
          <StaleBanner reason={data.staleReason} fetchedAt={data.fetchedAt} />
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md border border-health-red/40 bg-health-red/10 px-3 py-2 text-sm text-health-red">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center text-text/50">Loading accounts…</div>
      ) : accounts.length === 0 ? (
        <EmptyState sheetTab={data?.sheetTab} />
      ) : (
        <div className="space-y-5">
          <KpiStrip kpi={kpi} />
          <FilterBar
            filters={filters}
            onChange={setFilters}
            onReset={resetFilters}
            regionOptions={regionOptions}
            aoOwnerOptions={aoOwnerOptions}
            fdePodOptions={fdePodOptions}
          />
          <RenewalRunway accounts={filtered} onSelect={setSelectedId} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TierHealthChart accounts={filtered} />
            <AttentionQueue accounts={filtered} onSelect={setSelectedId} />
          </div>
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-medium text-text/80">Account table</h2>
            <ExportButton accounts={sorted} />
          </div>
          <AccountTable accounts={sorted} sort={sort} onSortChange={setSort} onSelect={setSelectedId} />
        </div>
      )}

      <DrillDown account={selectedAccount} sheetId={data?.sheetId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
