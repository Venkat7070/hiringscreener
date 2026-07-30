import { NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/requireAdmin";
import {
  ingestCvAttachment,
  ingestMessage,
  isBeforeSyncCutoff,
  isCvAttachment,
  unipileGet,
  type UnipileAttachment,
} from "@/lib/linkedinIngest";

export const runtime = "nodejs";
export const maxDuration = 60;

// Each chat can involve a CV attachment download + blob upload, which is slow relative to the
// function's time budget — keep batches small and let the caller repeat the call until
// `truncated` is false rather than trying to fit everything into one invocation.
const MAX_CHATS = 20;

interface UnipileChat {
  id: string;
  name: string | null;
}

interface UnipileAttendee {
  id: string;
  name: string;
  profile_url: string;
  is_self: number;
}

interface UnipileMessage {
  id?: string;
  message_id?: string;
  provider_message_id?: string;
  text: string | null;
  attachments?: UnipileAttachment[];
  is_sender?: boolean;
  timestamp?: string;
}

async function listAll<T>(
  path: string,
  extractItems: (page: any) => T[] = (page) => page.items
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null = null;
  do {
    const sep = path.includes("?") ? "&" : "?";
    const page = await unipileGet(`${path}${cursor ? `${sep}cursor=${encodeURIComponent(cursor)}` : ""}`);
    items.push(...extractItems(page));
    cursor = page.cursor ?? null;
  } while (cursor);
  return items;
}

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const offset = Math.max(0, Number(new URL(request.url).searchParams.get("offset") ?? "0") || 0);

  await ensureSchema();

  let accounts: { id: string; type: string }[];
  try {
    const accountList = await unipileGet("/api/v1/accounts");
    accounts = accountList.items ?? [];
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list Unipile accounts" },
      { status: 502 }
    );
  }

  const linkedinAccount = accounts.find((a) => a.type === "LINKEDIN");
  if (!linkedinAccount) {
    return NextResponse.json({ error: "No connected LinkedIn account found on Unipile" }, { status: 400 });
  }

  let chats: UnipileChat[];
  try {
    chats = await listAll<UnipileChat>(
      `/api/v1/chats?account_id=${encodeURIComponent(linkedinAccount.id)}&limit=250`
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list chats" },
      { status: 502 }
    );
  }

  const totalChats = chats.length;
  const truncated = offset + MAX_CHATS < totalChats;
  const nextOffset = truncated ? offset + MAX_CHATS : null;
  chats = chats.slice(offset, offset + MAX_CHATS);

  let chatsScanned = 0;
  let messagesScanned = 0;
  let messagesStored = 0;
  let ingested = 0;
  let failed = 0;

  for (const chat of chats) {
    chatsScanned++;

    let contactName = chat.name?.trim() || "Unknown LinkedIn contact";
    let contactProfileUrl: string | null = null;
    let selfName = "You";
    try {
      const attendees = await listAll<UnipileAttendee>(`/api/v1/chats/${chat.id}/attendees`);
      const other = attendees.find((a) => !a.is_self);
      const self = attendees.find((a) => a.is_self);
      if (other) {
        contactName = other.name?.trim() || contactName;
        contactProfileUrl = other.profile_url ?? null;
      }
      if (self) {
        selfName = self.name?.trim() || selfName;
      }
    } catch (error) {
      console.error(`Failed to fetch attendees for chat ${chat.id}:`, error);
    }

    let messages: UnipileMessage[];
    try {
      messages = await listAll<UnipileMessage>(`/api/v1/chats/${chat.id}/messages?limit=250`);
    } catch (error) {
      console.error(`Failed to list messages for chat ${chat.id}:`, error);
      continue;
    }
    messagesScanned += messages.length;

    // Hard rule: only sync chats that are actual candidate conversations — i.e. a CV
    // was attached at some point. Anything else is a personal chat and must be skipped
    // entirely (never stored), regardless of the date filter below.
    const chatHasCv = messages.some((m) => (m.attachments ?? []).some(isCvAttachment));
    if (!chatHasCv) {
      continue;
    }

    for (const message of messages) {
      if (isBeforeSyncCutoff(message.timestamp ?? null)) {
        continue;
      }

      const messageId = message.message_id ?? message.id ?? message.provider_message_id;
      if (!messageId) {
        console.error(`Skipping message with no resolvable id in chat ${chat.id}:`, message);
        continue;
      }

      const cvAttachments = (message.attachments ?? []).filter(isCvAttachment);
      const isSender = Boolean(message.is_sender);

      try {
        const { inserted } = await ingestMessage({
          chatId: chat.id,
          messageId,
          text: message.text ?? null,
          isSender,
          senderName: isSender ? selfName : contactName,
          senderProfileUrl: isSender ? null : contactProfileUrl,
          hasCvAttachment: cvAttachments.length > 0,
          timestamp: message.timestamp ?? null,
        });
        if (inserted) messagesStored++;
      } catch (error) {
        console.error(`Failed to store LinkedIn message ${messageId}:`, error);
      }

      for (const attachment of cvAttachments) {
        try {
          const { inserted } = await ingestCvAttachment({
            messageId,
            attachment,
            senderName: contactName,
            senderProfileUrl: contactProfileUrl,
            messageText: message.text ?? null,
          });
          if (inserted) ingested++;
        } catch (error) {
          failed++;
          console.error(`Failed to ingest LinkedIn CV attachment ${messageId}:${attachment.id}:`, error);
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    chatsScanned,
    totalChats,
    messagesScanned,
    messagesStored,
    ingested,
    failed,
    truncated,
    nextOffset,
  });
}
