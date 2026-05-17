"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CalendarDays, HeartPulse, Sparkles } from "lucide-react";
import GlassPanel from "@/components/common/GlassPanel";
import { getPainSeverityBucket, getPhaseEmoji } from "@/lib/utils";

interface PhaseAuraProps {
  phase: string;
  cycleDay: number;
  description: string;
  daysUntilNextPeriod: number;
  nextPeriodStart: string;
  painScore?: number | null;
  perspective?: "primary" | "partner";
}

const phaseCopy: Record<string, { title: string; tone: string; action: string }> = {
  menstruation: {
    title: "Protected rhythm",
    tone: "Lower energy is not a failure. This is a care-first window.",
    action: "Warmth, fewer asks, and practical help matter most today.",
  },
  follicular: {
    title: "Rebuilding light",
    tone: "Energy often starts returning here. Keep it gentle, not rushed.",
    action: "Good window for small plans and easy momentum.",
  },
  ovulation: {
    title: "Bright window",
    tone: "This phase can feel more social, expressive, and outward.",
    action: "Plan connection, but keep consent and energy real.",
  },
  luteal: {
    title: "Dusk signal",
    tone: "Sensitivity can rise here. Predictability and patience help.",
    action: "Reduce friction, plan comfort, and avoid surprise pressure.",
  },
};

function painPhrase(score?: number | null) {
  if (score === null || score === undefined) {
    return { label: "No pain check-in yet", help: "A quick check-in will tune today’s support." };
  }

  const bucket = getPainSeverityBucket(score);
  if (bucket === "none") return { label: "Body feels clear", help: "Keep the day easy and steady." };
  if (bucket === "mild") return { label: "A little tender", help: "Light support is probably enough." };
  if (bucket === "moderate") return { label: "Needs softness", help: "Lower the load and add comfort." };
  return { label: "Rough day", help: "Practical care beats big speeches right now." };
}

function phaseLabel(phase: string) {
  return `${phase.charAt(0).toUpperCase()}${phase.slice(1)} phase`;
}

export default function PhaseAura({
  phase,
  cycleDay,
  description,
  daysUntilNextPeriod,
  nextPeriodStart,
  painScore,
  perspective = "primary",
}: PhaseAuraProps) {
  const shouldReduceMotion = useReducedMotion();
  const copy = phaseCopy[phase] ?? phaseCopy.follicular;
  const pain = painPhrase(painScore);
  const pulseDuration = painScore !== null && painScore !== undefined && painScore >= 7 ? 8 : 13;

  return (
    <GlassPanel
      variant="warm"
      data-phase={phase}
      className="relative isolate overflow-hidden p-6 md:p-8"
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-80 w-80 opacity-80" aria-hidden="true">
        <motion.div
          className="phase-aura-field h-full w-full rounded-full"
          animate={shouldReduceMotion ? undefined : { scale: [1, 1.08, 0.98, 1], rotate: [0, 8, -6, 0] }}
          transition={shouldReduceMotion ? undefined : { duration: pulseDuration, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative grid gap-6 md:grid-cols-[1.08fr_0.92fr] md:items-end">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/[0.46] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground backdrop-blur-xl dark:border-white/10 dark:bg-white/8">
            <Sparkles className="h-4 w-4 text-primary" />
            Today’s shared signal
          </div>

          <div className="space-y-3">
            <p className="inline-flex w-fit rounded-full border border-white/50 bg-white/50 px-4 py-2 text-sm font-semibold text-foreground backdrop-blur-xl dark:border-white/10 dark:bg-white/8">
              {phaseLabel(phase)}
            </p>
            <p className="text-6xl leading-none md:text-7xl" aria-hidden="true">
              {getPhaseEmoji(phase)}
            </p>
            <h2 className="max-w-2xl text-balance font-display text-5xl font-semibold leading-[0.95] tracking-tight text-foreground md:text-7xl">
              {copy.title}
            </h2>
            <p className="max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
              {perspective === "partner" ? copy.action : copy.tone}
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-[1.6rem] border border-white/50 bg-white/50 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/8">
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-1 h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold text-foreground">Cycle day {cycleDay}</p>
                <p className="text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-white/50 bg-white/50 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/8">
            <div className="flex items-start gap-3">
              <HeartPulse className="mt-1 h-5 w-5 text-secondary" />
              <div>
                <p className="font-semibold text-foreground">{pain.label}</p>
                <p className="text-sm leading-6 text-muted-foreground">{pain.help}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.6rem] bg-foreground/90 p-4 text-background shadow-2xl shadow-foreground/10 dark:bg-white/[0.86] dark:text-slate-950">
            <p className="font-data text-3xl font-semibold">{daysUntilNextPeriod}</p>
            <p className="text-sm opacity-80">days until predicted period</p>
            <p className="mt-2 text-xs opacity-70">Estimated start: {nextPeriodStart}</p>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
