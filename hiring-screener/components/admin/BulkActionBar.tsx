"use client";

import { useState } from "react";
import { STAGES, type Stage } from "@/lib/types";

export function BulkActionBar({
  selectedCount,
  onApply,
  onRescore,
  rescoring,
  rescoreProgress,
  onClassify,
  classifying,
  classifyProgress,
}: {
  selectedCount: number;
  onApply: (stage: Stage) => Promise<void>;
  onRescore: () => Promise<void>;
  rescoring: boolean;
  rescoreProgress: string | null;
  onClassify: () => Promise<void>;
  classifying: boolean;
  classifyProgress: string | null;
}) {
  const [stage, setStage] = useState<Stage>("Screened");
  const [applying, setApplying] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-amber bg-amber/10 px-4 py-3">
      <span className="text-sm font-medium text-stone-800">{selectedCount} selected</span>
      <select
        value={stage}
        onChange={(e) => setStage(e.target.value as Stage)}
        className="rounded-md border border-stone-300 px-2 py-1 text-sm"
      >
        {STAGES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button
        onClick={async () => {
          setApplying(true);
          await onApply(stage);
          setApplying(false);
        }}
        disabled={applying}
        className="rounded-md bg-stone-950 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-50"
      >
        {applying ? "Applying..." : "Apply to selected"}
      </button>
      <span className="h-5 w-px bg-amber-dark/40" />
      <button
        onClick={onRescore}
        disabled={rescoring}
        className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-800 transition hover:bg-sky-100 disabled:opacity-50"
      >
        {rescoring ? "Rescoring…" : "Rescore selected with AI"}
      </button>
      {rescoreProgress && <span className="text-xs text-stone-600">{rescoreProgress}</span>}
      <span className="h-5 w-px bg-amber-dark/40" />
      <button
        onClick={onClassify}
        disabled={classifying}
        title="Reads each selected CV/application (that has no role yet) and picks the best-fit role"
        className="rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-800 transition hover:bg-violet-100 disabled:opacity-50"
      >
        {classifying ? "Classifying…" : "Assign role from CV (AI)"}
      </button>
      {classifyProgress && <span className="text-xs text-stone-600">{classifyProgress}</span>}
    </div>
  );
}
