"use client";

import { useEffect } from "react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "@/components/common/ThemeToggle";
import SanctuaryShell from "@/components/common/SanctuaryShell";
import PartnerChat from "@/components/partner/PartnerChat";
import { Home, PenTool, Heart, Settings } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { HEARTBEAT_INTERVAL_MS } from "@/lib/presence.mjs";
import { usePartnerPresence } from "@/lib/usePartnerPresence";
import { getLocalTimeZone } from "@/lib/utils";

const navItems = [
  { href: "/dashboard",          label: "Home",     icon: Home    },
  { href: "/dashboard/log",      label: "Log",      icon: PenTool },
  { href: "/dashboard/partner",  label: "Partner",  icon: Heart   },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const ensureUser = useMutation(api.mutations.users.ensureUser);
  const updateUserTimeZone = useMutation(api.mutations.users.updateUserTimeZone);
  const me = useQuery(api.queries.users.getMe, isAuthenticated ? {} : "skip");
  const coupleStatus = useQuery(
    api.queries.couples.getCoupleStatus,
    isAuthenticated && me?.role ? {} : "skip"
  );

  const partnerPresence = usePartnerPresence(isAuthenticated);
  const partnerPresent = partnerPresence.isPresent;

  // Send periodic heartbeat to indicate this user is online.
  const heartbeat = useMutation(api.mutations.presence.heartbeat);
  const goOffline = useMutation(api.mutations.presence.goOffline);

  // When authenticated, send an immediate heartbeat and then continue sending
  // every 30 seconds. Cleanup the interval on unmount.
  useEffect(() => {
    if (!isAuthenticated) return;
    heartbeat().catch(() => {});
    const interval = setInterval(() => {
      heartbeat().catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);

    const markOffline = () => {
      goOffline().catch(() => {});
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        markOffline();
      } else {
        heartbeat().catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", markOffline);
    window.addEventListener("beforeunload", markOffline);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", markOffline);
      window.removeEventListener("beforeunload", markOffline);
      markOffline();
    };
  }, [goOffline, heartbeat, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      ensureUser()
        .then(() => updateUserTimeZone({ timeZone: getLocalTimeZone() }))
        .catch(() => {});
    }
  }, [ensureUser, isAuthenticated, updateUserTimeZone]);

  useEffect(() => {
    if (me !== undefined && me !== null && !me.role) {
      router.replace("/onboarding");
    }
  }, [me, router]);

  // Derive current phase from pathname (dashboard page sets data-phase on its wrapper)
  // The SanctuaryShell defaults to follicular, actual phase is set by page
  const phase = "follicular";

  return (
    <SanctuaryShell phase={phase} intensity="medium" showPresenceGlow={partnerPresent}>

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 px-4 py-3 bg-white/70 dark:bg-zinc-950/60 backdrop-blur-2xl border-b border-black/[0.04] dark:border-white/[0.06]">
        <div className="mx-auto flex h-12 max-w-4xl items-center justify-between">
          <Link
            href="/dashboard"
            className="font-display text-xl font-semibold tracking-tight"
            style={{ fontStyle: "italic", color: "hsl(var(--foreground))" }}
          >
            CB Connect
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserButton />
          </div>
        </div>
      </header>

      {/* ── Page content ─────────────────────────────────────────── */}
      <main className="relative z-10 mx-auto max-w-4xl px-4 py-6 pb-28">
        {children}
      </main>

      {coupleStatus?.isLinked && (
        <PartnerChat
          partnerName={coupleStatus.partner?.displayName ?? coupleStatus.partner?.name}
          partnerImageUrl={coupleStatus.partner?.imageUrl}
          showLauncher
        />
      )}

      {/* ── Bottom nav ───────────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-safe"
        aria-label="Bottom navigation"
      >
        <div
          className="mx-auto mb-4 flex max-w-sm items-center justify-around rounded-[2rem] px-2 py-2 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 32px rgba(0,0,0,0.14)" }}
        >
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex flex-col items-center py-2 px-4 no-tap-highlight"
                aria-current={isActive ? "page" : undefined}
              >
                <motion.div
                  whileTap={{ scale: 0.88 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  className="flex flex-col items-center gap-1"
                >
                  {/* Active pill background */}
                  {isActive && (
                    <motion.div
                      layoutId="nav-active-pill"
                      className="absolute inset-0 rounded-2xl"
                      style={{ background: "oklch(from var(--color-accent) l c h / 0.12)" }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      aria-hidden="true"
                    />
                  )}

                  <Icon
                    className="relative h-5 w-5 transition-colors"
                    style={{ color: isActive ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
                  />
                  <span
                    className="relative text-[10px] font-semibold transition-colors"
                    style={{ color: isActive ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
                  >
                    {item.label}
                  </span>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </nav>
    </SanctuaryShell>
  );
}
