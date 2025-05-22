import { redirect } from "next/navigation";
import { BillingRatesTable } from "@/components/billingrates-table";
import { requireAdmin } from "@/lib/auth-utils";

export default async function BillingRatesPage() {
  // Ensure only admins can access this page
  await requireAdmin("/");

  return (
    <div className="container mx-auto py-10">
      <BillingRatesTable isAdmin={true} />
    </div>
  );
} 