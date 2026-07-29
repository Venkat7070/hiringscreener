"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ScreeningSessionSummary } from "@/lib/types";
import { runScreeningLoop } from "@/lib/runScreening";

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

  useEffect(() => {
    void load();
  }, []);

  async function handleRun(sessionId: string, roleId: string) {
    setRunningRoleId(roleId);
    await runScreeningLoop(sessionId, roleId, (update) => {
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
      if (update.done) void load();
    });
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

      {!loading && !error && sessions.length === 0 && (
        <p className="rounded-xl border border-dashed border-stone-300 px-6 py-10 text-center text-stone-400">
          No screening sessions yet. Create one to upload CVs against a job description.
        </p>
      )}

      {!loading && !error && sessions.length > 0 && (
        <div className="flex flex-col gap-4">
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
                      <button
                        onClick={() => handleRun(session.id, role.id)}
                        disabled={runningRoleId === role.id || session.candidateCount === 0}
                        className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800 transition hover:bg-sky-100 disabled:opacity-50"
                      >
                        {runningRoleId === role.id ? "Running…" : "Run screening"}
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
