"use client";

import { useState } from "react";
import { STAGES, type Stage } from "@/lib/types";

export function BulkActionBar({
  selectedCount,
  onApply,
}: {
  selectedCount: number;
  onApply: (stage: Stage) => Promise<void>;
}) {
  const [stage, setStage] = useState<Stage>("Screened");
  const [applying, setApplying] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-md border border-amber bg-amber/10 px-4 py-3">
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
    </div>
  );
}
