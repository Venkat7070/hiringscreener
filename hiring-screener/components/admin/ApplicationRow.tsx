"use client";

import { useEffect, useState } from "react";
import { ROLE_LIST, type Role } from "@/lib/roles";
import { type ApplicationRecord, type Stage } from "@/lib/types";
import { ScoreBadge } from "@/components/shared/ScoreBadge";
import { StageSelect } from "@/components/shared/StageSelect";
import { TagEditor } from "@/components/shared/TagEditor";

export function ApplicationRow({
  serial,
  application,
  selected,
  onToggleSelect,
  onUpdated,
  onDeleted,
}: {
  serial: number;
  application: ApplicationRecord;
  selected: boolean;
  onToggleSelect: () => void;
  onUpdated: (application: ApplicationRecord) => void;
  onDeleted: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rescoreError, setRescoreError] = useState<string | null>(null);
  const [locationDraft, setLocationDraft] = useState(application.location ?? "");

  useEffect(() => {
    setLocationDraft(application.location ?? "");
  }, [application.location]);

  async function updateTags(tags: string[]) {
    setBusy(true);
    try {
      const res = await fetch(`/api/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdated(data.application);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleStageChange(stage: Stage) {
    setBusy(true);
    try {
      const res = await fetch(`/api/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdated(data.application);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleChange(role: Role) {
    setBusy(true);
    try {
      const res = await fetch(`/api/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdated(data.application);
      }
    } finally {
      setBusy(false);
    }
  }

  async function commitLocation() {
    const trimmed = locationDraft.trim();
    if (trimmed === (application.location ?? "")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: trimmed || null }),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdated(data.application);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete application from ${application.name}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/applications/${application.id}`, { method: "DELETE" });
      if (res.ok) onDeleted(application.id);
    } finally {
      setBusy(false);
    }
  }

  async function handleRescore() {
    setBusy(true);
    setRescoreError(null);
    try {
      const res = await fetch(`/api/applications/${application.id}/rescore`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Re-score failed");
      onUpdated(data.application);
    } catch (error) {
      setRescoreError(error instanceof Error ? error.message : "Re-score failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <tr className="border-b border-stone-100 text-sm transition-colors hover:bg-stone-50/80">
        <td className="px-3 py-3 text-stone-400">{serial}</td>
        <td className="px-3 py-3">
          <input type="checkbox" checked={selected} onChange={onToggleSelect} className="accent-amber" />
        </td>
        <td className="px-3 py-3 font-medium text-stone-900">
          {application.name}
          {application.source === "linkedin" && (
            <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
              LinkedIn
            </span>
          )}
        </td>
        <td className="px-3 py-3">
          {application.linkedin ? (
            <a
              href={application.linkedin}
              target="_blank"
              rel="noreferrer"
              className="text-amber-dark hover:underline"
              title="LinkedIn profile"
            >
              🔗
            </a>
          ) : (
            <span className="text-stone-300">—</span>
          )}
        </td>
        <td className="px-3 py-3 text-stone-700">
          <input
            type="text"
            value={locationDraft}
            disabled={busy}
            onChange={(e) => setLocationDraft(e.target.value)}
            onBlur={commitLocation}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="—"
            title="Extracted from CV — edit if wrong"
            className="w-28 rounded-md border border-stone-300 px-2 py-1 text-xs"
          />
        </td>
        <td className="px-3 py-3 text-stone-700">
          <select
            value={application.role ?? ""}
            disabled={busy}
            onChange={(e) => handleRoleChange(e.target.value as Role)}
            className="rounded-md border border-stone-300 px-2 py-1 text-xs"
            title="Retag the role if it was mis-assigned"
          >
            <option value="" disabled>
              Assign role…
            </option>
            {ROLE_LIST.map((r) => (
              <option key={r.key} value={r.key}>
                {r.title}
              </option>
            ))}
          </select>
        </td>
        <td className="px-3 py-3">
          <ScoreBadge score={application.mechanical_score} />
        </td>
        <td className="px-3 py-3">
          <ScoreBadge score={application.ai_score} />
        </td>
        <td className="px-3 py-3">
          <StageSelect value={application.stage} onChange={handleStageChange} disabled={busy} />
        </td>
        <td className="px-3 py-3">
          <TagEditor tags={application.tags} onChange={updateTags} disabled={busy} />
        </td>
        <td className="px-3 py-3">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-md border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-600 transition hover:border-stone-300 hover:bg-stone-100 hover:text-stone-900"
          >
            {expanded ? "Hide" : "Details"}
          </button>
        </td>
        <td className="px-3 py-3">
          <button
            onClick={handleDelete}
            disabled={busy}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
          >
            Delete
          </button>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-stone-100 bg-stone-50 text-sm">
          <td colSpan={12} className="px-6 py-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-stone-200 bg-white p-4">
                {application.answers.length > 0 ? (
                  <>
                    <h4 className="mb-2 font-medium text-stone-800">Screening answers</h4>
                    <ul className="flex flex-col gap-2">
                      {application.answers.map((a) => (
                        <li key={a.id} className="text-stone-700">
                          <span className="block text-xs text-stone-500">{a.question}</span>
                          <span className="font-medium">
                            {a.answer} <span className="text-stone-400">({a.points} pts)</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  application.source === "linkedin" && (
                    <p className="text-stone-500">Sent via LinkedIn — no screening answers yet.</p>
                  )
                )}

                {application.free_text && (
                  <div className="mt-4">
                    <h4 className="mb-1 font-medium text-stone-800">
                      {application.source === "linkedin" ? "Message sent with CV" : "Free-text answer"}
                    </h4>
                    <p className="whitespace-pre-wrap text-stone-700">{application.free_text}</p>
                  </div>
                )}

                {application.location_choice && (
                  <div className="mt-4">
                    <h4 className="mb-1 font-medium text-stone-800">Location preference</h4>
                    <p className="text-stone-700">{application.location_choice}</p>
                  </div>
                )}

                {application.cv_url && (
                  <div className="mt-4">
                    <a
                      href={application.cv_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-dark hover:underline"
                    >
                      Download CV{application.cv_filename ? ` (${application.cv_filename})` : ""}
                    </a>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-stone-200 bg-white p-4">
                <h4 className="mb-2 font-medium text-stone-800">AI assessment</h4>
                {application.ai_score !== null ? (
                  <div className="flex flex-col gap-2 text-stone-700">
                    <p className="flex items-center gap-2">
                      <span className="font-medium">Score:</span>
                      <ScoreBadge score={application.ai_score} />
                    </p>
                    <p>
                      <span className="font-medium">Recommended stage:</span>{" "}
                      {application.ai_recommended_stage}
                    </p>
                    <p>
                      <span className="font-medium">Rationale:</span> {application.ai_rationale}
                    </p>
                  </div>
                ) : (
                  <p className="text-stone-500">Not yet scored.</p>
                )}

                {rescoreError && <p className="mt-2 text-red-600">{rescoreError}</p>}

                <button
                  onClick={handleRescore}
                  disabled={busy || !application.role}
                  title={application.role ? undefined : "Assign a role first"}
                  className="mt-4 rounded-md border border-amber px-3 py-1.5 text-sm font-medium text-stone-900 transition hover:bg-amber/10 disabled:opacity-50"
                >
                  {busy ? "Working..." : "Re-score with AI"}
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
