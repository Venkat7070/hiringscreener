/**
 * One-off (re-runnable) backfill: extracts an email address for every existing
 * application that doesn't have one yet — from the CV file if one was uploaded,
 * else from the free-text answer / LinkedIn message transcript.
 *
 * Usage:
 *   set -a; source .env.local; set +a
 *   node scripts/backfill-emails.js [--concurrency=8] [--limit=N]
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

const MAX_CV_TEXT_CHARS = 8000;

const EMAIL_REGEX = /[a-zA-Z0-9][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const GENERIC_LOCAL_PARTS = [
  "noreply", "no-reply", "donotreply", "do-not-reply", "info", "support",
  "contact", "admin", "hello", "hr", "careers", "jobs", "recruiting", "recruitment",
];

function extractEmail(text) {
  if (!text) return null;
  const matches = text.match(EMAIL_REGEX);
  if (!matches || matches.length === 0) return null;
  const personal = matches.find((m) => {
    const localPart = m.split("@")[0].toLowerCase();
    return !GENERIC_LOCAL_PARTS.some((p) => localPart === p || localPart.startsWith(p));
  });
  return (personal || matches[0]).toLowerCase();
}

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

async function processApplication(app, stats) {
  let email = null;

  if (app.cv_url) {
    try {
      const res = await fetch(app.cv_url);
      if (res.ok) {
        const cvBytes = Buffer.from(await res.arrayBuffer());
        const cvText = await extractCvText(cvBytes, app.cv_filename);
        email = extractEmail(cvText);
      }
    } catch (error) {
      console.error(`  [${app.id}] CV read/extract failed for ${app.name}:`, error.message);
    }
  }

  if (!email) {
    email = extractEmail(app.free_text);
  }

  if (email) {
    await sql`UPDATE applications SET email = ${email} WHERE id = ${app.id}`;
    stats.found++;
    console.log(`  [${app.id}] ${app.name} -> ${email}`);
  } else {
    stats.notFound++;
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
    SELECT id, name, cv_url, cv_filename, free_text
    FROM applications
    WHERE email IS NULL
    ORDER BY submitted_at DESC
  `;
  const targets = applications.slice(0, LIMIT);
  console.log(`Backfilling email for ${targets.length} applications (concurrency=${CONCURRENCY})`);

  const stats = { found: 0, notFound: 0 };
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
      if (done % 25 === 0) console.log(`Progress: ${done}/${targets.length}`);
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
