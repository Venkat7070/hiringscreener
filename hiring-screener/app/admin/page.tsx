import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/requireAdmin";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminPage() {
  if (!isAdminAuthenticated()) {
    redirect("/admin/login");
  }

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="flex-1">
        <AdminDashboard />
      </div>
    </div>
  );
}
