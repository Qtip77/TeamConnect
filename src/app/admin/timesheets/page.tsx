import { redirect } from "next/navigation";

import { TimesheetsAdmin } from "@/components/timesheets-admin";
import { requireAdmin } from "@/lib/auth-utils";

export const metadata = {
  title: "Timesheet Management",
  description: "Admin interface for managing all employee timesheets",
};

export default async function AdminTimesheetsPage() {
  // Ensure user is authenticated and has admin role
  const session = await requireAdmin();

  if (!session) {
    return redirect("/login");
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Timesheet Management</h1>
        <p className="text-muted-foreground">
          Review, approve, update and manage all employee timesheet submissions
        </p>
      </div>
      
      <TimesheetsAdmin currentUser={{ id: session.user.id, role: "admin" }} />
    </div>
  );
} 