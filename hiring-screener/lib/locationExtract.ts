import Groq from "groq-sdk";

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

function buildPrompt(cvText: string): string {
  return `Extract the candidate's current city and country of residence from this CV/resume text. Prefer an explicit address/location field over cities mentioned only in past job history.

CV TEXT:
"""
${cvText}
"""

Respond with strict JSON only, matching exactly this shape:
{"location": "<City, Country>" | null}`;
}

/** Best-effort: returns null on any failure (missing key, API error, unparseable/empty result) rather than throwing, since this is a non-critical enrichment step during CV ingestion. */
export async function extractLocationFromCv(cvText: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || !cvText.trim()) return null;

  try {
    const groq = new Groq({ apiKey });
    const response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 128,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: buildPrompt(cvText) }],
    });

    const text = response.choices[0]?.message?.content;
    if (!text) return null;

    const parsed = JSON.parse(text) as { location?: unknown };
    return typeof parsed.location === "string" && parsed.location.trim() ? parsed.location.trim() : null;
  } catch {
    return null;
  }
}
