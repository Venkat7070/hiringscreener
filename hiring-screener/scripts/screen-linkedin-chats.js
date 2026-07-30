/**
 * One-off (re-runnable) batch job: screens every LinkedIn chat with activity on/after
 * a cutoff date against all 3 role criteria, auto-picking the best-fit role, and
 * upserts the result into `applications` so it shows up in /admin like any other applicant.
 * CVs (PDF/DOCX) are text-extracted and scored via the same Groq model as the main app.
 *
 * Idempotent: skips chats whose target row already has an ai_score, unless FORCE=1.
 *
 * Usage:
 *   set -a; source .env.local; set +a
 *   node scripts/screen-linkedin-chats.js [--cutoff=2026-07-21] [--concurrency=5] [--limit=N]
 */
const { randomUUID } = require("node:crypto");
const { createPool } = require("@vercel/postgres");
const Groq = require("groq-sdk");
const { PDFParse } = require("pdf-parse");
const mammoth = require("mammoth");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);

const CUTOFF = args.cutoff || "2026-07-22T00:00:00Z";
const CONCURRENCY = Number(args.concurrency || 5);
const LIMIT = args.limit ? Number(args.limit) : Infinity;
const FORCE = process.env.FORCE === "1";
const GROQ_MIN_INTERVAL_MS = Number(args.interval || 1200);
// Aborts the whole run once this many chats in a row exhaust their retries on a 429 —
// a sustained streak means the daily token quota is out, and grinding through the rest
// of the list (each waiting through a full backoff before failing) just wastes time.
const RATE_LIMIT_BREAKER = Number(args.breaker || 5);
// When set (with FORCE=1), only re-scores existing rows already assigned this role —
// new/unscored chats are still screened normally regardless of this filter.
const ONLY_ROLE = args.onlyRole || null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Serializes actual Groq network calls across all workers so concurrent chat
// processing (DB reads, CV downloads, text extraction) doesn't translate into a
// burst of requests that blows through the API's per-minute rate limit.
let groqQueue = Promise.resolve();
let lastGroqCallAt = 0;
function scheduleGroqCall(fn) {
  const run = groqQueue.then(async () => {
    const wait = Math.max(0, lastGroqCallAt + GROQ_MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await sleep(wait);
    lastGroqCallAt = Date.now();
    return fn();
  });
  groqQueue = run.catch(() => {});
  return run;
}

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

const FINAL_YEAR_PATTERN =
  /\b(final[\s-]?year|final[\s-]?yr|final[\s-]?semester|7th\s*sem(ester)?|8th\s*sem(ester)?|currently\s+pursuing|pursuing\s+my|pursuing\s+b\.?tech|3rd\s*year|4th\s*year)\b/i;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MAX_CV_TEXT_CHARS = 8000;

/** Extracts plain text from a CV file so it can be included in a text-only prompt. */
async function extractCvText(cvBytes, filename) {
  const ext = (filename || "").split(".").pop()?.toLowerCase();
  if (ext === "pdf") {
    const parser = new PDFParse({ data: cvBytes });
    try {
      const result = await parser.getText();
      return result.text.slice(0, MAX_CV_TEXT_CHARS);
    } finally {
      await parser.destroy();
    }
  }
  if (ext === "docx") {
    const result = await mammoth.extractRawText({ buffer: cvBytes });
    return result.value.slice(0, MAX_CV_TEXT_CHARS);
  }
  throw new Error(`Unsupported CV file type: ${ext}`);
}

const ROLE_CRITERIA = {
  engagement_manager: {
    title: "Forward Deployed Engagement Manager",
    criteria:
      "8-12+ years in Customer Success, Strategic Consulting, or Forward-Deployed Engineering; has directly managed cross-functional or technical teams; hands-on (not just user-level) Gen AI/agentic AI experience; direct experience with large enterprise customers, ideally Americas/Europe; genuine consulting/solutioning mindset — diagnoses root business needs, turns ambiguity into a scoped plan, weighs trade-offs, acts as a trusted advisor.",
  },
  lead: {
    title: "Forward Deployed Lead",
    criteria:
      "6-10+ years overall, 3+ years hands-on with Yellow.ai or a similar conversational AI platform; has personally built RAG pipelines or agentic workflows using LLMs; has led or mentored developers; comfortable owning architecture decisions and integration design at enterprise scale.",
  },
  intern: {
    title: "Forward Deployed Engineer — Internship",
    criteria:
      "Final-year student or recent graduate; solid JavaScript/Python fundamentals; has built something (even a hobby project) involving LLMs or Gen AI; shows genuine curiosity and a builder's mindset; answer about wanting the role should show authentic interest, not generic enthusiasm.",
  },
};

const pool = createPool({ connectionString: process.env.DATABASE_URL });
const sql = (strings, ...values) => pool.sql(strings, ...values);

function buildPrompt(transcript, cvText) {
  const roleBlock = Object.entries(ROLE_CRITERIA)
    .map(([key, r]) => `- "${key}" (${r.title}): ${r.criteria}`)
    .join("\n");

  const cvBlock = cvText
    ? `\nCV/RESUME TEXT (extracted from the attached document — weigh it heavily in your judgment):\n"""\n${cvText}\n"""\n`
    : "\n(No CV/resume text was available for this conversation — judge based on the chat text alone.)\n";

  return `You are screening an inbound LinkedIn conversation for Yellow.ai's Forward Deployed hiring track.
There are 3 open roles. Pick whichever ONE the person best fits, or "none" if this conversation doesn't
indicate genuine candidacy for any of them (e.g. it's unrelated networking, a recruiter pitch to you, spam,
or too little signal to judge).

If the person explicitly states they are responding to or applying for a specific one of these openings by
name (e.g. they say they saw your post about the "Intern"/"Internship" opening, or the "Lead" opening, or
the "Engagement Manager" role), classify them under THAT role even if their experience level seems better
suited to a different one — respect their stated intent over your own read of seniority. Only fall back to
picking the best-fit role yourself when they don't clearly say which opening they mean. Don't let an
incidental mention of "intern" (e.g. a past or current internship on their resume) override an explicit
statement that they're applying for a different named role.

OPEN ROLES:
${roleBlock}

LINKEDIN CONVERSATION (chronological; "Recruiter" is the account owner, other name is the contact):
"""
${transcript}
"""
${cvBlock}
If the candidate indicates they are still currently completing their final year of study rather than
already graduated — phrases like "final year", "final-year", "7th semester", "8th sem", "currently
pursuing", "final semester", "3rd/4th year", or similar — subtract 15 points from the score you would
otherwise give, since they're less immediately available than a graduate. Regardless of how high the
resulting score is, never recommend "Shortlist" as the stage for a candidate who is still studying rather
than graduated — cap it at "Borderline" at most. Reflect this in your rationale when it applies.

Respond with strict JSON only, matching exactly this shape:
{"role": "engagement_manager" | "lead" | "intern" | "none", "score": <integer 0-100>, "rationale": "<2-3 sentences>", "recommended_stage": "Shortlist" | "Borderline" | "Reject"}`;
}

async function callGroq(transcript, cvText) {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY not set");

  const prompt = buildPrompt(transcript, cvText);

  let response;
  try {
    response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 1024,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });
  } catch (error) {
    const err = new Error(`Groq API error: ${error instanceof Error ? error.message : String(error)}`);
    err.status = error?.status;
    throw err;
  }

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error(`Groq response missing text: ${JSON.stringify(response).slice(0, 300)}`);

  const parsed = JSON.parse(text);
  const role = ["engagement_manager", "lead", "intern"].includes(parsed.role) ? parsed.role : null;
  let stage = ["Shortlist", "Borderline", "Reject"].includes(parsed.recommended_stage)
    ? parsed.recommended_stage
    : "Borderline";
  // The model doesn't reliably follow the "never Shortlist a still-studying candidate"
  // instruction on its own — enforce it mechanically regardless of what it returned.
  if (stage === "Shortlist" && FINAL_YEAR_PATTERN.test(`${transcript} ${cvText || ""}`)) {
    stage = "Borderline";
  }
  return {
    role,
    score: Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0))),
    rationale: String(parsed.rationale || "").slice(0, 2000),
    recommendedStage: stage,
  };
}

