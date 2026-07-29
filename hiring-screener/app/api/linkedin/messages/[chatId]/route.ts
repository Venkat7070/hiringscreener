import { NextResponse } from "next/server";
import { ensureSchema, sql } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/requireAdmin";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { chatId: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureSchema();
  const { rows } = await sql`
    SELECT * FROM linkedin_messages
    WHERE chat_id = ${params.chatId}
    ORDER BY message_timestamp ASC NULLS LAST
  `;

  return NextResponse.json({ messages: rows });
}
