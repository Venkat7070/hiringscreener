"use client";

import { useMemo, useState } from "react";
import { STAGES, type ScreeningCandidate, type ScreeningResult, type ScreeningRoleWithStatus, type Stage } from "@/lib/types";
import { ScoreBadge } from "@/components/shared/ScoreBadge";
import { StageSelect } from "@/components/shared/StageSelect";
import { TagEditor } from "@/components/shared/TagEditor";
import { runScreeningLoop } from "@/lib/runScreening";
import { runWithConcurrency } from "@/lib/concurrency";

const STATUS_STYLES: Record<string, string> = {
  pending: "border-stone-300 bg-stone-50 text-stone-600",
  partial: "border-amber bg-amber/10 text-stone-900",
  done: "border-emerald-300 bg-emerald-50 text-emerald-800",
};

export function RoleCandidateTable({
  sessionId,
  role,
  candidates,
  results,
  onReload,
}: {
  sessionId: string;
  role: ScreeningRoleWithStatus;
  candidates: ScreeningCandidate[];
  results: ScreeningResult[];
  onReload: () => Promise<void>;
}) {
  const [running, setRunning] = useState(false);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [rescope, setRescope] = useState<"new" | "all">("new");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [rescoringCandidateId, setRescoringCandidateId] = useState<string | null>(null);
  const [busyCandidateId, setBusyCandidateId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<Stage | "">("");
  const [tagFilter, setTagFilter] = useState("");
  const [minScoreOnly, setMinScoreOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStage, setBulkStage] = useState<Stage>("Screened");
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkRemoving, setBulkRemoving] = useState(false);
  const [expandedRationale, setExpandedRationale] = useState<Set<string>>(new Set());

  function toggleRationale(candidateId: string) {
    setExpandedRationale((prev) => {
      const next = new Set(prev);
      if (next.has(candidateId)) next.delete(candidateId);
      else next.add(candidateId);
      return next;
    });
  }

  const allRows = useMemo(
    () =>
      candidates.map((candidate) => ({
        candidate,
        result: results.find((r) => r.candidate_id === candidate.id && r.role_id === role.id) ?? null,
      })),
    [candidates, results, role.id]
  );

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const { result } of allRows) for (const t of result?.tags ?? []) set.add(t);
    return Array.from(set).sort();
  }, [allRows]);

  const rows = useMemo(() => {
    let list = allRows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(({ candidate }) => candidate.name.toLowerCase().includes(q));
    }
    if (stageFilter) list = list.filter(({ result }) => result?.stage === stageFilter);
    if (tagFilter) list = list.filter(({ result }) => result?.tags.includes(tagFilter));
    if (minScoreOnly) list = list.filter(({ result }) => (result?.ai_score ?? 0) >= 70);
    return [...list].sort((a, b) => (b.result?.ai_score ?? -1) - (a.result?.ai_score ?? -1));
  }, [allRows, search, stageFilter, tagFilter, minScoreOnly]);

  function toggleSelect(candidateId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(candidateId)) next.delete(candidateId);
      else next.add(candidateId);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.candidate.id))
    );
  }

  async function handleRun() {
    setRunning(true);
    await runScreeningLoop(
      sessionId,
      role.id,
      (update) => {
        if (update.error) {
          setRunStatus(update.error);
          return;
        }
        setRunStatus(
          `${update.scored + update.failed}/${update.totalCandidates} processed${
            update.rateLimited ? " — stopped early, click Run again" : ""
          }`
        );
        if (update.done) void onReload();
      },
      { force: rescope === "all" }
    );
    setRunning(false);
  }

  async function handleSaveComment(candidateId: string, comment: string) {
    await fetch(`/api/screening/sessions/${sessionId}/roles/${role.id}/candidates/${candidateId}/comment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    });
  }

  async function handleRowRescore(candidateId: string) {
    const comment = commentDrafts[candidateId];
    setRescoringCandidateId(candidateId);
    try {
      if (comment !== undefined) await handleSaveComment(candidateId, comment);
      await runScreeningLoop(sessionId, role.id, () => {}, { force: true, candidateIds: [candidateId] });
      await onReload();
    } finally {
      setRescoringCandidateId(null);
    }
  }

  async function handleDeleteCandidate(candidateId: string, name: string) {
    if (!confirm(`Remove ${name} from this session? This cannot be undone.`)) return;
    setBusyCandidateId(candidateId);
    try {
      const res = await fetch(`/api/screening/sessions/${sessionId}/candidates/${candidateId}`, { method: "DELETE" });
      if (res.ok) await onReload();
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
    if (res.ok) await onReload();
  }

  async function applyBulkStage() {
    const targets = rows.filter((r) => selectedIds.has(r.candidate.id) && r.result);
    if (targets.length === 0) return;
    setBulkApplying(true);
    try {
      await runWithConcurrency(targets, 4, async ({ result }) => {
        await fetch(`/api/screening/results/${result!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: bulkStage }),
        });
      });
      await onReload();
      setSelectedIds(new Set());
    } finally {
      setBulkApplying(false);
    }
  }

  async function removeSelected() {
    const targets = Array.from(selectedIds);
    if (targets.length === 0) return;
    if (!confirm(`Remove ${targets.length} candidate${targets.length === 1 ? "" : "s"} from this session? This cannot be undone.`)) {
      return;
    }
    setBulkRemoving(true);
    try {
      await runWithConcurrency(targets, 4, async (candidateId) => {
        await fetch(`/api/screening/sessions/${sessionId}/candidates/${candidateId}`, { method: "DELETE" });
      });
      await onReload();
      setSelectedIds(new Set());
    } finally {
      setBulkRemoving(false);
    }
  }

  return (
    <section className="rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium text-stone-900">{role.title}</h2>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[role.status]}`}>
            {role.status} ({role.scoredCount}/{role.candidateCount})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {runStatus && <span className="text-xs text-stone-500">{runStatus}</span>}
          <div className="flex overflow-hidden rounded-md border border-stone-300 text-xs">
            <button
              onClick={() => setRescope("new")}
              className={`px-2 py-1.5 font-medium transition ${
                rescope === "new" ? "bg-stone-200 text-stone-900" : "bg-white text-stone-500 hover:bg-stone-50"
              }`}
            >
              New only
            </button>
            <button
              onClick={() => setRescope("all")}
              className={`border-l border-stone-300 px-2 py-1.5 font-medium transition ${
                rescope === "all" ? "bg-stone-200 text-stone-900" : "bg-white text-stone-500 hover:bg-stone-50"
              }`}
            >
              All
            </button>
          </div>
          <button
            onClick={handleRun}
            disabled={running || candidates.length === 0}
            className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-800 transition hover:bg-sky-100 disabled:opacity-50"
          >
            {running ? "Running…" : `Rescore ${rescope === "all" ? "all" : "new"}`}
          </button>
          <a
            href={`/api/screening/sessions/${sessionId}/roles/${role.id}/export`}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-100"
          >
            Export CSV
          </a>
        </div>
      </div>

      {candidates.length === 0 ? (
        <p className="px-5 py-6 text-sm text-stone-400">No candidates uploaded to this session yet.</p>
      ) : (
        <>
          {(search || stageFilter || tagFilter || minScoreOnly) && (
            <div className="border-b border-stone-100 px-5 py-2 text-xs text-stone-400">
              {rows.length} match{rows.length === 1 ? "" : "es"}
            </div>
          )}

          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-stone-100 bg-amber/10 px-5 py-3">
              <span className="text-xs font-medium text-stone-800">{selectedIds.size} selected</span>
              <select
                value={bulkStage}
                onChange={(e) => setBulkStage(e.target.value as Stage)}
                className="rounded-md border border-stone-300 px-2 py-1 text-xs"
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                onClick={applyBulkStage}
                disabled={bulkApplying}
                className="rounded-md bg-stone-950 px-3 py-1 text-xs font-medium text-white transition hover:bg-stone-800 disabled:opacity-50"
              >
                {bulkApplying ? "Applying…" : "Apply stage to selected"}
              </button>
              <button
                onClick={removeSelected}
                disabled={bulkRemoving}
                className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                {bulkRemoving ? "Removing…" : "Remove selected"}
              </button>
            </div>
          )}

          {rows.length === 0 ? (
            <p className="px-5 py-6 text-sm text-stone-400">No candidates match these filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
                  <tr>
                    <th className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.size > 0 && selectedIds.size === rows.length}
                        onChange={toggleSelectAll}
                        className="accent-amber"
                      />
                    </th>
                    <th className="px-4 py-2">
                      <div className="flex flex-col gap-1.5">
                        Name
                        <input
                          type="text"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search…"
                          className="w-full rounded-md border border-stone-300 px-1.5 py-1 text-[11px] normal-case text-stone-700"
                        />
                      </div>
                    </th>
                    <th className="px-4 py-2">CV</th>
                    <th className="px-4 py-2">
                      <div className="flex flex-col gap-1.5">
                        Score
                        <label className="flex items-center gap-1 normal-case text-stone-600">
                          <input
                            type="checkbox"
                            checked={minScoreOnly}
                            onChange={(e) => setMinScoreOnly(e.target.checked)}
                            className="accent-amber"
                          />
                          ≥70
                        </label>
                      </div>
                    </th>
                    <th className="px-4 py-2">Recommended</th>
                    <th className="px-4 py-2">Rationale</th>
                    <th className="px-4 py-2">
                      <div className="flex flex-col gap-1.5">
                        Stage
                        <select
                          value={stageFilter}
                          onChange={(e) => setStageFilter(e.target.value as Stage | "")}
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
                    <th className="px-4 py-2">
                      <div className="flex flex-col gap-1.5">
                        Tags
                        <select
                          value={tagFilter}
                          onChange={(e) => setTagFilter(e.target.value)}
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
                    <th className="px-4 py-2">Comments</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ candidate, result }) => (
                    <tr key={candidate.id} className="border-b border-stone-50">
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(candidate.id)}
                          onChange={() => toggleSelect(candidate.id)}
                          className="accent-amber"
                        />
                      </td>
                      <td className="px-4 py-2.5 font-medium text-stone-900">{candidate.name}</td>
                      <td className="px-4 py-2.5">
                        <a href={candidate.cv_url} target="_blank" rel="noreferrer" className="text-amber-dark hover:underline">
                          {candidate.cv_filename}
                        </a>
                        {candidate.cv_text_error && <p className="text-xs text-red-600">{candidate.cv_text_error}</p>}
                      </td>
                      <td className="px-4 py-2.5">
                        <ScoreBadge score={result?.ai_score ?? null} />
                      </td>
                      <td className="px-4 py-2.5 text-stone-700">{result?.ai_recommended_stage ?? "—"}</td>
                      <td className="max-w-xs px-4 py-2.5 text-stone-500">
                        {result?.ai_rationale ? (
                          <button
                            type="button"
                            onClick={() => toggleRationale(candidate.id)}
                            className="block text-left hover:text-stone-800"
                            title={expandedRationale.has(candidate.id) ? "Click to collapse" : "Click to expand"}
                          >
                            <span className={expandedRationale.has(candidate.id) ? "whitespace-pre-wrap" : "line-clamp-2"}>
                              {result.ai_rationale}
                            </span>
                            <span className="mt-0.5 block text-[11px] font-medium text-sky-700">
                              {expandedRationale.has(candidate.id) ? "Show less" : "Show more"}
                            </span>
                          </button>
                        ) : (
                          <span>Not yet screened</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {result ? (
                          <StageSelect value={result.stage} onChange={(stage) => handleResultUpdate(result.id, { stage })} />
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
                            value={commentDrafts[candidate.id] ?? result?.recruiter_comment ?? ""}
                            onChange={(e) =>
                              setCommentDrafts((prev) => ({ ...prev, [candidate.id]: e.target.value }))
                            }
                            onBlur={(e) => {
                              if (e.target.value !== (result?.recruiter_comment ?? "")) {
                                void handleSaveComment(candidate.id, e.target.value);
                              }
                            }}
                            rows={2}
                            placeholder="Add a note…"
                            className="w-40 resize-y rounded-md border border-stone-200 px-2 py-1 text-xs focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber"
                          />
                          <button
                            onClick={() => handleRowRescore(candidate.id)}
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
        </>
      )}
    </section>
  );
}
