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
        "rounded-[2rem] border backdrop-blur-2xl",
        variant === "quiet" && "glass-card",
        variant === "elevated" && "glass-elevated",
        variant === "warm" &&
          "border-white/50 bg-gradient-to-br from-white/70 via-white/[0.42] to-primary/10 shadow-2xl shadow-primary/10 dark:border-white/10 dark:from-white/10 dark:via-white/5 dark:to-primary/10",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
