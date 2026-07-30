import { NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db";
import {
  chatHasStoredCv,
  ingestCvAttachment,
  ingestMessage,
  isBeforeSyncCutoff,
  isCvAttachment,
  type UnipileAttachment,
} from "@/lib/linkedinIngest";

export const runtime = "nodejs";

interface UnipileMessagePayload {
  event?: string;
  account_type?: string;
  message_id: string;
  chat_id?: string;
  provider_chat_id?: string;
  message?: string | null;
  is_sender?: boolean;
  timestamp?: string;
  sender?: { attendee_name?: string; attendee_profile_url?: string };
  attachments?: UnipileAttachment[];
}

export async function POST(request: Request) {
  const secret = process.env.LINKEDIN_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as UnipileMessagePayload | null;
  if (!payload) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.event !== "message_received" || payload.account_type !== "LINKEDIN") {
    return NextResponse.json({ ok: true, skipped: "not a LinkedIn message" });
  }

  const chatId = payload.chat_id ?? payload.provider_chat_id;
  if (!chatId) {
    return NextResponse.json({ ok: true, skipped: "no chat_id on payload" });
  }

  await ensureSchema();

  // Hard rule: never sync anything before the cutoff, and never sync a chat that
  // isn't (yet) a known candidate conversation — see lib/linkedinIngest.ts.
  if (isBeforeSyncCutoff(payload.timestamp ?? null)) {
    return NextResponse.json({ ok: true, skipped: "before sync cutoff date" });
  }

  const senderName = payload.sender?.attendee_name?.trim() || "Unknown LinkedIn contact";
  const senderProfileUrl = payload.sender?.attendee_profile_url ?? null;
  const messageText = payload.message ?? null;
  const isSender = Boolean(payload.is_sender);
  // Only attachments from the contact count as a candidate CV — attachments the
  // account owner sends out (e.g. sharing their own resume in an unrelated chat)
  // must never be ingested as an application.
  const cvAttachments = isSender ? [] : (payload.attachments ?? []).filter(isCvAttachment);

  if (cvAttachments.length === 0 && !(await chatHasStoredCv(chatId))) {
    return NextResponse.json({ ok: true, skipped: "not a known candidate chat" });
  }

  try {
    await ingestMessage({
      chatId,
      messageId: payload.message_id,
      text: messageText,
      isSender,
      senderName,
      senderProfileUrl,
      hasCvAttachment: cvAttachments.length > 0,
      timestamp: payload.timestamp ?? null,
    });
  } catch (error) {
    console.error(`Failed to store LinkedIn message ${payload.message_id}:`, error);
  }

  if (cvAttachments.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no CV-like attachment" });
  }

  const results: { attachmentId: string; ok: boolean }[] = [];
  for (const attachment of cvAttachments) {
    try {
      await ingestCvAttachment({
        messageId: payload.message_id,
        attachment,
        senderName,
        senderProfileUrl,
        messageText,
      });
      results.push({ attachmentId: attachment.id, ok: true });
    } catch (error) {
      console.error(`Failed to ingest LinkedIn CV attachment ${payload.message_id}:${attachment.id}:`, error);
      results.push({ attachmentId: attachment.id, ok: false });
    }
  }

  return NextResponse.json({ ok: true, results });
}