async function fetchCv(cvUrl) {
  const res = await fetch(cvUrl);
  if (!res.ok) throw new Error(`Failed to download CV: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function findExistingRow(chatId) {
  const { rows: cvRows } = await sql`
    SELECT * FROM applications a
    WHERE a.source = 'linkedin'
      AND EXISTS (
        SELECT 1 FROM linkedin_messages lm
        WHERE lm.chat_id = ${chatId} AND a.external_id LIKE lm.message_id || ':%'
      )
    ORDER BY a.submitted_at DESC
    LIMIT 1
  `;
  if (cvRows[0]) return cvRows[0];

  const { rows: screenRows } = await sql`
    SELECT * FROM applications WHERE external_id = ${"linkedin-screen:" + chatId} LIMIT 1
  `;
  return screenRows[0] || null;
}

async function processChat(chatId, stats, state) {
  const { rows: messages } = await sql`
    SELECT * FROM linkedin_messages WHERE chat_id = ${chatId} ORDER BY message_timestamp ASC NULLS LAST
  `;
  if (messages.length === 0) {
    stats.skippedEmpty++;
    return;
  }

  const existing = await findExistingRow(chatId);
  if (existing && existing.ai_score !== null && !FORCE) {
    stats.skippedAlreadyScreened++;
    return;
  }
  if (existing && ONLY_ROLE && existing.role && existing.role !== ONLY_ROLE) {
    stats.skippedAlreadyScreened++;
    return;
  }

  const contact = messages.find((m) => !m.is_sender);
  const contactName = contact?.sender_name || messages[0].sender_name || "Unknown LinkedIn contact";
  const contactProfileUrl = contact?.sender_profile_url || null;

  const transcript = messages
    .map((m) => `${m.is_sender ? "Recruiter" : contactName}: ${m.text || "(no text)"}`)
    .join("\n")
    .slice(0, 8000);

  let cvText = null;
  if (existing?.cv_url) {
    try {
      const cvBytes = await fetchCv(existing.cv_url);
      cvText = await extractCvText(cvBytes, existing.cv_filename);
    } catch (error) {
      console.error(`  [${chatId}] CV read failed, screening chat-only:`, error.message);
    }
  }

  let result;
  const MAX_ATTEMPTS = 4;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      result = await scheduleGroqCall(() => callGroq(transcript, cvText));
      state.consecutiveRateLimited = 0;
      break;
    } catch (error) {
      console.error(`  [${chatId}] Groq call failed (attempt ${attempt}):`, error.message);
      if (attempt === MAX_ATTEMPTS) {
        stats.failed++;
        // Under sustained rate-limiting the API doesn't always return a clean 429 —
        // it sometimes drops the connection outright. Count any exhausted-retry
        // failure toward the breaker; only an actual success resets the streak.
        state.consecutiveRateLimited++;
        if (state.consecutiveRateLimited >= RATE_LIMIT_BREAKER) {
          state.aborted = true;
          console.error(
            `\nAborting: ${state.consecutiveRateLimited} chats in a row exhausted retries — quota looks fully exhausted for now.`
          );
        }
        return;
      }
      const backoffMs = error.status === 429 ? 20000 * attempt : 2000;
      await sleep(backoffMs);
    }
  }

  if (existing) {
    await sql`
      UPDATE applications
      SET role = ${result.role}, ai_score = ${result.score},
          ai_rationale = ${result.rationale}, ai_recommended_stage = ${result.recommendedStage}
      WHERE id = ${existing.id}
    `;
  } else if (result.role) {
    // Never persist a brand-new row for a chat the model itself judged isn't a genuine
    // candidate for any role — that's noise, not a pipeline entry. (An existing row is
    // still updated above even if it flips to "none" on a rescore, since it's already
    // a tracked candidate, not fresh noise.)
    const id = randomUUID();
    await sql`
      INSERT INTO applications (
        id, role, name, linkedin, answers, free_text, mechanical_score,
        ai_score, ai_rationale, ai_recommended_stage, stage, source, external_id
      ) VALUES (
        ${id}, ${result.role}, ${contactName}, ${contactProfileUrl}, '[]'::jsonb, ${transcript.slice(0, 4000)},
        NULL, ${result.score}, ${result.rationale}, ${result.recommendedStage}, 'Applied', 'linkedin',
        ${"linkedin-screen:" + chatId}
      )
    `;
  } else {
    stats.skippedNotCandidate = (stats.skippedNotCandidate || 0) + 1;
  }

  stats.screened++;
  console.log(
    `  [${chatId}] ${contactName} -> role=${result.role ?? "none"} score=${result.score} stage=${result.recommendedStage}`
  );
}

async function runPool(items, worker, concurrency, state) {
  let index = 0;
  async function next() {
    while (index < items.length && !state.aborted) {
      const i = index++;
      await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, next));
}

async function main() {
  // Chats where the account owner sent their own CV/profile outbound (e.g. sharing a
  // resume with an external recruiter about an unrelated role) are never inbound
  // candidacy for Yellow.ai's FD roles — exclude them entirely, chat text included,
  // rather than just stripping the CV. The chat transcript alone can still read as a
  // strong candidate to the model even without the file attached.
  const { rows: excludeRows } = await sql`
    SELECT DISTINCT chat_id FROM linkedin_messages WHERE is_sender = true AND has_cv_attachment = true
  `;
  const excludedChatIds = new Set(excludeRows.map((r) => r.chat_id));

  const { rows: chatRows } = await sql`
    SELECT DISTINCT chat_id FROM linkedin_messages WHERE message_timestamp >= ${CUTOFF}
  `;
  const chatIds = chatRows.map((r) => r.chat_id).filter((id) => !excludedChatIds.has(id)).slice(0, LIMIT);
  if (excludedChatIds.size > 0) {
    console.log(`Excluding ${excludedChatIds.size} chats where the account owner sent their own CV outbound.`);
  }
  console.log(`Screening ${chatIds.length} chats with activity on/after ${CUTOFF} (concurrency=${CONCURRENCY})`);

  const stats = { screened: 0, skippedAlreadyScreened: 0, skippedEmpty: 0, skippedNotCandidate: 0, failed: 0 };
  const state = { aborted: false, consecutiveRateLimited: 0 };
  let done = 0;

  await runPool(
    chatIds,
    async (chatId) => {
      try {
        await processChat(chatId, stats, state);
      } catch (error) {
        stats.failed++;
        console.error(`  [${chatId}] Unexpected error:`, error.message);
      }
      done++;
      if (done % 25 === 0) console.log(`Progress: ${done}/${chatIds.length}`);
    },
    CONCURRENCY,
    state
  );

  console.log("Done.", stats);
  console.log("STATS_JSON " + JSON.stringify({ ...stats, aborted: state.aborted }));
  process.exit(state.aborted ? 3 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
