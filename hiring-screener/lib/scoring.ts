import { ROLES, type Role } from "./roles";
import type { AnsweredQuestion } from "./types";

export class ScoringError extends Error {}

export function scoreAnswers(
  role: Role,
  submittedAnswers: { id: string; answer: string }[]
): { answers: AnsweredQuestion[]; mechanicalScore: number } {
  const config = ROLES[role];
  const answers: AnsweredQuestion[] = [];

  for (const q of config.questions) {
    const submitted = submittedAnswers.find((a) => a.id === q.id);
    if (!submitted) {
      throw new ScoringError(`Missing answer for question ${q.id}`);
    }
    const option = q.options.find((o) => o.label === submitted.answer);
    if (!option) {
      throw new ScoringError(`Invalid answer for question ${q.id}`);
    }
    answers.push({
      id: q.id,
      question: q.question,
      answer: option.label,
      points: option.points,
    });
  }

  const mechanicalScore = answers.reduce((sum, a) => sum + a.points, 0);
  return { answers, mechanicalScore };
}
