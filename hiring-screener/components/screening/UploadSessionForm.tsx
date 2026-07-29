"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface RoleDraft {
  key: string;
  title: string;
  mode: "text" | "file";
  jdText: string;
  fileName: string | null;
  resolving: boolean;
  error: string | null;
}

function newRole(): RoleDraft {
  return {
    key: crypto.randomUUID(),
    title: "",
    mode: "text",
    jdText: "",
    fileName: null,
    resolving: false,
    error: null,
  };
}

async function uploadFile(file: File): Promise<{ url: string; filename: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  return { url: data.url, filename: data.filename };
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let index = 0;
  async function next(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
}

export function UploadSessionForm() {
  const router = useRouter();
  const [sessionName, setSessionName] = useState("");
  const [roles, setRoles] = useState<RoleDraft[]>([newRole()]);
  const [cvFiles, setCvFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ uploaded: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateRole(key: string, patch: Partial<RoleDraft>) {
    setRoles((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function handleJdFile(key: string, file: File) {
    updateRole(key, { resolving: true, error: null, fileName: file.name });
    try {
      const { url, filename } = await uploadFile(file);
      const res = await fetch("/api/screening/extract-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, filename }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to extract text");
      updateRole(key, { jdText: data.text, resolving: false });
    } catch (err) {
      updateRole(key, { resolving: false, error: err instanceof Error ? err.message : "Failed to read file" });
    }
  }

  function addRole() {
    setRoles((prev) => [...prev, newRole()]);
  }

  function removeRole(key: string) {
    setRoles((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }

  const canSubmit =
    sessionName.trim().length > 0 &&
    roles.every((r) => r.title.trim() && r.jdText.trim() && !r.resolving) &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      const sessionRes = await fetch("/api/screening/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: sessionName.trim(),
          roles: roles.map((r) => ({ title: r.title.trim(), jdText: r.jdText.trim() })),
        }),
      });
      const sessionData = await sessionRes.json();
      if (!sessionRes.ok) throw new Error(sessionData.error ?? "Failed to create session");
      const sessionId: string = sessionData.id;

      if (cvFiles.length > 0) {
        setProgress({ uploaded: 0, total: cvFiles.length });
        let uploaded = 0;
        await runWithConcurrency(cvFiles, 5, async (file) => {
          try {
            const { url, filename } = await uploadFile(file);
            await fetch(`/api/screening/sessions/${sessionId}/candidates`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cvUrl: url, cvFilename: filename }),
            });
          } catch {
            // individual CV failures don't block the rest of the batch — the recruiter
            // can inspect and re-upload from the session detail page
          } finally {
            uploaded++;
            setProgress({ uploaded, total: cvFiles.length });
          }
        });
      }

      router.push(`/admin/screening/${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold text-stone-950">New screening session</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Session name</label>
          <input
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="e.g. Backend Engineer — July batch"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber"
          />
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Roles / job descriptions</h2>
          {roles.map((role, i) => (
            <div key={role.key} className="rounded-lg border border-stone-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <input
                  value={role.title}
                  onChange={(e) => updateRole(role.key, { title: e.target.value })}
                  placeholder={`Role ${i + 1} title`}
                  className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm"
                />
                {roles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRole(role.key)}
                    className="text-xs font-medium text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="mb-2 flex gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => updateRole(role.key, { mode: "text" })}
                  className={`rounded-md px-2 py-1 ${role.mode === "text" ? "bg-amber/20 font-medium" : "text-stone-500"}`}
                >
                  Paste text
                </button>
                <button
                  type="button"
                  onClick={() => updateRole(role.key, { mode: "file" })}
                  className={`rounded-md px-2 py-1 ${role.mode === "file" ? "bg-amber/20 font-medium" : "text-stone-500"}`}
                >
                  Upload file
                </button>
              </div>

              {role.mode === "text" ? (
                <textarea
                  value={role.jdText}
                  onChange={(e) => updateRole(role.key, { jdText: e.target.value })}
                  rows={5}
                  placeholder="Paste the job description here…"
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
                />
              ) : (
                <div>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => e.target.files?.[0] && handleJdFile(role.key, e.target.files[0])}
                    className="text-sm"
                  />
                  {role.resolving && <p className="mt-1 text-xs text-stone-500">Extracting text…</p>}
                  {role.fileName && !role.resolving && !role.error && (
                    <p className="mt-1 text-xs text-emerald-700">
                      Loaded {role.fileName} ({role.jdText.length} chars)
                    </p>
                  )}
                  {role.error && <p className="mt-1 text-xs text-red-600">{role.error}</p>}
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addRole}
            className="self-start rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
          >
            + Add another role
          </button>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">CVs</label>
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            multiple
            onChange={(e) => setCvFiles(Array.from(e.target.files ?? []))}
            className="text-sm"
          />
          {cvFiles.length > 0 && <p className="mt-1 text-xs text-stone-500">{cvFiles.length} file(s) selected</p>}
        </div>

        {error && <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</p>}
        {progress && (
          <p className="text-sm text-stone-600">
            Uploading CVs… {progress.uploaded}/{progress.total}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="self-start rounded-md border border-amber bg-amber/10 px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-amber/20 disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create session"}
        </button>
      </form>
    </div>
  );
}
