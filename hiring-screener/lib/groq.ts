import Groq from "groq-sdk";
import { ROLE_LIST, ROLES, isValidRole, type Role } from "./roles";
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

function buildJdPrompt(jdText: string, cvText: string, recruiterNote?: string | null): string {
  return `You are screening a candidate's CV against a job description.

JOB DESCRIPTION:
"""
${jdText}
"""

CANDIDATE'S CV/RESUME TEXT:
"""
${cvText}
"""
${
  recruiterNote?.trim()
    ? `\nRECRUITER'S NOTE ON THIS CANDIDATE (weigh this heavily — it's first-hand context the recruiter wants factored into the score):\n"""\n${recruiterNote.trim()}\n"""\n`
    : ""
}
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

export async function scoreCandidateAgainstJd(
  jdText: string,
  cvText: string,
  recruiterNote?: string | null
): Promise<JdScoringResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new GroqScoringError("GROQ_API_KEY env var is not set");
  }

  const groq = new Groq({ apiKey });
  const prompt = buildJdPrompt(jdText, cvText, recruiterNote);

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

export interface ProfileClassification extends GroqScoringResult {
  role: Role | null;
}

function buildClassifyPrompt(cvText: string | null, freeText: string | null, answers: AnsweredQuestion[] | null): string {
  const roleBlock = ROLE_LIST.map((r) => `- "${r.key}" (${r.title}): ${r.criteria}`).join("\n");

  const cvBlock = cvText
    ? `\nCV/RESUME TEXT (extracted from the attached document — weigh it heavily in your judgment):\n"""\n${cvText}\n"""\n`
    : "\n(No CV/resume text was available — judge based on the text below alone.)\n";

  const freeTextBlock = freeText
    ? `\nAPPLICANT'S OWN WORDS (free-text answer or accompanying message):\n"""\n${freeText}\n"""\n`
    : "";

  const qaBlock =
    answers && answers.length > 0
      ? `\nSCREENING ANSWERS:\n${answers.map((a) => `${a.question}: ${a.answer}`).join("\n")}\n`
      : "";

  return `You are screening an inbound candidate profile for Yellow.ai's Forward Deployed hiring track.
There are 3 open roles. Pick whichever ONE the person best fits, or "none" if this profile doesn't
indicate genuine candidacy for any of them (e.g. it's unrelated networking, a recruiter pitch to the
account owner, spam, or too little signal to judge).

If the person explicitly states they are responding to or applying for a specific one of these openings
by name (e.g. they mention the "Intern"/"Internship" opening, the "Lead" opening, or the "Engagement
Manager" role), classify them under THAT role even if their experience level seems better suited to a
different one — respect their stated intent over your own read of seniority. Only fall back to picking
the best-fit role yourself when they don't clearly say which opening they mean. Don't let an incidental
mention of "intern" (e.g. a past internship on their resume) override an explicit statement that they're
applying for a different named role.

OPEN ROLES:
${roleBlock}
${cvBlock}${freeTextBlock}${qaBlock}
If the candidate indicates they are still currently completing their final year of study rather than
already graduated — phrases like "final year", "final-year", "7th semester", "8th sem", "currently
pursuing", "final semester", "3rd/4th year", or similar — subtract 15 points from the score you would
otherwise give, since they're less immediately available than a graduate. Regardless of how high the
resulting score is, never recommend "Shortlist" as the stage for a candidate who is still studying rather
than graduated — cap it at "Borderline" at most. Reflect this in your rationale when it applies.

Respond with strict JSON only, matching exactly this shape:
{"role": "engagement_manager" | "lead" | "intern" | "none", "score": <integer 0-100>, "rationale": "<2-3 sentences>", "recommended_stage": "Shortlist" | "Borderline" | "Reject"}`;
}

function parseClassifyResponse(raw: string): ProfileClassification {
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
    role?: string;
    score: number;
    rationale: string;
    recommended_stage: string;
  };

  const stage = obj.recommended_stage as RecommendedStage;
  if (stage !== "Shortlist" && stage !== "Borderline" && stage !== "Reject") {
    throw new GroqScoringError(`Groq returned unknown recommended_stage: ${obj.recommended_stage}`);
  }

  const role = obj.role && isValidRole(obj.role) ? obj.role : null;

  return {
    role,
    score: Math.max(0, Math.min(100, Math.round(obj.score))),
    rationale: obj.rationale,
    recommendedStage: stage,
  };
}

/** Reads a candidate's CV/free-text/answers and picks whichever of the 3 open roles they best fit, or none. */
export async function classifyAndScoreProfile(params: {
  cvText: string | null;
  freeText: string | null;
  answers: AnsweredQuestion[] | null;
}): Promise<ProfileClassification> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new GroqScoringError("GROQ_API_KEY env var is not set");
  }

  const groq = new Groq({ apiKey });
  const prompt = buildClassifyPrompt(params.cvText, params.freeText, params.answers);

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

  const result = parseClassifyResponse(text);
  return {
    ...result,
    recommendedStage: capFinalYearStage(result.recommendedStage, `${params.cvText ?? ""} ${params.freeText ?? ""}`),
  };
}
