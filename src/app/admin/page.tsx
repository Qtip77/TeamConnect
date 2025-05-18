import { redirect } from "next/navigation";

import AdminTable from "@/components/admin-table";
import { requireAdmin } from "@/lib/auth-utils";

export const metadata = {
  title: "Admin Dashboard",
  description: "User management and administration tools",
};

export default async function AdminPage() {
  // Ensure user is authenticated and has admin role
  const session = await requireAdmin();

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage users, roles, and system settings
        </p>
      </div>
      
      <AdminTable />
    </div>
  );
} 