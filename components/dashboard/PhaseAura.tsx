"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CalendarDays, HeartPulse, Sparkles } from "lucide-react";
import { getPainSeverityBucket, getPhaseEmoji } from "@/lib/utils";

interface PhaseAuraProps {
  phase: string;
  cycleDay: number;
  description: string;
  daysUntilNextPeriod: number;
  nextPeriodStart: string;
  painScore?: number | null;
  perspective?: "primary" | "partner";
  partnerPresent?: boolean;
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
  if (score === null || score === undefined)
    return { label: "No check-in yet", help: "A quick signal will tune today's support." };
  const bucket = getPainSeverityBucket(score);
  if (bucket === "none")     return { label: "Body feels clear",   help: "Keep the day easy and steady." };
  if (bucket === "mild")     return { label: "A little tender",    help: "Light support is probably enough." };
  if (bucket === "moderate") return { label: "Needs softness",     help: "Lower the load, add comfort." };
  return                            { label: "Rough day",          help: "Practical care beats big speeches." };
}

export default function PhaseAura({
  phase,
  cycleDay,
  description,
  daysUntilNextPeriod,
  nextPeriodStart,
  painScore,
  perspective = "primary",
  partnerPresent = false,
}: PhaseAuraProps) {
  const shouldReduceMotion = useReducedMotion();
  const copy  = phaseCopy[phase] ?? phaseCopy.follicular;
  const pain  = painPhrase(painScore);
  const pulseDuration = painScore != null && painScore >= 7 ? 8 : 13;

  return (
    <div
      data-phase={phase}
      className="bento-cell-warm relative isolate overflow-hidden"
      style={{ padding: "2rem", borderRadius: "var(--radius-xl)" }}
    >
      {/* ── Background orb ── */}
      <motion.div
        className="pointer-events-none absolute right-[-3rem] top-[-3rem] h-80 w-80 rounded-full"
        animate={shouldReduceMotion ? undefined : { scale: [1, 1.08, 0.97, 1], rotate: [0, 8, -5, 0] }}
        transition={shouldReduceMotion ? undefined : { duration: pulseDuration, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden="true"
      >
        <div
          className="phase-aura-field h-full w-full rounded-full"
          style={{ filter: "blur(32px) saturate(1.3)", opacity: 0.85 }}
        />
      </motion.div>

      {/* ── Partner presence glow indicator ── */}
      {partnerPresent && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          aria-hidden="true"
        >
          <motion.div
            className="absolute inset-0 rounded-[inherit]"
            animate={{ opacity: [0.15, 0.35, 0.15] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            style={{
              background: "radial-gradient(circle at center, rgba(59, 130, 246, 0.2) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
            aria-hidden="true"
          />
          <motion.div
            className="absolute inset-0 rounded-[inherit] border-2"
            animate={{ borderColor: ["rgba(59, 130, 246, 0.3)", "rgba(59, 130, 246, 0.6)", "rgba(59, 130, 246, 0.3)"] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            style={{
              borderColor: "rgba(59, 130, 246, 0.4)",
            }}
            aria-hidden="true"
          />
          {/* Dot indicator in the top-right */}
          <motion.div
            className="absolute top-4 right-4 h-3 w-3 rounded-full bg-blue-500"
            animate={{ scale: [1, 1.3, 1], boxShadow: ["0 0 8px rgba(59, 130, 246, 0.5)", "0 0 16px rgba(59, 130, 246, 0.8)", "0 0 8px rgba(59, 130, 246, 0.5)"] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden="true"
          />
        </motion.div>
      )}

      <div className="relative grid gap-6 md:grid-cols-[1.1fr_0.9fr] md:items-start">

        {/* ── Left column — editorial hero ── */}
        <div className="space-y-3">

          {/* Badge on its own row */}
          <div>
            <span className="phase-badge">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Today's shared signal
            </span>
          </div>

          {/* Phase label pill — own row, below badge */}
          <div>
            <span
              className="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-semibold capitalize"
              style={{
                background: "rgba(255,255,255,0.55)",
                backdropFilter: "blur(10px)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
                color: "hsl(var(--foreground))",
              }}
            >
              {phase.charAt(0).toUpperCase() + phase.slice(1)} Phase
            </span>
          </div>

          {/* Emoji + huge phase title */}
          <div className="pt-1">
            <p className="text-5xl leading-none md:text-6xl" aria-hidden="true">
              {getPhaseEmoji(phase)}
            </p>

            <motion.h2
              key={copy.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="font-display text-balance overflow-wrap-anywhere mt-3"
              style={{
                fontSize: "clamp(2.8rem, 7vw + 0.5rem, 5rem)",
                fontStyle: "italic",
                lineHeight: 0.94,
                letterSpacing: "-0.03em",
                color: "hsl(var(--foreground))",
                position: "relative",
                zIndex: 2,
              }}
            >
              {copy.title}
            </motion.h2>
          </div>

          <p
            className="max-w-sm text-sm leading-6"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            {perspective === "partner" ? copy.action : copy.tone}
          </p>
        </div>

        {/* ── Right column — data satellites ── */}
        <div className="grid gap-3">
          {/* Cycle day */}
          <div className="rounded-[1.4rem] bg-white/60 dark:bg-white/10 backdrop-blur-xl p-4">
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
              <div>
                <p className="font-semibold text-foreground">Cycle day {cycleDay}</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
              </div>
            </div>
          </div>

          {/* Pain signal */}
          <div className="rounded-[1.4rem] bg-white/60 dark:bg-white/10 backdrop-blur-xl p-4">
            <div className="flex items-start gap-3">
              <HeartPulse className="mt-0.5 h-5 w-5 flex-shrink-0 text-secondary" />
              <div>
                <p className="font-semibold text-foreground">{pain.label}</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{pain.help}</p>
              </div>
            </div>
          </div>

          {/* Countdown — high-contrast tile */}
          <motion.div
            key={daysUntilNextPeriod}
            className="rounded-[1.4rem] p-4 bg-foreground text-background"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <p
              className="font-data font-semibold leading-none"
              style={{ fontSize: "2.5rem", letterSpacing: "-0.04em" }}
            >
              {daysUntilNextPeriod}
            </p>
            <p className="mt-1 text-sm opacity-80">days until predicted period</p>
            <p className="mt-2 text-xs opacity-60">Estimated: {nextPeriodStart}</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
