import { cn } from "@/lib/utils";

interface SanctuaryShellProps {
  children: React.ReactNode;
  phase?: string;
  intensity?: "soft" | "medium" | "heavy";
  className?: string;
}

export default function SanctuaryShell({
  children,
  phase = "follicular",
  intensity = "medium",
  className,
}: SanctuaryShellProps) {
  return (
    <div
      data-phase={phase}
      className={cn("sanctuary-surface relative min-h-screen overflow-hidden", className)}
    >
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <div
          className={cn(
            "phase-aura-field animate-aura-drift absolute left-1/2 top-8 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full opacity-60",
            intensity === "soft" && "opacity-36 blur-3xl",
            intensity === "heavy" && "opacity-80"
          )}
        />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/[0.28] to-transparent dark:from-white/5" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent,rgba(0,0,0,0.08))] dark:bg-[radial-gradient(circle_at_center,transparent,rgba(0,0,0,0.34))]" />
      </div>

      <div className="relative z-10">{children}</div>
    </div>
  );
}
