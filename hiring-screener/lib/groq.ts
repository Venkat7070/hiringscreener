import Groq from "groq-sdk";
import { ROLES, type Role } from "./roles";
import type { AnsweredQuestion, RecommendedStage } from "./types";
import { capFinalYearStage } from "./finalYearPenalty";

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

export class GroqScoringError extends Error {}

export interface GroqScoringResult {
  score: number;
  rationale: string;
  recommendedStage: RecommendedStage;
}

function buildPrompt(role: Role, answers: AnsweredQuestion[], freeText: string): string {
  const config = ROLES[role];

  const qa = answers
    .map((a, i) => `Q${i + 1}: ${a.question}\nCandidate's answer: ${a.answer} (${a.points} pts, mechanical)`)
    .join("\n\n");

  return `You are screening a candidate for the role of "${config.title}" at Yellow.ai, a Forward Deployed hiring track.

IDEAL CANDIDATE CRITERIA:
${config.criteria}

The candidate answered these multiple-choice screening questions (points shown are mechanical, pre-computed — do not just repeat them, judge holistically):

${qa}

Free-text answer to: "${config.freeTextQuestion}"
"""
${freeText || "(no answer provided)"}
"""

Judge the candidate holistically based on answer quality, specificity, and genuine fit against the ideal candidate criteria above — not just keyword matching or the mechanical points. Weigh the free-text answer heavily since it's the best signal of real experience and communication ability.

If the candidate indicates they are still currently completing their final year of study rather than already graduated — phrases like "final year", "final-year", "7th semester", "8th sem", "currently pursuing", "final semester", "3rd/4th year", or similar — subtract 15 points from the score you would otherwise give, since they're less immediately available than a graduate. Regardless of how high the resulting score is, never recommend "Shortlist" as the stage for a candidate who is still studying rather than graduated — cap it at "Borderline" at most. Reflect this in your rationale when it applies.

Respond with strict JSON only, matching exactly this shape:
{"score": <integer 0-100>, "rationale": "<2-3 sentences explaining the score>", "recommended_stage": "Shortlist" | "Borderline" | "Reject"}`;
}

function parseResponse(raw: string): GroqScoringResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GroqScoringError(`Groq returned non-JSON response: ${raw.slice(0, 200)}`);
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).score !== "number" ||
    typeof (parsed as Record<string, unknown>).rationale !== "string" ||
    typeof (parsed as Record<string, unknown>).recommended_stage !== "string"
  ) {
    throw new GroqScoringError(`Groq JSON missing required fields: ${raw.slice(0, 200)}`);
  }

  const obj = parsed as {
    score: number;
    rationale: string;
    recommended_stage: string;
  };

  const stage = obj.recommended_stage as RecommendedStage;
  if (stage !== "Shortlist" && stage !== "Borderline" && stage !== "Reject") {
    throw new GroqScoringError(`Groq returned unknown recommended_stage: ${obj.recommended_stage}`);
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(obj.score))),
    rationale: obj.rationale,
    recommendedStage: stage,
  };
}

export async function scoreWithGroq(
  role: Role,
  answers: AnsweredQuestion[],
  freeText: string
): Promise<GroqScoringResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new GroqScoringError("GROQ_API_KEY env var is not set");
  }

  const groq = new Groq({ apiKey });
  const prompt = buildPrompt(role, answers, freeText);

  let response;
  try {
    response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 1024,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });
  } catch (error) {
    throw new GroqScoringError(`Groq API error: ${error instanceof Error ? error.message : String(error)}`);
  }

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new GroqScoringError(`Groq response missing text: ${JSON.stringify(response).slice(0, 300)}`);
  }

  const result = parseResponse(text);
  return { ...result, recommendedStage: capFinalYearStage(result.recommendedStage, freeText) };
}

export interface JdScoringResult extends GroqScoringResult {
  candidateName: string | null;
}

function buildJdPrompt(jdText: string, cvText: string): string {
  return `You are screening a candidate's CV against a job description.

JOB DESCRIPTION:
"""
${jdText}
"""

CANDIDATE'S CV/RESUME TEXT:
"""
${cvText}
"""

Judge the candidate holistically based on genuine fit against the job description — skills, experience, seniority, and specificity of accomplishments. Also extract the candidate's full name as it appears on the CV, if identifiable.

If the candidate indicates they are still currently completing their final year of study rather than already graduated — phrases like "final year", "final-year", "7th semester", "8th sem", "currently pursuing", "final semester", "3rd/4th year", or similar — subtract 15 points from the score you would otherwise give, since they're less immediately available than a graduate. Regardless of how high the resulting score is, never recommend "Shortlist" as the stage for a candidate who is still studying rather than graduated — cap it at "Borderline" at most. Reflect this in your rationale when it applies.

Respond with strict JSON only, matching exactly this shape:
{"score": <integer 0-100>, "rationale": "<2-3 sentences explaining the score>", "recommended_stage": "Shortlist" | "Borderline" | "Reject", "candidate_name": "<full name>" | null}`;
}

function parseJdResponse(raw: string): JdScoringResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GroqScoringError(`Groq returned non-JSON response: ${raw.slice(0, 200)}`);
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).score !== "number" ||
    typeof (parsed as Record<string, unknown>).rationale !== "string" ||
    typeof (parsed as Record<string, unknown>).recommended_stage !== "string"
  ) {
    throw new GroqScoringError(`Groq JSON missing required fields: ${raw.slice(0, 200)}`);
  }

  const obj = parsed as {
    score: number;
    rationale: string;
    recommended_stage: string;
    candidate_name?: string | null;
  };

  const stage = obj.recommended_stage as RecommendedStage;
  if (stage !== "Shortlist" && stage !== "Borderline" && stage !== "Reject") {
    throw new GroqScoringError(`Groq returned unknown recommended_stage: ${obj.recommended_stage}`);
  }

  const candidateName =
    typeof obj.candidate_name === "string" && obj.candidate_name.trim() ? obj.candidate_name.trim() : null;

  return {
    score: Math.max(0, Math.min(100, Math.round(obj.score))),
    rationale: obj.rationale,
    recommendedStage: stage,
    candidateName,
  };
}

export async function scoreCandidateAgainstJd(jdText: string, cvText: string): Promise<JdScoringResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new GroqScoringError("GROQ_API_KEY env var is not set");
  }

  const groq = new Groq({ apiKey });
  const prompt = buildJdPrompt(jdText, cvText);

  let response;
  try {
    response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 1024,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });
  } catch (error) {
    throw new GroqScoringError(`Groq API error: ${error instanceof Error ? error.message : String(error)}`);
  }

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new GroqScoringError(`Groq response missing text: ${JSON.stringify(response).slice(0, 300)}`);
  }

  const result = parseJdResponse(text);
  return { ...result, recommendedStage: capFinalYearStage(result.recommendedStage, cvText) };
}
