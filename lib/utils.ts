import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
  return new Date(dateString + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getPhaseEmoji(phase: string): string {
  const emojis: Record<string, string> = {
    menstruation: "🌙",
    follicular: "🌱",
    ovulation: "🌸",
    luteal: "🍂",
  };
  return emojis[phase] ?? "🔄";
}

export function getPhaseColor(phase: string): string {
  const colors: Record<string, string> = {
    menstruation: "phase-card-menstruation",
    follicular: "phase-card-follicular",
    ovulation: "phase-card-ovulation",
    luteal: "phase-card-luteal",
  };
  return colors[phase] ?? "glass-card";
}

export function getPhaseGradient(phase: string): string {
  const gradients: Record<string, string> = {
    menstruation: "from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20",
    follicular: "from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20",
    ovulation: "from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20",
    luteal: "from-violet-50 to-violet-100/50 dark:from-violet-950/30 dark:to-violet-900/20",
  };
  return gradients[phase] ?? "from-gray-50 to-gray-100/50";
}

export function getPhaseDescription(phase: string): string {
  const descriptions: Record<string, string> = {
    menstruation: "Your period is here",
    follicular: "Post-period recovery phase",
    ovulation: "Ovulation window",
    luteal: "Pre-period phase",
  };
  return descriptions[phase] ?? "Cycle phase";
}

export function getPainSeverityBucket(score: number): "none" | "mild" | "moderate" | "severe" {
  if (score === 0) return "none";
  if (score <= 3) return "mild";
  if (score <= 6) return "moderate";
  return "severe";
}

export function getPainColor(score: number): string {
  if (score === 0) return "text-accent";
  if (score <= 3) return "text-yellow-600 dark:text-yellow-400";
  if (score <= 6) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

export function getPhaseIcon(phase: string) {
  // This will be used with Lucide icons in components
  const icons: Record<string, string> = {
    menstruation: "Moon",
    follicular: "Sprout",
    ovulation: "Flower",
    luteal: "Leaf",
  };
  return icons[phase] ?? "Circle";
}
