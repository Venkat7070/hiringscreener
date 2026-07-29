import { NextResponse } from "next/server";
import { ensureSchema, sql } from "@/lib/db";
import { applicationsToCsv } from "@/lib/csv";
import { isAdminAuthenticated } from "@/lib/requireAdmin";
import type { ApplicationRecord } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureSchema();
  const { rows } = await sql`SELECT * FROM applications ORDER BY submitted_at DESC`;
  const csv = applicationsToCsv(rows as ApplicationRecord[]);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="applications-${Date.now()}.csv"`,
    },
  });
}
