import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/requireAdmin";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { ScreeningHub } from "@/components/screening/ScreeningHub";

export default function ScreeningHubPage() {
  if (!isAdminAuthenticated()) {
    redirect("/admin/login");
  }

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="min-w-0 flex-1">
        <ScreeningHub />
      </div>
    </div>
  );
}
