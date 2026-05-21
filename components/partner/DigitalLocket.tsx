import { HeartHandshake, LockKeyhole } from "lucide-react";
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
    <div
      className={cn("bento-cell-warm relative isolate overflow-hidden p-6 md:p-8", className)}
      style={{ borderRadius: "var(--radius-xl)" }}
    >
      {/* Ambient orb */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-60"
        aria-hidden="true"
      >
        <div className="phase-aura-field animate-aura-drift h-full w-full rounded-full" />
      </div>

      <div className="relative space-y-5">
        <div className="flex items-start gap-5">
          {/* Locket icon — seamless glass circle, no square border */}
          <div
            className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full"
            style={{
              background: "linear-gradient(135deg, oklch(from var(--color-phase-1) l c h / 0.28), oklch(from var(--color-phase-2) l c h / 0.20))",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 16px rgba(0,0,0,0.08)",
              backdropFilter: "blur(12px)",
            }}
          >
            {status === "connected" ? (
              <HeartHandshake className="h-7 w-7 text-primary" />
            ) : (
              <LockKeyhole className="h-7 w-7 text-primary" />
            )}
          </div>

          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {eyebrow}
            </p>
            <h2
              className="mt-2 font-display leading-tight text-foreground"
              style={{ fontSize: "var(--text-display-s)", fontStyle: "italic" }}
            >
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        </div>

        {code && (
          <div className="rounded-[1.6rem] bg-white/50 dark:bg-white/8 backdrop-blur-xl p-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Pairing code
            </p>
            <p
              className="mt-2 font-data text-5xl font-semibold tracking-[0.18em] text-primary"
              style={{ letterSpacing: "0.18em" }}
            >
              {code}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Valid for 24 hours. Share it only with your partner.
            </p>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
