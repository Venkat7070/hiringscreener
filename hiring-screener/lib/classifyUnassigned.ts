export interface ClassifyUpdate {
  classified: number;
  classifiedNone: number;
  skipped: number;
  failed: number;
  totalCandidates: number;
  done: boolean;
  error?: string;
}

const BATCH_SIZE = 3;

/** Chunks the given application ids and drives /api/applications/classify-unassigned to completion. */
export async function runClassifyLoop(
  ids: string[],
  onUpdate: (update: ClassifyUpdate) => void
): Promise<void> {
  let classified = 0;
  let classifiedNone = 0;
  let skipped = 0;
  let failed = 0;

  try {
    for (let offset = 0; offset < ids.length; offset += BATCH_SIZE) {
      const batch = ids.slice(offset, offset + BATCH_SIZE);
      const res = await fetch("/api/applications/classify-unassigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: batch }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error("Request timed out or failed — try again with fewer selected.");
      }
      if (!res.ok) throw new Error(data.error ?? "Classification failed");

      classified += data.classified;
      classifiedNone += data.classifiedNone;
      skipped += data.skipped;
      failed += data.failed;

      onUpdate({
        classified,
        classifiedNone,
        skipped,
        failed,
        totalCandidates: ids.length,
        done: offset + BATCH_SIZE >= ids.length,
      });
    }
  } catch (error) {
    onUpdate({
      classified,
      classifiedNone,
      skipped,
      failed,
      totalCandidates: ids.length,
      done: true,
      error: error instanceof Error ? error.message : "Classification failed",
    });
  }
}
