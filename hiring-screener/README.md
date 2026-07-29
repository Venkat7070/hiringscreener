# Yellow.ai — Forward Deployed Hiring Screener

A candidate screening app for Yellow.ai's Forward Deployed hiring track:

- **`/apply`** — public candidate form (role select → role-specific screening questions → CV upload)
- **`/admin`** — password-protected dashboard to review, filter, sort, bulk-update, and export applications
- Every submission gets a **mechanical score** (0–100, computed server-side from weighted multiple-choice
  answers) and an async **AI score** from an open-weight model on Groq, which judges answer quality/specificity
  against the role's ideal-candidate criteria.

## Tech stack

- Next.js 14 (App Router, TypeScript)
- Tailwind CSS
- Postgres via [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) (`@vercel/postgres`)
- File storage via [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) (`@vercel/blob`)
- [Groq API](https://console.groq.com) (`groq-sdk`, JSON mode) running `llama-3.1-8b-instant` for LLM scoring —
  open-weight, 500K tokens/day on the free tier (2.5x gpt-oss-120b's 200K), same provider as the org's support-bot

## Required environment variables

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. Provided automatically when you attach a Vercel Postgres database to the project. |
| `GROQ_API_KEY` | API key for the Groq API. Get one at [console.groq.com/keys](https://console.groq.com/keys). |
| `ADMIN_PASSWORD` | Password required to sign in to `/admin`. Pick something strong — this is the only gate on the dashboard. |
| `BLOB_READ_WRITE_TOKEN` | Read/write token for Vercel Blob. Provided automatically when you attach a Blob store to the project. |
| `GROQ_MODEL` *(optional)* | Overrides the Groq model id. Defaults to `llama-3.1-8b-instant`. |
| `UNIPILE_API_KEY` *(optional)* | Required only for the LinkedIn CV sync (see below). From your Unipile dashboard. |
| `UNIPILE_DSN` *(optional)* | Required only for the LinkedIn CV sync. Your Unipile account's base URL, e.g. `https://api6.unipile.com:13443`. |
| `LINKEDIN_WEBHOOK_SECRET` *(optional)* | Required only for the LinkedIn CV sync. A secret you invent yourself; must match the `X-Webhook-Secret` header on the registered webhook. |

Copy `.env.example` to `.env.local` and fill these in for local development.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Provision storage (once, via Vercel)

```bash
vercel link
vercel postgres create   # or attach an existing Vercel Postgres database
vercel blob create       # or attach an existing Blob store
vercel env pull .env.local
```

This populates `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` in `.env.local` automatically. Add
`GROQ_API_KEY` and `ADMIN_PASSWORD` yourself (they aren't provisioned by Vercel).

The database schema (a single `applications` table) is created automatically on first request —
there's no separate migration step to run.

### 3. Run locally

```bash
npm run dev
```

Visit `http://localhost:3000/apply` for the candidate form and `http://localhost:3000/admin` for the
dashboard (log in with `ADMIN_PASSWORD`).

### 4. Deploy

```bash
vercel deploy --prod
```

Make sure all four required env vars are set in the Vercel project settings (or via `vercel env add`)
before deploying.

## How scoring works

1. **Mechanical score** — each screening question has point-weighted options (weights sum to 100 across
   the 4 questions per role). The server recomputes this from the submitted answers on save — it's never
   trusted from the client.
2. **AI score** — on submit, a background call (via `waitUntil`) sends the role's ideal-candidate criteria
   plus all Q&A and the free-text answer to Groq (`llama-3.1-8b-instant`), asking for a holistic 0–100 score, a short rationale,
   and a recommended stage (`Shortlist` / `Borderline` / `Reject`). This never blocks the candidate's
   submission — if it fails (bad API key, rate limit, malformed response), the mechanical score is still
   saved and the row simply shows no AI score until an admin clicks **Re-score**.
3. CV uploads follow the same "never block submission" rule: if the upload to Vercel Blob fails, the
   application is still saved (without a CV) and the candidate sees a note to send their CV separately.

## LinkedIn CV sync (optional)

CVs that candidates send you directly over LinkedIn chat can be synced into the `/admin` dashboard
automatically, via [Unipile](https://www.unipile.com), a hosted API that connects to your LinkedIn
account and forwards new messages as webhooks. This is unofficial LinkedIn automation (not sanctioned
by LinkedIn's Partner Program) — it works by acting as your logged-in session, so keep usage to
passive reading of incoming attachments rather than sending/automating outbound messages, to minimize
account-restriction risk.

**Setup (you do steps 1–2 yourself — they require your own login/credentials):**

1. Sign up at [dashboard.unipile.com](https://dashboard.unipile.com/signup) and connect your LinkedIn
   account through Unipile's hosted flow. Note your **DSN** (base URL) and **API key** from the dashboard.
2. Set `UNIPILE_API_KEY`, `UNIPILE_DSN`, and a `LINKEDIN_WEBHOOK_SECRET` of your choosing in your Vercel
   project's environment variables, then deploy.
3. Register the webhook (run this yourself, once, after deploying — it uses your own Unipile API key):

   ```bash
   curl -X POST "https://<your-unipile-dsn>/api/v1/webhooks" \
     -H "X-API-KEY: <your-unipile-api-key>" \
     -H "Content-Type: application/json" \
     -d '{
       "source": "messaging",
       "events": ["message_received"],
       "request_url": "https://<your-deployed-app>/api/linkedin/webhook",
       "headers": [{ "key": "X-Webhook-Secret", "value": "<your-linkedin-webhook-secret>" }]
     }'
   ```

From then on, any LinkedIn message with a PDF/DOC/DOCX attachment lands in `/admin` tagged **LinkedIn**,
with `role` unset — pick a role from the row's dropdown to enable mechanical/AI scoring for it. The
sender's LinkedIn message text (if any) is stored as the free-text answer for AI scoring context.

## Project structure

```
app/
  apply/                 candidate-facing application wizard
  admin/                 password-gated dashboard + login page
  api/
    applications/        create (public) + list/patch/delete/bulk (admin)
    applications/[id]/rescore/  manual AI re-score
    applications/export/ CSV export
    upload/               CV upload → Vercel Blob
    admin/login|logout/   cookie-based admin session
    linkedin/webhook/     Unipile webhook receiver → ingests LinkedIn CV attachments
lib/
  roles.ts               role definitions, questions, weights, criteria text
  scoring.ts             mechanical score calculation
  groq.ts                Groq prompt + chat completion call
  scoreApplication.ts     background vs. manual scoring entry points
  db.ts                  Postgres client + schema bootstrap
  auth.ts / requireAdmin.ts  admin password + signed session cookie
  csv.ts                 CSV export formatting
```
