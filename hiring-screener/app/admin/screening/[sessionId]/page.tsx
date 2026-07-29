import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/requireAdmin";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { SessionDetail } from "@/components/screening/SessionDetail";

export default function SessionDetailPage({ params }: { params: { sessionId: string } }) {
  if (!isAdminAuthenticated()) {
    redirect("/admin/login");
  }

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="flex-1">
        <SessionDetail sessionId={params.sessionId} />
      </div>
    </div>
  );
}
