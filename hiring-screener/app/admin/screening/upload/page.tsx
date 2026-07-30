import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/requireAdmin";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { UploadSessionForm } from "@/components/screening/UploadSessionForm";

export default function UploadSessionPage() {
  if (!isAdminAuthenticated()) {
    redirect("/admin/login");
  }

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="min-w-0 flex-1">
        <UploadSessionForm />
      </div>
    </div>
  );
}
