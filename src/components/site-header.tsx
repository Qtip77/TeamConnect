"use client";

import type { Session, User } from "better-auth";
import { LogOut, Menu, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { authClient } from "@/lib/auth-client";

export function SiteHeader({ currentSession }: { currentSession: { user: User & { role?: string }; session: Session } | null }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await authClient.signOut();
      toast.success("You have been logged out successfully");
      router.refresh();
    } catch (error) {
      toast.error("Failed to logout. Please try again.");
    }
  };

  return (
    <header className="bg-background sticky top-0 z-40 w-full border-b px-4 md:px-0">
      <div className="container mx-auto flex h-16 items-center justify-between">
        <div className="flex gap-6 md:gap-10">
          <Link href="/" className="flex items-center space-x-2">
            <span className="hidden font-bold sm:inline-block">Next.js Blog</span>
          </Link>
          <nav className="hidden gap-6 md:flex">
            <Link
              href="/"
              className={`flex items-center text-sm font-medium ${
                pathname === "/" ? "text-foreground" : "text-foreground/60"
              } hover:text-foreground/80 transition-colors`}
            >
              Blog
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {currentSession ? (
            <>
              <Link
                href="/create"
                className="bg-primary text-primary-foreground hover:bg-primary/90 hidden h-9 items-center justify-center rounded-md px-3 text-sm font-medium shadow md:inline-flex"
              >
                <Plus className="mr-1 h-4 w-4" />
                New Post
              </Link>
              {currentSession.user.role === "admin" && (
                <Link
                  href="/admin"
                  className="bg-purple-700 text-white hover:bg-purple-800 hidden h-9 items-center justify-center rounded-md px-3 text-sm font-medium shadow md:inline-flex"
                >
                  Admin
                </Link>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="hidden h-9 md:inline-flex"
              >
                <LogOut className="mr-1 h-4 w-4" />
                Logout
              </Button>
            </>
          ) : (
            <Link
              href="/login"
              className="bg-primary text-primary-foreground hover:bg-primary/90 hidden h-9 items-center justify-center rounded-md px-3 text-sm font-medium shadow md:inline-flex"
            >
              Login
            </Link>
          )}
          <ThemeToggle />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <nav className="flex flex-col gap-4">
                <Link href="/" className="hover:text-foreground/80 text-sm font-medium transition-colors">
                  Blog
                </Link>
                {currentSession ? (
                  <>
                    <Link href="/create" className="hover:text-foreground/80 text-sm font-medium transition-colors">
                      Create Post
                    </Link>
                    {currentSession.user.role === "admin" && (
                      <Link href="/admin" className="hover:text-foreground/80 text-sm font-medium transition-colors">
                        Admin Dashboard
                      </Link>
                    )}
                    <button 
                      onClick={handleLogout}
                      className="hover:text-foreground/80 text-sm font-medium transition-colors text-left"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" className="hover:text-foreground/80 text-sm font-medium transition-colors">
                      Login
                    </Link>
                    <Link href="/register" className="hover:text-foreground/80 text-sm font-medium transition-colors">
                      Register
                    </Link>
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
