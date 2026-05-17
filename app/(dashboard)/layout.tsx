"use client";

import { useEffect } from "react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import ThemeToggle from "@/components/common/ThemeToggle";
import SanctuaryShell from "@/components/common/SanctuaryShell";
import { Home, PenTool, Heart, Settings } from "lucide-react";
import { api } from "@/convex/_generated/api";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/dashboard/log", label: "Log", icon: PenTool },
  { href: "/dashboard/partner", label: "Partner", icon: Heart },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const ensureUser = useMutation(api.mutations.users.ensureUser);
  const me = useQuery(api.queries.users.getMe, isAuthenticated ? {} : "skip");

  // Sync Clerk user into Convex on first load — only fires once Convex has a valid token
  useEffect(() => {
    if (isAuthenticated) {
      ensureUser().catch(() => {
        // Non-fatal — page will still work via getMe
      });
    }
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect to onboarding if user exists but has no role yet
  useEffect(() => {
    if (me !== undefined && me !== null && !me.role) {
      router.replace("/onboarding");
    }
  }, [me, router]);

  return (
    <SanctuaryShell phase="follicular" intensity="medium">
      {/* Top nav */}
      <header className="glass-elevated sticky top-0 z-50 border-b">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="font-display text-2xl font-semibold tracking-tight text-foreground">
            CB Connect
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserButton />
          </div>
        </div>
      </header>
      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 relative z-10">
        {children}
      </main>
      {/* Bottom nav (mobile-first) */}
      <nav className="glass-elevated border-t fixed bottom-0 left-0 right-0 z-50">
        <div className="max-w-4xl mx-auto flex justify-around py-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center py-3 px-4 rounded-2xl transition-all duration-200 press-feedback no-tap-highlight touch-target
                  ${isActive
                    ? "text-primary bg-primary/10 dark:bg-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs mt-1 font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </SanctuaryShell>
  );
}
