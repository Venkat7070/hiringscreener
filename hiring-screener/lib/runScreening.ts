export interface RunScreeningUpdate {
  scored: number;
  failed: number;
  totalCandidates: number;
  done: boolean;
  rateLimited: boolean;
  error?: string;
}

/**
 * Drives the chunked /api/screening/.../run endpoint to completion, mirroring
 * handleSyncLinkedIn's offset-loop in AdminDashboard.tsx. Calls onUpdate after every
 * batch so the caller can render live progress.
 */
export interface RunScreeningOptions {
  /** Rescore even candidates that already have a score. */
  force?: boolean;
  /** Restrict the run to these candidate IDs instead of the whole session. */
  candidateIds?: string[];
}

export async function runScreeningLoop(
  sessionId: string,
  roleId: string,
  onUpdate: (update: RunScreeningUpdate) => void,
  options: RunScreeningOptions = {}
): Promise<void> {
  let offset = 0;
  let scored = 0;
  let failed = 0;
  const MAX_ROUNDS = 200;

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const res = await fetch(
        `/api/screening/sessions/${sessionId}/roles/${roleId}/run?offset=${offset}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force: options.force, candidateIds: options.candidateIds }),
        }
      );
      let data;
      try {
        data = await res.json();
      } catch {
        // A platform-level failure (e.g. the function hit its execution time limit)
        // returns a plain-text error page instead of JSON — surface a clear message
        // rather than the raw JSON-parse error.
        throw new Error(
          res.status === 504 || !res.ok
            ? "Request timed out or failed — try again with a smaller batch, or click Rescore again to resume."
            : "Run failed"
        );
      }
      if (!res.ok) throw new Error(data.error ?? "Run failed");

      scored += data.scored;
      failed += data.failed;

      if (data.rateLimited) {
        onUpdate({ scored, failed, totalCandidates: data.totalCandidates, done: true, rateLimited: true });
        return;
      }

      onUpdate({ scored, failed, totalCandidates: data.totalCandidates, done: !data.truncated, rateLimited: false });

      if (!data.truncated) return;
      offset = data.nextOffset;
    }
  } catch (error) {
    onUpdate({
      scored,
      failed,
      totalCandidates: 0,
      done: true,
      rateLimited: false,
      error: error instanceof Error ? error.message : "Run failed",
    });
  }
}
