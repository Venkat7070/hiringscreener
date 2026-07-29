import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/requireAdmin";
import { LinkedInMessages } from "@/components/admin/LinkedInMessages";

export default function AdminLinkedInPage() {
  if (!isAdminAuthenticated()) {
    redirect("/admin/login");
  }

  return <LinkedInMessages />;
}
