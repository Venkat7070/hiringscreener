import { NextRequest, NextResponse } from "next/server";
import { getAccounts } from "@/lib/getAccounts";

export const revalidate = 300;

export async function GET(request: NextRequest) {
  const fresh = request.nextUrl.searchParams.get("fresh") === "1";

  try {
    const data = await getAccounts({ fresh });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, max-age=0, must-revalidate" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load accounts";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
