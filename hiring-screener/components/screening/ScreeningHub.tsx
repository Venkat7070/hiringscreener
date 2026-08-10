"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type {
  ApplicationRecord,
  CandidateSearchResult,
  ScreeningDashboard,
  ScreeningSessionSummary,
} from "@/lib/types";
import { ROLE_LIST } from "@/lib/roles";
import { runScreeningLoop } from "@/lib/runScreening";
import { ScoreBadge } from "@/components/shared/ScoreBadge";

const STAGE_BAR_COLOR = "bg-amber";

function CandidateSearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CandidateSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      setResults(null);
      setError(null);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/screening/candidates/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  function handleClear() {
    setQuery("");
    setResults(null);
    setError(null);
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
        Search candidates by skill, tool or software
      </h2>
      <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Power BI, dashboard, analytics (comma-separated)"
          className="min-w-[240px] flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber"
        />
        <button
          type="submit"
          disabled={searching}
          className="rounded-md border border-amber bg-amber/10 px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-amber/20 disabled:opacity-50"
        >
          {searching ? "Searching…" : "Search"}
        </button>
        {results !== null && (
          <button
            type="button"
            onClick={handleClear}
            className="rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-600 transition hover:bg-stone-100"
          >
            Clear
          </button>
        )}
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {results !== null && !error && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-stone-400">
            {results.length} candidate{results.length === 1 ? "" : "s"} across all sessions
          </p>
          {results.length === 0 ? (
            <p className="text-sm text-stone-400">No candidates match these keywords.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {results.map((r) => (
                <div key={r.candidateId} className="rounded-lg border border-stone-100 bg-stone-50 px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-stone-900">{r.candidateName}</span>
                      <Link
                        href={`/admin/screening/${r.sessionId}`}
                        className="text-xs text-amber-dark hover:underline"
                      >
                        {r.sessionName}
                      </Link>
                    </div>
                    <a
                      href={r.cvUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-amber-dark hover:underline"
                    >
                      {r.cvFilename}
                    </a>
                  </div>
                  {r.matchedKeywords.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {r.matchedKeywords.map((kw) => (
                        <span
                          key={kw}
                          className="rounded-full bg-amber/20 px-2 py-0.5 text-[11px] font-medium text-stone-800"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                  {r.snippet && <p className="mt-1.5 text-xs text-stone-500">{r.snippet}</p>}
                  {r.results.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {r.results.map((res, i) => (
                        <span key={i} className="flex items-center gap-1 text-[11px] text-stone-500">
                          {res.roleTitle}
                          <ScoreBadge score={res.aiScore} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DashboardPanel({ dashboard }: { dashboard: ScreeningDashboard }) {
  const { totals, stageFunnel, roleBreakdown } = dashboard;
  const maxStageCount = Math.max(1, ...stageFunnel.map((s) => s.count));
  const maxRoleCount = Math.max(1, ...roleBreakdown.map((r) => r.candidateCount));

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">Overview</h2>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-stone-100 bg-stone-50 px-4 py-3">
          <div className="text-2xl font-semibold text-stone-950">{totals.totalCandidates}</div>
          <div className="text-xs text-stone-500">Total candidates</div>
        </div>
        <div className="rounded-lg border border-stone-100 bg-stone-50 px-4 py-3">
          <div className="text-2xl font-semibold text-stone-950">
            {totals.totalScored}
            <span className="text-sm font-normal text-stone-400"> / {totals.totalCandidates}</span>
          </div>
          <div className="text-xs text-stone-500">Scored</div>
        </div>
        <div className="rounded-lg border border-stone-100 bg-stone-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <ScoreBadge score={totals.avgScore !== null ? Math.round(totals.avgScore) : null} />
          </div>
          <div className="mt-1 text-xs text-stone-500">Average AI score</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Pipeline by stage
          </h3>
          <div className="flex flex-col gap-2">
            {stageFunnel.map(({ stage, count }) => (
              <div key={stage} className="flex items-center gap-2 text-xs">
                <span className="w-24 shrink-0 text-stone-600">{stage}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                  <div
                    className={`h-full rounded-full ${STAGE_BAR_COLOR}`}
                    style={{ width: `${(count / maxStageCount) * 100}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right font-medium text-stone-700">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Candidates &amp; avg score by role
          </h3>
          {roleBreakdown.length === 0 ? (
            <p className="text-xs text-stone-400">No roles yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {roleBreakdown.map((role) => (
                <div key={role.title} className="flex items-center gap-2 text-xs">
                  <span className="w-32 shrink-0 truncate text-stone-600" title={role.title}>
                    {role.title}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className={`h-full rounded-full ${STAGE_BAR_COLOR}`}
                      style={{ width: `${(role.candidateCount / maxRoleCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right font-medium text-stone-700">
                    {role.candidateCount}
                  </span>
                  <ScoreBadge score={role.avgScore !== null ? Math.round(role.avgScore) : null} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  pending: "border-stone-300 bg-stone-50 text-stone-600",
  partial: "border-amber bg-amber/10 text-stone-900",
  done: "border-emerald-300 bg-emerald-50 text-emerald-800",
};

export function ScreeningHub() {
  const [sessions, setSessions] = useState<ScreeningSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningRoleId, setRunningRoleId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<Record<string, string>>({});
  const [applications, setApplications] = useState<ApplicationRecord[] | null>(null);
  const [dashboard, setDashboard] = useState<ScreeningDashboard | null>(null);
  const [rescopeByRole, setRescopeByRole] = useState<Record<string, "new" | "all">>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/screening/sessions");
      if (!res.ok) throw new Error("Failed to load screening sessions");
      const data = await res.json();
      setSessions(data.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load screening sessions");
    } finally {
      setLoading(false);
    }
  }

  function loadDashboard() {
    fetch("/api/screening/dashboard")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setDashboard(data))
      .catch(() => {});
  }

  useEffect(() => {
    void load();
    loadDashboard();
    fetch("/api/applications")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setApplications(data.applications))
      .catch(() => {});
  }, []);

  async function handleRun(sessionId: string, roleId: string) {
    const scope = rescopeByRole[roleId] ?? "new";
    setRunningRoleId(roleId);
    await runScreeningLoop(
      sessionId,
      roleId,
      (update) => {
        if (update.error) {
          setRunStatus((prev) => ({ ...prev, [roleId]: update.error! }));
          return;
        }
        setRunStatus((prev) => ({
          ...prev,
          [roleId]: `${update.scored + update.failed}/${update.totalCandidates} processed${
            update.rateLimited ? " — stopped early, click Run again" : ""
          }`,
        }));
        if (update.done) {
          void load();
          loadDashboard();
        }
      },
      { force: scope === "all" }
    );
    setRunningRoleId(null);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-stone-950">Screening sessions</h1>
        <Link
          href="/admin/screening/upload"
          className="rounded-md border border-amber bg-amber/10 px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-amber/20"
        >
          + New session
        </Link>
      </div>

      {loading && <p className="py-10 text-stone-500">Loading sessions…</p>}
      {error && <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</p>}

      {!loading && !error && (
        <div className="flex flex-col gap-4">
          <CandidateSearchPanel />

          {dashboard && <DashboardPanel dashboard={dashboard} />}

          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <Link href="/admin" className="text-lg font-medium text-stone-900 hover:underline">
                FDE Intern, Lead & Manager Screener
              </Link>
              {applications && (
                <span className="text-xs text-stone-400">
                  {applications.length} candidate{applications.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {ROLE_LIST.map((role) => (
                <div
                  key={role.key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-100 bg-stone-50 px-3 py-2"
                >
                  <span className="text-sm font-medium text-stone-800">{role.title}</span>
                  <span className="text-xs text-stone-500">
                    {applications ? applications.filter((a) => a.role === role.key).length : "…"} applicant
                    {applications?.filter((a) => a.role === role.key).length === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {sessions.length === 0 && (
            <p className="rounded-xl border border-dashed border-stone-300 px-6 py-10 text-center text-stone-400">
              No other screening sessions yet. Create one to upload CVs against a job description.
            </p>
          )}

          {sessions.map((session) => (
            <div key={session.id} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <Link
                  href={`/admin/screening/${session.id}`}
                  className="text-lg font-medium text-stone-900 hover:underline"
                >
                  {session.name}
                </Link>
                <span className="text-xs text-stone-400">
                  {new Date(session.created_at).toLocaleDateString()} · {session.candidateCount} candidate
                  {session.candidateCount === 1 ? "" : "s"}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {session.roles.map((role) => (
                  <div
                    key={role.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-100 bg-stone-50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-stone-800">{role.title}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[role.status]}`}
                      >
                        {role.status} ({role.scoredCount}/{role.candidateCount})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {runStatus[role.id] && (
                        <span className="text-xs text-stone-500">{runStatus[role.id]}</span>
                      )}
                      <div className="flex overflow-hidden rounded-md border border-stone-300 text-xs">
                        <button
                          onClick={() => setRescopeByRole((prev) => ({ ...prev, [role.id]: "new" }))}
                          className={`px-2 py-1 font-medium transition ${
                            (rescopeByRole[role.id] ?? "new") === "new"
                              ? "bg-stone-200 text-stone-900"
                              : "bg-white text-stone-500 hover:bg-stone-50"
                          }`}
                        >
                          New only
                        </button>
                        <button
                          onClick={() => setRescopeByRole((prev) => ({ ...prev, [role.id]: "all" }))}
                          className={`border-l border-stone-300 px-2 py-1 font-medium transition ${
                            rescopeByRole[role.id] === "all"
                              ? "bg-stone-200 text-stone-900"
                              : "bg-white text-stone-500 hover:bg-stone-50"
                          }`}
                        >
                          All
                        </button>
                      </div>
                      <button
                        onClick={() => handleRun(session.id, role.id)}
                        disabled={runningRoleId === role.id || session.candidateCount === 0}
                        className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800 transition hover:bg-sky-100 disabled:opacity-50"
                      >
                        {runningRoleId === role.id
                          ? "Running…"
                          : `Rescore ${(rescopeByRole[role.id] ?? "new") === "all" ? "all" : "new"}`}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
