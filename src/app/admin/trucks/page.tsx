import { TruckTable } from "@/components/truck-table";
import { requireAdmin } from "@/lib/auth-utils";

export default async function AdminTrucksPage() {
  // Check if the user is authenticated and has admin role
  const session = await requireAdmin("/");

  return (
    <div className="container mx-auto py-6">
      <TruckTable isAdmin={session.user.role === "admin"} />
    </div>
  );
} 