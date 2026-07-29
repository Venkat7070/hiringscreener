import { sql } from "./db";
import { scoreWithGroq } from "./groq";
import type { Role } from "./roles";
import type { AnsweredQuestion } from "./types";

async function performScoring(
  id: string,
  role: Role,
  answers: AnsweredQuestion[],
  freeText: string
): Promise<void> {
  const result = await scoreWithGroq(role, answers, freeText);
  await sql`
    UPDATE applications
    SET ai_score = ${result.score},
        ai_rationale = ${result.rationale},
        ai_recommended_stage = ${result.recommendedStage}
    WHERE id = ${id}
  `;
}

/** Fire-and-forget scoring used right after a candidate submits. Never throws. */
export async function runBackgroundScoring(
  id: string,
  role: Role,
  answers: AnsweredQuestion[],
  freeText: string
): Promise<void> {
  try {
    await performScoring(id, role, answers, freeText);
  } catch (error) {
    console.error(`AI scoring failed for application ${id}:`, error);
  }
}

/** Synchronous re-score used by the admin "Re-score" button. Throws on failure. */
export async function rescoreApplication(
  id: string,
  role: Role,
  answers: AnsweredQuestion[],
  freeText: string
): Promise<void> {
  await performScoring(id, role, answers, freeText);
}
