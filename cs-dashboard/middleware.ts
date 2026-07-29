import { NextRequest, NextResponse } from "next/server";

/**
 * Lightweight HTTP Basic Auth gate for the whole app. If DASHBOARD_USER /
 * DASHBOARD_PASS aren't set, auth is skipped (local/sample-data dev). Upgrade
 * to Google OAuth restricted to the company domain before wider rollout —
 * see README.
 */
export function middleware(request: NextRequest) {
  const user = process.env.DASHBOARD_USER;
  const pass = process.env.DASHBOARD_PASS;

  if (!user || !pass) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const encoded = authHeader.slice("Basic ".length);
    try {
      const decoded = atob(encoded);
      const sepIndex = decoded.indexOf(":");
      const suppliedUser = decoded.slice(0, sepIndex);
      const suppliedPass = decoded.slice(sepIndex + 1);
      if (suppliedUser === user && suppliedPass === pass) {
        return NextResponse.next();
      }
    } catch {
      // fall through to 401
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="CS Account Review"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
