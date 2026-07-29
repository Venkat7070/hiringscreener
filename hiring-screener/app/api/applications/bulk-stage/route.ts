import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/requireAdmin";
import { STAGES, type Stage } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const ids: unknown = body?.ids;
  const stage: Stage = body?.stage;

  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "ids must be a non-empty array of strings" }, { status: 400 });
  }
  if (!stage || !STAGES.includes(stage)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }

  await pool.query("UPDATE applications SET stage = $1 WHERE id = ANY($2)", [stage, ids]);

  return NextResponse.json({ success: true });
}
