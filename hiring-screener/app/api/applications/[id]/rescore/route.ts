import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/requireAdmin";
import { rescoreApplication } from "@/lib/scoreApplication";
import type { Role } from "@/lib/roles";
import type { AnsweredQuestion } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { rows } = await sql`SELECT * FROM applications WHERE id = ${params.id}`;
  const application = rows[0];
  if (!application) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!application.role) {
    return NextResponse.json({ error: "Assign a role before scoring" }, { status: 400 });
  }

  try {
    await rescoreApplication(
      application.id,
      application.role as Role,
      application.answers as AnsweredQuestion[],
      application.free_text ?? ""
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI scoring failed" },
      { status: 502 }
    );
  }

  const { rows: updated } = await sql`SELECT * FROM applications WHERE id = ${params.id}`;
  return NextResponse.json({ application: updated[0] });
}
