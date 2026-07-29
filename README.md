# Support Bot

A minimal web chat widget backed by an open-source model (Llama 3.3 70B) via the Groq API.

> This repo also contains an unrelated project, [`cs-dashboard/`](cs-dashboard/) — a
> Customer Success account review dashboard (Next.js). See its own README for setup.

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env` and set your key:
   ```
   cp .env.example .env
   ```
   Get an API key from https://console.groq.com/keys and set
   `GROQ_API_KEY` in `.env`. Never commit `.env` — it's already gitignored.
3. Start the server:
   ```
   npm start
   ```
4. Open http://localhost:3000 to see the widget in action.

## Deploying

Set `GROQ_API_KEY` as a secret/environment variable in your hosting
provider (e.g. a GitHub Actions secret, or your platform's environment
variable settings) rather than putting it in code. `SUPPORT_BOT_MODEL` and
`PORT` are optional overrides (see `.env.example`).

### Render

This repo includes a `render.yaml` blueprint:

1. Go to https://dashboard.render.com/blueprints and connect this GitHub
   repo (`Venkat7070/ClaudeCode`, branch `claude/support-bot-api-key-rnagsr`
   or wherever it's merged to).
2. Render detects `render.yaml` and creates the `support-bot` web service.
3. When prompted, set the `GROQ_API_KEY` environment variable value
   (it's marked `sync: false` so Render asks for it rather than reading it
   from the repo — the real key is never committed).
4. Deploy. Render gives you a public URL like
   `https://support-bot-xxxx.onrender.com` serving the widget.

## Embedding the widget elsewhere

Copy `public/widget.js` and `public/widget.css` alongside a
`<div id="support-bot-widget"></div>` on any page served by this app (or
adjust `/api/chat` to point at wherever this backend is hosted).

## WhatsApp (via Twilio)

The bot answers WhatsApp messages through `POST /webhook/whatsapp`, using Twilio.

1. Sign up at https://www.twilio.com and open the
   [WhatsApp sandbox](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn)
   — no business verification needed for testing. Follow its instructions to
   join the sandbox from your own WhatsApp number.
2. Copy your Auth Token from the Twilio Console (Account Info panel) into
   `TWILIO_AUTH_TOKEN` in `.env` (or as a Render secret — it's already in
   `render.yaml`, marked `sync: false`).
3. In the sandbox settings, set **"When a message comes in"** to:
   ```
   https://<your-deployed-url>/webhook/whatsapp
   ```
   (method `HTTP POST`). For local testing, expose your dev server with a
   tunnel (e.g. `ngrok http 3000`) and use the tunnel's HTTPS URL instead.
4. Message the sandbox number from WhatsApp — replies come from the bot.

Each WhatsApp sender's conversation history is kept in memory only (resets
on restart, not shared across multiple server instances) — fine for a single
Render service, not for horizontal scaling or long-term history.

For production (a dedicated WhatsApp Business number instead of the shared
sandbox), see Twilio's [WhatsApp Business Profile setup](https://www.twilio.com/docs/whatsapp/self-sign-up).
