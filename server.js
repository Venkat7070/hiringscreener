require('dotenv').config();
const express = require('express');
const Groq = require('groq-sdk');
const twilio = require('twilio');
const { retrieveRelevantArticles } = require('./knowledgebase');

const PORT = process.env.PORT || 3000;
const MODEL = process.env.SUPPORT_BOT_MODEL || 'llama-3.3-70b-versatile';
const MAX_WHATSAPP_HISTORY = 20;

if (!process.env.GROQ_API_KEY) {
  console.error('Missing GROQ_API_KEY. Copy .env.example to .env and set your key.');
  process.exit(1);
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are a friendly, concise support assistant for ReNew Mobile, an online
store selling refurbished/renewed used phones and tablets. Answer customer questions accurately
using the reference articles provided below when relevant. If a question isn't covered by the
reference articles or requires a human (e.g. account-specific actions, payment disputes,
identity verification), say so and suggest contacting support directly rather than guessing.`;

async function getAssistantReply(messages) {
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  const relevant = lastUserMessage ? retrieveRelevantArticles(lastUserMessage.content) : [];
  const knowledgeContext = relevant.length
    ? '\n\nReference articles:\n\n' +
      relevant.map((a) => `### ${a.title}\n${a.content}`).join('\n\n---\n\n')
    : '';

  const response = await groq.chat.completions.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: 'system', content: SYSTEM_PROMPT + knowledgeContext }, ...messages],
  });
  return response.choices[0]?.message?.content || '';
}

// In-memory per-sender history for WhatsApp. Resets on restart and isn't
// shared across instances — fine for a single Render service, not for
// horizontal scaling.
const whatsappConversations = new Map();

const app = express();
// Render sits behind a reverse proxy; without this, req.protocol reports
// "http" even on HTTPS requests, breaking Twilio's signature check below
// (it signs the https:// URL, so the reconstructed URL must match).
app.set('trust proxy', 1);
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages must be a non-empty array' });
  }
  const valid = messages.every(
    (m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
  );
  if (!valid) {
    return res.status(400).json({ error: 'each message needs a role of user/assistant and string content' });
  }

  try {
    const reply = await getAssistantReply(messages);
    res.json({ reply });
  } catch (err) {
    console.error('Groq API error:', err);
    res.status(502).json({ error: 'Failed to get a response from the support bot' });
  }
});

app.post('/webhook/whatsapp', async (req, res) => {
  if (process.env.TWILIO_AUTH_TOKEN) {
    const signature = req.headers['x-twilio-signature'];
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const isValid = twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN, signature, url, req.body);
    if (!isValid) {
      return res.status(403).send('Invalid Twilio signature');
    }
  }

  const from = req.body.From;
  const body = req.body.Body;
  const twiml = new twilio.twiml.MessagingResponse();

  if (!from || !body) {
    return res.status(400).send('Missing From or Body');
  }

  const history = whatsappConversations.get(from) || [];
  history.push({ role: 'user', content: body });

  let reply;
  try {
    reply = await getAssistantReply(history);
  } catch (err) {
    console.error('Groq API error (WhatsApp):', err);
    reply = 'Sorry, something went wrong. Please try again.';
  }

  history.push({ role: 'assistant', content: reply });
  whatsappConversations.set(from, history.slice(-MAX_WHATSAPP_HISTORY));

  twiml.message(reply);
  res.type('text/xml').send(twiml.toString());
});

app.listen(PORT, () => {
  console.log(`Support bot listening on http://localhost:${PORT}`);
});
