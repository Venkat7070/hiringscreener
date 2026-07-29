# CS Account Review Dashboard

A portfolio-wide account health, renewal risk, and expansion console for
Customer Success, built for yellow.ai. Reads account data live from a
private Google Sheet (via a service account — the sheet is never published
to the web) and renders a filterable, drill-down console: KPI strip,
renewal runway, ARR-by-tier/health chart, attention queue, sortable account
table, and a per-account drill-down drawer.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Recharts (ARR by tier × health) + hand-rolled inline SVG (renewal runway)
- Google Sheets API v4 via a service account (`googleapis`)
- Vitest for unit tests

## Local development

```bash
npm install
npm run dev
```

By default (`USE_SAMPLE_DATA=true` in `.env.example`, or simply no `SHEET_ID`
set) the app reads `sample-data.csv` and needs no Google credentials at all.
Copy `.env.example` to `.env.local` to customize.

```bash
npm run test    # Vitest — header mapping, health score, date parsing
npm run lint    # ESLint
npm run build   # production build, TypeScript + lint gate
```

## Data layer (read this before changing anything here)

The Google Sheet stays **private**. `app/api/accounts/route.ts` is the only
thing that talks to Google — it reads the sheet server-side with a service
account (`googleapis`), using `GOOGLE_SERVICE_ACCOUNT_EMAIL` +
`GOOGLE_PRIVATE_KEY` for auth. The sheet is shared with that service account
email as **Viewer** — nothing is ever published publicly, and the private
key never reaches the client bundle (it's read only in `lib/sheets.ts`,
which is server-only code).

Responses are cached in-memory for 5 minutes (`lib/getAccounts.ts`). The
**Refresh** button in the UI calls `/api/accounts?fresh=1` to bypass that
cache. If the sheet becomes unreachable, the last good cache is served with
a stale banner instead of a hard failure; if there's no cache yet, the API
returns a 502 with the error message.

## Setup in 10 minutes

1. **Create a GCP service account.**
   - Go to [console.cloud.google.com](https://console.cloud.google.com), pick
     or create a project.
   - **IAM & Admin → Service Accounts → Create Service Account.** Any name
     (e.g. `cs-dashboard`) — it doesn't need any project-level roles.
   - Open the new service account → **Keys → Add Key → Create new key → JSON**.
     Download it.

2. **Enable the Sheets API.**
   - **APIs & Services → Library**, search "Google Sheets API", click
     **Enable** (same project as the service account).

3. **Share the sheet with the service account.**
   - Open your Google Sheet, click **Share**.
   - Paste the service account's email (the `client_email` field in the JSON
     key, looks like `cs-dashboard@your-project.iam.gserviceaccount.com`).
   - Give it **Viewer** access. That's it — no domain-wide delegation needed.
   - Make sure the tab with account data is named `Data` (or set `SHEET_TAB`
     to whatever it's actually called), and that row 1 is a header row.

4. **Set environment variables.**
   - `SHEET_ID`: the long ID in the sheet's URL —
     `https://docs.google.com/spreadsheets/d/`**`<SHEET_ID>`**`/edit`.
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`: the JSON key's `client_email`.
   - `GOOGLE_PRIVATE_KEY`: the JSON key's `private_key`, pasted as-is
     (including the `\n` escapes and `-----BEGIN/END PRIVATE KEY-----`
     lines) — the app un-escapes `\n` at runtime.
   - Unset `USE_SAMPLE_DATA` (or set it to `false`) so the app reads the real
     sheet instead of `sample-data.csv`.
   - `DASHBOARD_USER` / `DASHBOARD_PASS`: pick any credentials to gate the
     app with HTTP Basic Auth (see [Auth](#auth) below).

5. **Deploy to Vercel.**
   - Import the repo into Vercel. This project lives in a subdirectory
     (`cs-dashboard/`) — in the Vercel project's **Settings → General →
     Root Directory**, set it to `cs-dashboard`.
   - **Settings → Environment Variables**: add all of the variables from
     step 4 (paste `GOOGLE_PRIVATE_KEY` exactly as in your `.env` — Vercel
     preserves the `\n` escapes as literal text, which is what the app
     expects).
   - Deploy. First load will hit the Sheets API live; subsequent loads
     within 5 minutes are served from cache.

That's the whole setup — no OAuth consent screen, no domain verification,
no scopes beyond read-only Sheets access for one service account.

## Auth

The whole app sits behind HTTP Basic Auth (`middleware.ts`), gated by
`DASHBOARD_USER` / `DASHBOARD_PASS`. If either is unset, auth is disabled —
that's intentional for local/sample-data dev, but **do not deploy to a
public URL without setting both**.

This is deliberately minimal. Before wider rollout (more than a handful of
named users), replace it with Google OAuth restricted to the company
domain (e.g. NextAuth's Google provider with an `hd` claim check for
`yellow.ai`) so access follows Google Workspace membership instead of a
shared password.

## Data model & column mapping

One row per account. Headers are matched case/punctuation-insensitively
(see `lib/headerMap.ts`), so `"ARR ($)"`, `"arr"`, and `"ARR"` all map to
the same field — unrecognized columns are ignored, and rows missing both an
Account ID and Account Name are skipped and counted in the diagnostics
popover (top right, only shown when rows were skipped).

Full column list and types are documented as the `AccountRaw` interface in
`lib/types.ts`.

## Computed health score

`lib/health.ts` computes a weighted composite score (0–100) per account:

| Signal | Weight |
|---|---|
| Consumption vs. committed | 25% |
| Containment % | 20% |
| Live vs. contracted use cases | 15% |
| Champion status + exec sponsor | 15% |
| Payment/support status | 10% |
| Bot CSAT | 10% |
| Renewal status | 5% |

Score ≥75 → Green, ≥50 → Amber, else Red — **unless** a hard override kicks
in: consumption < 40%, containment < 40%, or champion has departed force
the account to Red regardless of score.

If the sheet's `Health` column is populated and differs from the computed
value, both are shown: the computed value drives the badge everywhere in
the UI, and the drill-down drawer shows the manual value alongside it with
an "override" marker — this is intentionally visible so CSM opinion vs. the
data-driven score is easy to spot.

## Tests

```bash
npm run test
```

Covers header normalization/mapping, health score computation (including
all three hard-override paths), and date parsing (ISO + dd/mm/yyyy, with
invalid-date rejection).
