"use client";

import { ParseDiagnostics } from "@/lib/types";

export default function DiagnosticsPopover({ diagnostics }: { diagnostics: ParseDiagnostics }) {
  if (diagnostics.skippedRows === 0) return null;

  return (
    <details className="relative">
      <summary className="cursor-pointer select-none list-none rounded-md border border-health-amber/40 bg-health-amber/10 px-2.5 py-1 text-xs text-health-amber [&::-webkit-details-marker]:hidden">
        {diagnostics.skippedRows} row{diagnostics.skippedRows === 1 ? "" : "s"} skipped
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-80 rounded-md border border-border bg-panel p-3 text-xs shadow-xl">
        <div className="text-text/70">
          Parsed {diagnostics.parsedRows} of {diagnostics.totalRows} rows. Skipped rows were missing both an
          Account ID and Account Name.
        </div>
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-text/50">
          {diagnostics.skippedReasons.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}
