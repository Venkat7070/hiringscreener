"use client";

import { useEffect, useRef, useState } from "react";
import type { ScreeningSessionDetail } from "@/lib/types";
import { RoleCandidateTable } from "@/components/screening/RoleCandidateTable";
import { runWithConcurrency } from "@/lib/concurrency";
import { uploadFile } from "@/lib/uploadFile";

export function SessionDetail({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<ScreeningSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingCvs, setAddingCvs] = useState(false);
  const [addCvProgress, setAddCvProgress] = useState<{ uploaded: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function handleAddCvs(files: FileList | null) {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    setAddingCvs(true);
    setAddCvProgress({ uploaded: 0, total: fileArray.length });
    let uploaded = 0;
    await runWithConcurrency(fileArray, 5, async (file) => {
      try {
        const { url, filename } = await uploadFile(file);
        await fetch(`/api/screening/sessions/${sessionId}/candidates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cvUrl: url, cvFilename: filename }),
        });
      } catch {
        // individual CV failures don't block the rest of the batch
      } finally {
        uploaded++;
        setAddCvProgress({ uploaded, total: fileArray.length });
      }
    });
    await load();
    setAddingCvs(false);
    setAddCvProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-stone-950">{session.name}</h1>
          <span className="text-xs text-stone-400">
            {new Date(session.created_at).toLocaleDateString()} · {session.candidates.length} candidate
            {session.candidates.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {addCvProgress && (
            <span className="text-xs text-stone-500">
              Uploading… {addCvProgress.uploaded}/{addCvProgress.total}
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            multiple
            onChange={(e) => handleAddCvs(e.target.files)}
            disabled={addingCvs}
            className="hidden"
            id="add-cvs-input"
          />
          <label
            htmlFor="add-cvs-input"
            className={`cursor-pointer rounded-md border border-amber bg-amber/10 px-3 py-1.5 text-sm font-medium text-stone-900 transition hover:bg-amber/20 ${
              addingCvs ? "pointer-events-none opacity-50" : ""
            }`}
          >
            {addingCvs ? "Uploading…" : "+ Add CVs"}
          </label>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-8">
        {session.roles.map((role) => (
          <RoleCandidateTable
            key={role.id}
            sessionId={sessionId}
            role={role}
            candidates={session.candidates}
            results={session.results}
            onReload={load}
          />
        ))}
      </div>
    </div>
  );
}
