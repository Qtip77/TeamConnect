import { Plus, Clock, Truck, Users, GanttChartSquare, DollarSign } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth-utils";

export default async function HomePage() {
  const currentSession = await getCurrentUser();
  return (
    <div className="container mx-auto px-4 py-8 md:px-0 md:py-12">
      <div className="flex flex-col items-start gap-4 md:flex-row md:justify-between md:gap-8">
        <div className="flex-1 space-y-4">
          <h1 className="inline-block text-4xl font-extrabold tracking-tight lg:text-5xl">Abe McColm</h1>
          <p className="text-muted-foreground text-xl">Manage your company's fleet and employees.</p>
        </div>
        <div className="flex items-center gap-2">
          {currentSession ? (
            <>
              
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="bg-primary text-primary-foreground ring-offset-background hover:bg-primary/90 focus-visible:ring-ring inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="border-input bg-background text-foreground ring-offset-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-10 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
      <div className="py-8">
        <Suspense fallback={<div>Loading...</div>}>
          {currentSession?.user?.role === "admin" ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              <DashboardCard
                title="User Management"
                description="Manage users and their roles."
                href="/admin"
                icon={<Users className="h-8 w-8 text-blue-500" />}
              />
              <DashboardCard
                title="Trucks"
                description="Manage truck information and assignments."
                href="/admin/trucks"
                icon={<Truck className="h-8 w-8 text-green-500" />}
              />
              <DashboardCard
                title="Timesheet Table"
                description="View and manage timesheets."
                href="/admin/timesheets"
                icon={<GanttChartSquare className="h-8 w-8 text-purple-500" />}
              />
              <DashboardCard
                title="Billing Rates"
                description="Manage billing rates for timesheets."
                href="/admin/billing-rates"
                icon={<DollarSign className="h-8 w-8 text-amber-500" />}
              />
            </div>
          ) : currentSession?.user?.role === "driver" ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              <DashboardCard
                title="Trucks"
                description="View assigned trucks and details."
                href="/trucks"
                icon={<Truck className="h-8 w-8 text-green-500" />}
              />
              <DashboardCard
                title="Timesheet Submissions"
                description="View your past timesheet submissions."
                href="/driver/timesheets"
                icon={<Clock className="h-8 w-8 text-yellow-500" />}
              />
              <DashboardCard
                title="Create New Timesheet"
                description="Submit a new timesheet entry."
                href="/driver/timesheets/new"
                icon={<Plus className="h-8 w-8 text-blue-500" />}
              />
            </div>
          ) : (
            <div>Placeholder for other users</div>
          )}
        </Suspense>
      </div>
    </div>
  );
}

interface DashboardCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

function DashboardCard({ title, description, href, icon }: DashboardCardProps) {
  return (
    <Link href={href} className="block hover:shadow-lg transition-shadow duration-200 rounded-lg">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-bold">{title}</CardTitle>
          {icon}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
