/**
 * One-off (re-runnable) batch job: tags every application that looks like a 3rd-year
 * or final-year student with "final-year-student". Checks, in order:
 *   1. The structured "current academic stage" answer (intern-role form applicants).
 *   2. The free-text answer / LinkedIn chat transcript.
 *   3. The CV file itself, if one was uploaded.
 * Uses the same FINAL_YEAR_PATTERN as lib/finalYearPenalty.ts (which already caps AI
 * stage recommendations for still-studying candidates), so "final-year-student" here
 * means the same thing as it does everywhere else in the app.
 *
 * Usage:
 *   set -a; source .env.local; set +a
 *   node scripts/tag-final-year-students.js [--concurrency=8] [--limit=N] [--dry-run]
 */
const { createPool } = require("@vercel/postgres");
const { PDFParse } = require("pdf-parse");
const mammoth = require("mammoth");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);
const CONCURRENCY = Number(args.concurrency || 8);
const LIMIT = args.limit ? Number(args.limit) : Infinity;
const DRY_RUN = Boolean(args["dry-run"]);

const TAG = "final-year-student";
const MAX_CV_TEXT_CHARS = 8000;

// Mirrors lib/finalYearPenalty.ts — duplicated here since this script runs outside the Next build.
const FINAL_YEAR_PATTERN =
  /\b(final[\s-]?year|final[\s-]?yr|final[\s-]?semester|7th\s*sem(ester)?|8th\s*sem(ester)?|currently\s+pursuing|pursuing\s+my|pursuing\s+b\.?tech|3rd\s*year|4th\s*year)\b/i;

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

const pool = createPool({ connectionString: process.env.DATABASE_URL });
const sql = (strings, ...values) => pool.sql(strings, ...values);

function matchesStructuredAnswer(app) {
  if (app.role !== "intern" || !Array.isArray(app.answers)) return false;
  return app.answers.some((a) => a.id === "q1" && a.answer === "Final-year student");
}

async function processApplication(app, stats) {
  if (Array.isArray(app.tags) && app.tags.includes(TAG)) {
    stats.alreadyTagged++;
    return;
  }

  let matchedVia = null;

  if (matchesStructuredAnswer(app)) {
    matchedVia = "answers";
  } else if (FINAL_YEAR_PATTERN.test(app.free_text || "")) {
    matchedVia = "free_text";
  } else if (app.cv_url) {
    try {
      const res = await fetch(app.cv_url);
      if (res.ok) {
        const cvBytes = Buffer.from(await res.arrayBuffer());
        const cvText = await extractCvText(cvBytes, app.cv_filename);
        if (FINAL_YEAR_PATTERN.test(cvText)) matchedVia = "cv";
      }
    } catch (error) {
      console.error(`  [${app.id}] CV read/extract failed for ${app.name}:`, error.message);
    }
  }

  if (!matchedVia) {
    stats.noMatch++;
    return;
  }

  stats.matched++;
  stats.byChannel[matchedVia] = (stats.byChannel[matchedVia] || 0) + 1;
  console.log(`  [${app.id}] ${app.name} (${app.role ?? "no role"}) -> matched via ${matchedVia}`);

  if (!DRY_RUN) {
    await sql`
      UPDATE applications
      SET tags = array_append(tags, ${TAG})
      WHERE id = ${app.id} AND NOT (${TAG} = ANY(tags))
    `;
  }
}

async function runPool(items, worker, concurrency) {
  let index = 0;
  async function next() {
    while (index < items.length) {
      const i = index++;
      await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, next));
}

async function main() {
  const { rows: applications } = await sql`
    SELECT id, name, role, answers, free_text, cv_url, cv_filename, tags
    FROM applications
    ORDER BY submitted_at DESC
  `;
  const targets = applications.slice(0, LIMIT);
  console.log(
    `Scanning ${targets.length} applications for 3rd/final-year signals (concurrency=${CONCURRENCY}, dry-run=${DRY_RUN})`
  );

  const stats = { matched: 0, alreadyTagged: 0, noMatch: 0, byChannel: {} };
  let done = 0;
  await runPool(
    targets,
    async (app) => {
      try {
        await processApplication(app, stats);
      } catch (error) {
        console.error(`  [${app.id}] Unexpected error:`, error.message);
      }
      done++;
      if (done % 50 === 0) console.log(`Progress: ${done}/${targets.length}`);
    },
    CONCURRENCY
  );

  console.log("Done.", stats);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
