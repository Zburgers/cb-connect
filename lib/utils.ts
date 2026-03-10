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
    menstruation: "bg-red-100 text-red-800 border-red-200",
    follicular: "bg-green-100 text-green-800 border-green-200",
    ovulation: "bg-orange-100 text-orange-800 border-orange-200",
    luteal: "bg-purple-100 text-purple-800 border-purple-200",
  };
  return colors[phase] ?? "bg-gray-100 text-gray-800 border-gray-200";
}
