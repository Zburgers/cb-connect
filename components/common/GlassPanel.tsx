import { cn } from "@/lib/utils";

type GlassPanelProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "quiet" | "elevated" | "warm";
};

export default function GlassPanel({
  variant = "quiet",
  className,
  children,
  ...props
}: GlassPanelProps) {
  return (
    <div
      className={cn(
        variant === "quiet"    && "bento-cell rounded-[var(--radius-xl)]",
        variant === "elevated" && "glass-elevated rounded-[var(--radius-xl)]",
        variant === "warm"     && "bento-cell-warm rounded-[var(--radius-xl)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
