import { TruckTable } from "@/components/truck-table";
import { requireAuth } from "@/lib/auth-utils";

export default async function TrucksPage() {
  // Check if the user is authenticated
  const session = await requireAuth("/login");
  const isAdmin = session.user.role === "admin";

  return (
    <div className="container mx-auto py-6">
      <TruckTable isAdmin={isAdmin} />
    </div>
  );
} 