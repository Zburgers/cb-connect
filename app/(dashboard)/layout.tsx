"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/common/ThemeToggle";
import { Home, PenTool, Heart, Settings } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/dashboard/log", label: "Log", icon: PenTool },
  { href: "/dashboard/partner", label: "Partner", icon: Heart },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient background blobs (dark mode only) */}
      <div className="fixed inset-0 dark:block hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-blob" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-blob animation-delay-4000" />
      </div>

      {/* Top nav */}
      <header className="glass-elevated border-b sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            CB Connect
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserButton afterSignOutUrl="/" />
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
    </div>
  );
}
