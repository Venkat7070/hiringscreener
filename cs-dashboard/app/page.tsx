import { Suspense } from "react";
import DashboardShell from "@/components/DashboardShell";

export default function Page() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-text/50">Loading…</div>}>
      <DashboardShell />
    </Suspense>
  );
}
