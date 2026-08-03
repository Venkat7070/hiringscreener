"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { STAGES, type ApplicationRecord, type Stage } from "@/lib/types";
import { ROLE_LIST } from "@/lib/roles";
import { type Filters } from "./FilterBar";
import { BulkActionBar } from "./BulkActionBar";
import { ApplicationRow } from "./ApplicationRow";
import { runClassifyLoop } from "@/lib/classifyUnassigned";

type SortField = "mechanical_score" | "ai_score";

export function AdminDashboard() {
  const router = useRouter();
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>({
    role: "",
    stage: "",
    source: "",
    minScoreOnly: false,
    tag: "",
    search: "",
  });
  const [sortField, setSortField] = useState<SortField>("ai_score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [rescoring, setRescoring] = useState(false);
  const [rescoreProgress, setRescoreProgress] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [classifyProgress, setClassifyProgress] = useState<string | null>(null);

  useEffect(() => {
    void loadApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadApplications() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/applications");
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to load applications");
      const data = await res.json();
      setApplications(data.applications);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load applications");
    } finally {
      setLoading(false);
    }
  }

  async function handleSyncLinkedIn() {
    setSyncing(true);
    setSyncResult(null);
    const totals = { chatsScanned: 0, messagesScanned: 0, messagesStored: 0, ingested: 0, failed: 0 };
    let offset = 0;
    const MAX_ROUNDS = 50; // safety cap: 50 * 20 chats/round = 1000 chats
    try {
      for (let round = 0; round < MAX_ROUNDS; round++) {
        const res = await fetch(`/api/linkedin/sync?offset=${offset}`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Sync failed");

        totals.chatsScanned += data.chatsScanned;
        totals.messagesScanned += data.messagesScanned;
        totals.messagesStored += data.messagesStored;
        totals.ingested += data.ingested;
        totals.failed += data.failed;

        setSyncResult(
          `Syncing… ${totals.chatsScanned}/${data.totalChats} chats scanned, ${totals.messagesStored} messages stored, ${totals.ingested} CVs synced so far.`
        );

        if (!data.truncated) break;
        offset = data.nextOffset;
      }
      setSyncResult(
        `Scanned ${totals.chatsScanned} chat${totals.chatsScanned === 1 ? "" : "s"} (${totals.messagesScanned} messages) — ${totals.messagesStored} new message${totals.messagesStored === 1 ? "" : "s"} stored, ${totals.ingested} new CV${totals.ingested === 1 ? "" : "s"} synced${totals.failed ? `, ${totals.failed} failed` : ""}.`
      );
      await loadApplications();
    } catch (err) {
      setSyncResult(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const a of applications) for (const t of a.tags) set.add(t);
    return Array.from(set).sort();
  }, [applications]);

  const stats = useMemo(() => {
    const total = applications.length;
    const pendingScore = applications.filter((a) => a.ai_score === null).length;
    const shortlisted = applications.filter((a) => a.stage === "Shortlisted").length;
    const interview = applications.filter((a) => a.stage === "Interview" || a.stage === "Final Select").length;
    return { total, pendingScore, shortlisted, interview };
  }, [applications]);

  const filteredSorted = useMemo(() => {
    let list = applications;
    if (filters.role) list = list.filter((a) => a.role === filters.role);
    if (filters.stage) list = list.filter((a) => a.stage === filters.stage);
    if (filters.source) list = list.filter((a) => a.source === filters.source);
    if (filters.minScoreOnly) list = list.filter((a) => (a.mechanical_score ?? 0) >= 70);
    if (filters.tag) list = list.filter((a) => a.tags.includes(filters.tag));
    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q));
    }

    return [...list].sort((a, b) => {
      const aVal = a[sortField] ?? -1;
      const bVal = b[sortField] ?? -1;
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [applications, filters, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === filteredSorted.length ? new Set() : new Set(filteredSorted.map((a) => a.id))
    );
  }

  function selectUnscored() {
    // Include role-less applications here too (e.g. LinkedIn CV ingests awaiting triage) —
    // runBulkRescore already skips and reports on ones without a role, rather than this
    // silently selecting nothing when every unscored row happens to lack a role.
    setSelectedIds(new Set(filteredSorted.filter((a) => a.ai_score === null).map((a) => a.id)));
  }

  async function applyBulkStage(stage: Stage) {
    await fetch("/api/applications/bulk-stage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selectedIds), stage }),
    });
    setApplications((prev) =>
      prev.map((a) => (selectedIds.has(a.id) ? { ...a, stage } : a))
    );
    setSelectedIds(new Set());
  }

  async function runBulkRescore() {
    const targets = applications.filter((a) => selectedIds.has(a.id) && a.role);
    const skipped = selectedIds.size - targets.length;
    if (targets.length === 0) {
      setRescoreProgress(
        skipped > 0
          ? `Nothing to rescore — all ${skipped} selected application${skipped === 1 ? "" : "s"} need a role assigned first.`
          : "Nothing selected."
      );
      return;
    }

    setRescoring(true);
    let done = 0;
    let failed = 0;
    setRescoreProgress(`0/${targets.length} rescored…`);

    const CONCURRENCY = 4;
    let index = 0;
    async function next(): Promise<void> {
      while (index < targets.length) {
        const application = targets[index++];
        try {
          const res = await fetch(`/api/applications/${application.id}/rescore`, { method: "POST" });
          const data = await res.json();
          if (res.ok) {
            setApplications((prev) => prev.map((a) => (a.id === application.id ? data.application : a)));
          } else {
            failed++;
          }
        } catch {
          failed++;
        } finally {
          done++;
          setRescoreProgress(`${done}/${targets.length} rescored…`);
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, next));

    setRescoreProgress(
      `Rescored ${done - failed}/${targets.length}${failed ? `, ${failed} failed` : ""}${
        skipped ? ` (${skipped} skipped — no role assigned)` : ""
      }.`
    );
    setRescoring(false);
    setSelectedIds(new Set());
  }

  async function runBulkClassify() {
    const targetIds = applications.filter((a) => selectedIds.has(a.id) && !a.role).map((a) => a.id);
    const skippedHasRole = selectedIds.size - targetIds.length;
    if (targetIds.length === 0) {
      setClassifyProgress(
        skippedHasRole > 0
          ? `Nothing to classify — all ${skippedHasRole} selected application${skippedHasRole === 1 ? "" : "s"} already have a role.`
          : "Nothing selected."
      );
      return;
    }

    setClassifying(true);
    await runClassifyLoop(targetIds, (update) => {
      if (update.error) {
        setClassifyProgress(update.error);
        return;
      }
      setClassifyProgress(
        `${update.classified + update.classifiedNone + update.skipped + update.failed}/${update.totalCandidates} reviewed — ${update.classified} assigned a role, ${update.classifiedNone} not a fit for any role${update.failed ? `, ${update.failed} failed` : ""}.`
      );
      if (update.done) void loadApplications();
    });
    setClassifying(false);
    setSelectedIds(new Set());
  }

  function handleUpdated(updated: ApplicationRecord) {
    setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  }

  function handleDeleted(id: string) {
    setApplications((prev) => prev.filter((a) => a.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-stone-950">Applications</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncLinkedIn}
            disabled={syncing}
            className="rounded-md border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-800 transition hover:bg-sky-100 disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Sync LinkedIn"}
          </button>
          <a
            href="/api/applications/export"
            className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-800 transition hover:bg-stone-100"
          >
            Export CSV
          </a>
        </div>
      </div>

      {!loading && !error && applications.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="text-2xl font-semibold text-stone-950">{stats.total}</div>
            <div className="text-xs font-medium uppercase tracking-wide text-stone-500">Total</div>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="text-2xl font-semibold text-stone-950">{stats.pendingScore}</div>
            <div className="text-xs font-medium uppercase tracking-wide text-stone-500">Pending score</div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-2xl font-semibold text-emerald-800">{stats.shortlisted}</div>
            <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">Shortlisted</div>
          </div>
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-4">
            <div className="text-2xl font-semibold text-violet-800">{stats.interview}</div>
            <div className="text-xs font-medium uppercase tracking-wide text-violet-700">
              Interview / Final
            </div>
          </div>
        </div>
      )}

      {syncResult && <p className="mb-4 text-sm text-stone-600">{syncResult}</p>}

      <div className="mb-4 flex items-center gap-3">
        <input
          type="text"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          placeholder="Search by name…"
          className="w-full max-w-xs rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber"
        />
        {filters.search && (
          <span className="text-sm text-stone-500">
            {filteredSorted.length} match{filteredSorted.length === 1 ? "" : "es"}
          </span>
        )}
        <button
          onClick={toggleSelectAll}
          className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-100"
        >
          {selectedIds.size === filteredSorted.length && filteredSorted.length > 0 ? "Deselect all" : "Select all"}
        </button>
        <button
          onClick={selectUnscored}
          className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-100"
        >
          Select unscored
        </button>
      </div>

      <BulkActionBar
        selectedCount={selectedIds.size}
        onApply={applyBulkStage}
        onRescore={runBulkRescore}
        rescoring={rescoring}
        rescoreProgress={rescoreProgress}
        onClassify={runBulkClassify}
        classifying={classifying}
        classifyProgress={classifyProgress}
      />

      {loading && (
        <div className="flex items-center gap-2 py-10 text-stone-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-amber-dark" />
          Loading applications…
        </div>
      )}
      {error && <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</p>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-3 py-3">#</th>
                <th className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size > 0 && selectedIds.size === filteredSorted.length}
                    onChange={toggleSelectAll}
                    className="accent-amber"
                  />
                </th>
                <th className="px-3 py-3">
                  <div className="flex flex-col gap-1.5">
                    Name
                    <select
                      value={filters.source}
                      onChange={(e) => setFilters({ ...filters, source: e.target.value })}
                      className="w-full rounded-md border border-stone-300 px-1.5 py-1 text-[11px] normal-case text-stone-700"
                    >
                      <option value="">All sources</option>
                      <option value="form">Form</option>
                      <option value="linkedin">LinkedIn</option>
                    </select>
                  </div>
                </th>
                <th className="px-3 py-3">LinkedIn</th>
                <th className="px-3 py-3">
                  <div className="flex flex-col gap-1.5">
                    Role
                    <select
                      value={filters.role}
                      onChange={(e) => setFilters({ ...filters, role: e.target.value })}
                      className="w-full rounded-md border border-stone-300 px-1.5 py-1 text-[11px] normal-case text-stone-700"
                    >
                      <option value="">All roles</option>
                      {ROLE_LIST.map((r) => (
                        <option key={r.key} value={r.key}>
                          {r.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th className="px-3 py-3">
                  <div className="flex flex-col gap-1.5">
                    <button onClick={() => toggleSort("mechanical_score")} className="text-left hover:text-stone-900">
                      Mechanical {sortField === "mechanical_score" && (sortDir === "desc" ? "↓" : "↑")}
                    </button>
                    <label className="flex items-center gap-1 normal-case text-stone-600">
                      <input
                        type="checkbox"
                        checked={filters.minScoreOnly}
                        onChange={(e) => setFilters({ ...filters, minScoreOnly: e.target.checked })}
                        className="accent-amber"
                      />
                      ≥70%
                    </label>
                  </div>
                </th>
                <th className="px-3 py-3">
                  <button onClick={() => toggleSort("ai_score")} className="hover:text-stone-900">
                    AI Score {sortField === "ai_score" && (sortDir === "desc" ? "↓" : "↑")}
                  </button>
                </th>
                <th className="px-3 py-3">
                  <div className="flex flex-col gap-1.5">
                    Stage
                    <select
                      value={filters.stage}
                      onChange={(e) => setFilters({ ...filters, stage: e.target.value })}
                      className="w-full rounded-md border border-stone-300 px-1.5 py-1 text-[11px] normal-case text-stone-700"
                    >
                      <option value="">All stages</option>
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th className="px-3 py-3">
                  <div className="flex flex-col gap-1.5">
                    Tags
                    <select
                      value={filters.tag}
                      onChange={(e) => setFilters({ ...filters, tag: e.target.value })}
                      className="w-full rounded-md border border-stone-300 px-1.5 py-1 text-[11px] normal-case text-stone-700"
                    >
                      <option value="">All tags</option>
                      {allTags.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th className="px-3 py-3"></th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredSorted.map((application, index) => (
                <ApplicationRow
                  key={application.id}
                  serial={index + 1}
                  application={application}
                  selected={selectedIds.has(application.id)}
                  onToggleSelect={() => toggleSelect(application.id)}
                  onUpdated={handleUpdated}
                  onDeleted={handleDeleted}
                />
              ))}
              {filteredSorted.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-stone-400">
                    No applications match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
