"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ScreeningSessionSummary } from "@/lib/types";

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`block rounded-md px-3 py-1.5 text-sm transition ${
        active ? "bg-amber/20 font-medium text-stone-900" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
      }`}
    >
      {children}
    </Link>
  );
}

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [sessions, setSessions] = useState<ScreeningSessionSummary[]>([]);

  useEffect(() => {
    fetch("/api/screening/sessions")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setSessions(data.sessions))
      .catch(() => {});
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col gap-6 border-r border-stone-200 bg-white px-3 py-6">
      <nav className="flex flex-col gap-4">
        <NavLink href="/admin" active={pathname === "/admin"}>
          Applications
        </NavLink>

        <div>
          <div className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Screening
          </div>
          <div className="flex flex-col gap-0.5">
            <NavLink href="/admin/screening" active={pathname === "/admin/screening"}>
              All sessions
            </NavLink>
            <NavLink href="/admin/screening/upload" active={pathname === "/admin/screening/upload"}>
              + New session
            </NavLink>
            {sessions.map((s) => (
              <NavLink
                key={s.id}
                href={`/admin/screening/${s.id}`}
                active={pathname === `/admin/screening/${s.id}`}
              >
                <span className="block truncate" title={s.name}>
                  {s.name}
                </span>
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      <button
        onClick={handleLogout}
        className="mt-auto rounded-md px-3 py-1.5 text-left text-sm font-medium text-stone-500 hover:text-stone-900"
      >
        Log out
      </button>
    </aside>
  );
}
