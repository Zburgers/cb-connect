"use client";

import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface SanctuaryShellProps {
  children: React.ReactNode;
  phase?: string;
  intensity?: "soft" | "medium" | "heavy";
  className?: string;
  showPresenceGlow?: boolean;
}

export default function SanctuaryShell({
  children,
  phase = "follicular",
  intensity = "medium",
  className,
  showPresenceGlow = false,
}: SanctuaryShellProps) {
  return (
    <div
      data-phase={phase}
      className={cn("sanctuary-surface relative min-h-screen", className)}
      style={{ overflowX: "clip" }}
    >
      {/* Ambient noise texture */}
      <div className="noise-overlay" aria-hidden="true" />

      {/* Phase atmosphere */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <div
          className={cn(
            "phase-aura-field animate-aura-drift absolute left-1/2 top-8 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full",
            intensity === "soft"   && "opacity-30",
            intensity === "medium" && "opacity-55",
            intensity === "heavy"  && "opacity-78"
          )}
        />
        {/* Secondary bloom — lower right */}
        <div
          className={cn(
            "phase-aura-field animate-aura-drift absolute right-[-4rem] bottom-[-4rem] h-64 w-64 rounded-full opacity-30",
          )}
          style={{ animationDelay: "7s", animationDirection: "reverse" }}
        />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/[0.22] to-transparent dark:from-white/[0.04]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,oklch(0%_0_0/0.06))]" />
      </div>

      {/* Partner presence glow */}
      <AnimatePresence>
        {showPresenceGlow && (
          <motion.div
            className="presence-glow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, ease: "easeInOut" }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
