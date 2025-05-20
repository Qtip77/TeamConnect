import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="border-b">
        <div className="container flex h-14 items-center px-4">
          <nav className="flex items-center space-x-4 lg:space-x-6">
            <Link
              href="/admin"
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/trucks"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Trucks
            </Link>
            <Link
              href="/admin/timesheets"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Timesheets
            </Link>
          </nav>
        </div>
      </div>
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
} 