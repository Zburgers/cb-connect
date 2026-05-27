import { LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";

interface DigitalLocketProps {
  title: string;
  eyebrow?: string;
  description: string;
  code?: string | null;
  status?: "waiting" | "ready" | "connected";
  connectedSinceDate?: string | null;
  children?: React.ReactNode;
  className?: string;
}

export default function DigitalLocket({
  title,
  eyebrow = "Digital locket",
  description,
  code,
  status = "waiting",
  connectedSinceDate,
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
            className="relative flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-[2rem]"
            style={{
              background: "linear-gradient(135deg, var(--color-glass-2), oklch(from var(--color-phase-1) l c h / 0.16))",
              boxShadow: "inset 0 1px 0 var(--color-glass-border), 0 18px 44px var(--shadow-warm)",
              backdropFilter: "blur(12px)",
            }}
          >
            {status === "connected" ? (
              <img
                src="/assets/partner/digital-locket.png"
                alt=""
                className="h-20 w-20 object-contain drop-shadow-2xl"
              />
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
            {connectedSinceDate && (
              <p className="mt-3 inline-flex rounded-full bg-foreground px-4 py-2 text-xs font-bold text-background">
                Locket connected since {formatConnectedSince(connectedSinceDate)}
              </p>
            )}
          </div>
        </div>

        {code && (
          <div className="contrast-glass rounded-[1.6rem] p-5 text-center">
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

function formatConnectedSince(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
