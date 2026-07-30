"use client";

import { useEffect, useState } from "react";
import type { ScreeningSessionDetail, ScreeningResult, Stage } from "@/lib/types";
import { ScoreBadge } from "@/components/shared/ScoreBadge";
import { StageSelect } from "@/components/shared/StageSelect";
import { TagEditor } from "@/components/shared/TagEditor";
import { runScreeningLoop } from "@/lib/runScreening";

const STATUS_STYLES: Record<string, string> = {
  pending: "border-stone-300 bg-stone-50 text-stone-600",
  partial: "border-amber bg-amber/10 text-stone-900",
  done: "border-emerald-300 bg-emerald-50 text-emerald-800",
};

export function SessionDetail({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<ScreeningSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningRoleId, setRunningRoleId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<Record<string, string>>({});
  const [busyCandidateId, setBusyCandidateId] = useState<string | null>(null);
  const [rescopeByRole, setRescopeByRole] = useState<Record<string, "new" | "all">>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [rescoringCandidateId, setRescoringCandidateId] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const res = await fetch(`/api/screening/sessions/${sessionId}`);
      if (!res.ok) throw new Error("Failed to load session");
      const data = await res.json();
      setSession(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function handleRun(roleId: string) {
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
        if (update.done) void load();
      },
      { force: scope === "all" }
    );
    setRunningRoleId(null);
  }

  async function handleSaveComment(candidateId: string, roleId: string, comment: string) {
    const res = await fetch(
      `/api/screening/sessions/${sessionId}/roles/${roleId}/candidates/${candidateId}/comment`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      setSession((prev) =>
        prev
          ? {
              ...prev,
              results: prev.results.some((r) => r.candidate_id === candidateId && r.role_id === roleId)
                ? prev.results.map((r) =>
                    r.candidate_id === candidateId && r.role_id === roleId ? (data.result as ScreeningResult) : r
                  )
                : [...prev.results, data.result as ScreeningResult],
            }
          : prev
      );
    }
  }

  async function handleRowRescore(candidateId: string, roleId: string) {
    const comment = commentDrafts[`${roleId}:${candidateId}`];
    setRescoringCandidateId(candidateId);
    try {
      if (comment !== undefined) {
        await handleSaveComment(candidateId, roleId, comment);
      }
      await runScreeningLoop(sessionId, roleId, () => {}, { force: true, candidateIds: [candidateId] });
      await load();
    } finally {
      setRescoringCandidateId(null);
    }
  }

  async function handleDeleteCandidate(candidateId: string, name: string) {
    if (!confirm(`Remove ${name} from this session? This cannot be undone.`)) return;
    setBusyCandidateId(candidateId);
    try {
      const res = await fetch(`/api/screening/sessions/${sessionId}/candidates/${candidateId}`, {
        method: "DELETE",
      });
      if (res.ok) await load();
    } finally {
      setBusyCandidateId(null);
    }
  }

  async function handleResultUpdate(resultId: string, patch: { stage?: Stage; tags?: string[] }) {
    const res = await fetch(`/api/screening/results/${resultId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = await res.json();
      setSession((prev) =>
        prev
          ? { ...prev, results: prev.results.map((r) => (r.id === resultId ? (data.result as ScreeningResult) : r)) }
          : prev
      );
    }
  }

  if (loading) return <div className="mx-auto max-w-6xl px-6 py-10 text-stone-500">Loading…</div>;
  if (error || !session)
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error ?? "Session not found"}
        </p>
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold text-stone-950">{session.name}</h1>
        <span className="text-xs text-stone-400">
          {new Date(session.created_at).toLocaleDateString()} · {session.candidates.length} candidate
          {session.candidates.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-8 flex flex-col gap-8">
        {session.roles.map((role) => {
          const rows = session.candidates.map((candidate) => ({
            candidate,
            result: session.results.find((r) => r.candidate_id === candidate.id && r.role_id === role.id) ?? null,
          }));
          rows.sort((a, b) => (b.result?.ai_score ?? -1) - (a.result?.ai_score ?? -1));

          return (
            <section key={role.id} className="rounded-xl border border-stone-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-medium text-stone-900">{role.title}</h2>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[role.status]}`}
                  >
                    {role.status} ({role.scoredCount}/{role.candidateCount})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {runStatus[role.id] && <span className="text-xs text-stone-500">{runStatus[role.id]}</span>}
                  <div className="flex overflow-hidden rounded-md border border-stone-300 text-xs">
                    <button
                      onClick={() => setRescopeByRole((prev) => ({ ...prev, [role.id]: "new" }))}
                      className={`px-2 py-1.5 font-medium transition ${
                        (rescopeByRole[role.id] ?? "new") === "new"
                          ? "bg-stone-200 text-stone-900"
                          : "bg-white text-stone-500 hover:bg-stone-50"
                      }`}
                    >
                      New only
                    </button>
                    <button
                      onClick={() => setRescopeByRole((prev) => ({ ...prev, [role.id]: "all" }))}
                      className={`border-l border-stone-300 px-2 py-1.5 font-medium transition ${
                        rescopeByRole[role.id] === "all"
                          ? "bg-stone-200 text-stone-900"
                          : "bg-white text-stone-500 hover:bg-stone-50"
                      }`}
                    >
                      All
                    </button>
                  </div>
                  <button
                    onClick={() => handleRun(role.id)}
                    disabled={runningRoleId === role.id || session.candidates.length === 0}
                    className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-800 transition hover:bg-sky-100 disabled:opacity-50"
                  >
                    {runningRoleId === role.id
                      ? "Running…"
                      : `Rescore ${(rescopeByRole[role.id] ?? "new") === "all" ? "all" : "new"}`}
                  </button>
                </div>
              </div>

              {rows.length === 0 ? (
                <p className="px-5 py-6 text-sm text-stone-400">No candidates uploaded to this session yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-stone-100 text-xs uppercase text-stone-500">
                      <tr>
                        <th className="px-4 py-2">Name</th>
                        <th className="px-4 py-2">CV</th>
                        <th className="px-4 py-2">Score</th>
                        <th className="px-4 py-2">Recommended</th>
                        <th className="px-4 py-2">Rationale</th>
                        <th className="px-4 py-2">Stage</th>
                        <th className="px-4 py-2">Tags</th>
                        <th className="px-4 py-2">Comments</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ candidate, result }) => (
                        <tr key={candidate.id} className="border-b border-stone-50">
                          <td className="px-4 py-2.5 font-medium text-stone-900">{candidate.name}</td>
                          <td className="px-4 py-2.5">
                            <a
                              href={candidate.cv_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-amber-dark hover:underline"
                            >
                              {candidate.cv_filename}
                            </a>
                            {candidate.cv_text_error && (
                              <p className="text-xs text-red-600">{candidate.cv_text_error}</p>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <ScoreBadge score={result?.ai_score ?? null} />
                          </td>
                          <td className="px-4 py-2.5 text-stone-700">{result?.ai_recommended_stage ?? "—"}</td>
                          <td className="max-w-xs px-4 py-2.5 text-stone-500">
                            <span className="line-clamp-2" title={result?.ai_rationale ?? undefined}>
                              {result?.ai_rationale ?? "Not yet screened"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            {result ? (
                              <StageSelect
                                value={result.stage}
                                onChange={(stage) => handleResultUpdate(result.id, { stage })}
                              />
                            ) : (
                              <span className="text-stone-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            {result ? (
                              <TagEditor tags={result.tags} onChange={(tags) => handleResultUpdate(result.id, { tags })} />
                            ) : (
                              <span className="text-stone-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-col gap-1.5">
                              <textarea
                                value={
                                  commentDrafts[`${role.id}:${candidate.id}`] ?? result?.recruiter_comment ?? ""
                                }
                                onChange={(e) =>
                                  setCommentDrafts((prev) => ({
                                    ...prev,
                                    [`${role.id}:${candidate.id}`]: e.target.value,
                                  }))
                                }
                                onBlur={(e) => {
                                  if (e.target.value !== (result?.recruiter_comment ?? "")) {
                                    void handleSaveComment(candidate.id, role.id, e.target.value);
                                  }
                                }}
                                rows={2}
                                placeholder="Add a note…"
                                className="w-40 resize-y rounded-md border border-stone-200 px-2 py-1 text-xs focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber"
                              />
                              <button
                                onClick={() => handleRowRescore(candidate.id, role.id)}
                                disabled={rescoringCandidateId === candidate.id || !candidate.cv_text}
                                className="self-start rounded-md border border-sky-300 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800 transition hover:bg-sky-100 disabled:opacity-50"
                              >
                                {rescoringCandidateId === candidate.id ? "Scoring…" : "Rescore"}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <button
                              onClick={() => handleDeleteCandidate(candidate.id, candidate.name)}
                              disabled={busyCandidateId === candidate.id}
                              className="rounded-md px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
