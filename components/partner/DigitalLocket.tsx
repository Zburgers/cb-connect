import { HeartHandshake, LockKeyhole } from "lucide-react";
import GlassPanel from "@/components/common/GlassPanel";
import { cn } from "@/lib/utils";

interface DigitalLocketProps {
  title: string;
  eyebrow?: string;
  description: string;
  code?: string | null;
  status?: "waiting" | "ready" | "connected";
  children?: React.ReactNode;
  className?: string;
}

export default function DigitalLocket({
  title,
  eyebrow = "Digital locket",
  description,
  code,
  status = "waiting",
  children,
  className,
}: DigitalLocketProps) {
  return (
    <GlassPanel variant="warm" className={cn("relative overflow-hidden p-6", className)}>
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 opacity-70" aria-hidden="true">
        <div className="phase-aura-field animate-aura-drift h-full w-full rounded-full" />
      </div>

      <div className="relative space-y-6">
        <div className="flex items-start gap-4">
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
            <div className="locket-shape absolute inset-0 bg-gradient-to-br from-primary/[0.35] via-secondary/[0.24] to-accent/[0.28]" />
            <div className="locket-shape absolute inset-2 border border-white/50 bg-white/[0.36] backdrop-blur-xl dark:border-white/10 dark:bg-white/8" />
            {status === "connected" ? (
              <HeartHandshake className="relative h-8 w-8 text-primary" />
            ) : (
              <LockKeyhole className="relative h-8 w-8 text-primary" />
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {eyebrow}
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-foreground">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        </div>

        {code && (
          <div className="rounded-[1.8rem] border border-white/50 bg-white/50 p-5 text-center backdrop-blur-xl dark:border-white/10 dark:bg-white/8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Pairing code
            </p>
            <p className="mt-2 font-data text-5xl font-semibold tracking-[0.18em] text-primary">
              {code}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Valid for 24 hours. Share it only with your partner.</p>
          </div>
        )}

        {children}
      </div>
    </GlassPanel>
  );
}
