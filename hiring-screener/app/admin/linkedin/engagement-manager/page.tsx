import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/requireAdmin";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function EngagementManagerLinkedInPage() {
  if (!isAdminAuthenticated()) {
    redirect("/admin/login");
  }

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="min-w-0 flex-1">
        <AdminDashboard lockRole="engagement_manager" />
      </div>
    </div>
  );
}
