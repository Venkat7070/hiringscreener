import { NextResponse } from "next/server";
import { ensureSchema, sql } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/requireAdmin";
import type { LinkedInMessage, LinkedInThreadSummary } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureSchema();
  const { rows } = await sql`
    SELECT * FROM linkedin_messages ORDER BY chat_id, message_timestamp ASC NULLS LAST
  `;
  const messages = rows as LinkedInMessage[];

  const byChat = new Map<string, LinkedInMessage[]>();
  for (const message of messages) {
    const list = byChat.get(message.chat_id);
    if (list) list.push(message);
    else byChat.set(message.chat_id, [message]);
  }

  const threads: LinkedInThreadSummary[] = Array.from(byChat.entries()).map(([chatId, msgs]) => {
    const contact = [...msgs].reverse().find((m) => !m.is_sender);
    const last = msgs[msgs.length - 1];
    return {
      chat_id: chatId,
      contact_name: contact?.sender_name ?? msgs[0].sender_name,
      contact_profile_url: contact?.sender_profile_url ?? null,
      last_message_text: last?.text ?? null,
      last_message_at: last?.message_timestamp ?? null,
      message_count: msgs.length,
    };
  });

  threads.sort((a, b) => {
    const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return bTime - aTime;
  });

  return NextResponse.json({ threads });
}
