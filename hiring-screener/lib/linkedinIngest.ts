import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { sql } from "@/lib/db";

export const CV_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

export interface UnipileAttachment {
  id: string;
  mimetype?: string;
  unavailable?: boolean;
}

function unipileConfig(): { dsn: string; apiKey: string } {
  const dsn = process.env.UNIPILE_DSN;
  const apiKey = process.env.UNIPILE_API_KEY;
  if (!dsn || !apiKey) {
    throw new Error("UNIPILE_DSN or UNIPILE_API_KEY is not configured");
  }
  return { dsn, apiKey };
}

export async function unipileGet(path: string): Promise<any> {
  const { dsn, apiKey } = unipileConfig();
  const res = await fetch(`${dsn}${path}`, { headers: { "X-API-KEY": apiKey } });
  if (!res.ok) {
    throw new Error(`Unipile GET ${path} failed: ${res.status}`);
  }
  return res.json();
}

export function isCvAttachment(a: UnipileAttachment): boolean {
  return Boolean(!a.unavailable && a.mimetype && CV_EXTENSIONS[a.mimetype]);
}

async function fetchAttachmentBinary(
  messageId: string,
  attachmentId: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const { dsn, apiKey } = unipileConfig();
  const res = await fetch(`${dsn}/api/v1/messages/${messageId}/attachments/${attachmentId}`, {
    headers: { "X-API-KEY": apiKey },
  });
  if (!res.ok) {
    throw new Error(`Unipile attachment fetch failed: ${res.status}`);
  }
  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}

/** Downloads a CV-like attachment and inserts it as a LinkedIn-sourced application row. Idempotent via external_id. */
export async function ingestCvAttachment(params: {
  messageId: string;
  attachment: UnipileAttachment;
  senderName: string;
  senderProfileUrl: string | null;
  messageText: string | null;
}): Promise<{ inserted: boolean }> {
  const { messageId, attachment, senderName, senderProfileUrl, messageText } = params;
  const externalId = `${messageId}:${attachment.id}`;

  const { buffer, contentType } = await fetchAttachmentBinary(messageId, attachment.id);
  const ext = CV_EXTENSIONS[attachment.mimetype!] ?? "bin";
  const blob = await put(`cvs/linkedin-${Date.now()}-${attachment.id}.${ext}`, buffer, {
    access: "public",
    contentType,
  });

  const id = randomUUID();
  const { rowCount } = await sql`
    INSERT INTO applications (
      id, role, name, linkedin, answers, free_text,
      cv_url, cv_filename, mechanical_score, stage, source, external_id
    ) VALUES (
      ${id}, NULL, ${senderName}, ${senderProfileUrl}, '[]'::jsonb, ${messageText},
      ${blob.url}, ${`${senderName} - CV.${ext}`}, NULL, 'Applied', 'linkedin', ${externalId}
    )
    ON CONFLICT (external_id) DO NOTHING
  `;

  return { inserted: rowCount === 1 };
}

/** Stores any inbound/outbound chat message (with or without a CV attachment). Idempotent via message_id. */
export async function ingestMessage(params: {
  chatId: string;
  messageId: string;
  text: string | null;
  isSender: boolean;
  senderName: string;
  senderProfileUrl: string | null;
  hasCvAttachment: boolean;
  timestamp: string | null;
}): Promise<{ inserted: boolean }> {
  const { chatId, messageId, text, isSender, senderName, senderProfileUrl, hasCvAttachment, timestamp } =
    params;
  const id = randomUUID();
  const messageTimestamp = timestamp ? new Date(timestamp).toISOString() : null;

  const { rowCount } = await sql`
    INSERT INTO linkedin_messages (
      id, chat_id, message_id, sender_name, sender_profile_url, is_sender, text, has_cv_attachment, message_timestamp
    ) VALUES (
      ${id}, ${chatId}, ${messageId}, ${senderName}, ${senderProfileUrl}, ${isSender}, ${text}, ${hasCvAttachment}, ${messageTimestamp}
    )
    ON CONFLICT (message_id) DO NOTHING
  `;

  return { inserted: rowCount === 1 };
}
