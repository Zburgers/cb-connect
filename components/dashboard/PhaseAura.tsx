"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { motion, useReducedMotion } from "framer-motion";
import { BellRing, CalendarDays, HeartPulse, Radio, Sparkles, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { getPainSeverityBucket, getPhaseEmoji } from "@/lib/utils";
import { getNudgeMessage, NUDGE_EMOJIS } from "@/lib/nudges.mjs";

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
  const presenceLabel = perspective === "partner" ? "Both online now" : "Partner online now";
  const nudgeTarget = perspective === "partner" ? "your partner" : "partner";
  const [sendingEmoji, setSendingEmoji] = useState<string | null>(null);
  const [sentEmoji, setSentEmoji] = useState<string | null>(null);
  const latestNudge = useQuery(api.queries.nudges.latestReceived, {});
  const sendNudge = useMutation(api.mutations.nudges.send);
  const markNudgeSeen = useMutation(api.mutations.nudges.markSeen);

  const handleNudge = async (emoji: string) => {
    if (sendingEmoji) return;
    setSendingEmoji(emoji);
    setSentEmoji(null);
    try {
      await sendNudge({ emoji });
      setSentEmoji(emoji);
    } finally {
      setSendingEmoji(null);
    }
  };

  return (
    <div
      data-phase={phase}
      className={`bento-cell-warm relative isolate overflow-hidden ${partnerPresent ? "ring-2 ring-sky-300/80 dark:ring-sky-200/70" : ""}`}
      style={{
        padding: "2rem",
        borderRadius: "var(--radius-xl)",
        boxShadow: partnerPresent
          ? "inset 0 1px 0 var(--color-glass-border), 0 0 0 1px color-mix(in oklch, hsl(var(--primary)) 42%, transparent), 0 24px 90px color-mix(in oklch, hsl(var(--primary)) 24%, transparent)"
          : undefined,
      }}
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
            animate={shouldReduceMotion ? undefined : { opacity: [0.28, 0.58, 0.28] }}
            transition={shouldReduceMotion ? undefined : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            style={{
              background:
                "radial-gradient(circle at 78% 18%, color-mix(in oklch, hsl(var(--primary)) 32%, transparent) 0%, transparent 44%), radial-gradient(circle at 8% 92%, color-mix(in oklch, hsl(var(--secondary)) 24%, transparent) 0%, transparent 42%)",
              pointerEvents: "none",
            }}
            aria-hidden="true"
          />
          <motion.div
            className="absolute inset-0 rounded-[inherit] border-2"
            animate={shouldReduceMotion ? undefined : {
              borderColor: [
                "color-mix(in oklch, hsl(var(--primary)) 46%, transparent)",
                "color-mix(in oklch, hsl(var(--primary)) 88%, transparent)",
                "color-mix(in oklch, hsl(var(--primary)) 46%, transparent)",
              ],
            }}
            transition={shouldReduceMotion ? undefined : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            style={{
              borderColor: "color-mix(in oklch, hsl(var(--primary)) 64%, transparent)",
            }}
            aria-hidden="true"
          />
          <motion.div
            className="absolute right-0 top-8 h-24 w-1 rounded-l-full bg-primary"
            animate={shouldReduceMotion ? undefined : { opacity: [0.45, 1, 0.45] }}
            transition={shouldReduceMotion ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            style={{ boxShadow: "0 0 30px hsl(var(--primary))" }}
            aria-hidden="true"
          />
          <div
            className="absolute left-8 right-8 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, hsl(var(--primary)), hsl(var(--secondary)), transparent)",
            }}
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

          {partnerPresent && (
            <div className="space-y-3">
              <motion.div
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-foreground"
                style={{
                  background: "var(--color-glass)",
                  border: "1px solid color-mix(in oklch, hsl(var(--primary)) 58%, var(--color-glass-border))",
                  boxShadow: "0 12px 34px color-mix(in oklch, hsl(var(--primary)) 20%, transparent)",
                }}
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="relative flex h-3 w-3" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-65" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
                </span>
                <Radio className="h-4 w-4 text-primary" aria-hidden="true" />
                {presenceLabel}
              </motion.div>

              <motion.div
                className="w-fit rounded-[1.5rem] p-3"
                style={{
                  background: "var(--color-glass)",
                  border: "1px solid var(--color-glass-border)",
                  boxShadow: "inset 0 1px 0 var(--color-glass-border)",
                }}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-foreground">
                  <BellRing className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  Nudge {nudgeTarget}
                </p>
                <div className="flex flex-wrap gap-2">
                  {NUDGE_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleNudge(emoji)}
                      disabled={Boolean(sendingEmoji)}
                      className="grid h-11 w-11 place-items-center rounded-full text-xl transition hover:-translate-y-0.5 hover:bg-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-60 dark:hover:bg-white/15"
                      style={{
                        background:
                          sentEmoji === emoji
                            ? "color-mix(in oklch, hsl(var(--primary)) 18%, var(--color-glass))"
                            : "var(--color-glass)",
                        border: "1px solid var(--color-glass-border)",
                      }}
                      aria-label={`Send nudge: ${getNudgeMessage(emoji)}`}
                    >
                      {sendingEmoji === emoji ? "…" : emoji}
                    </button>
                  ))}
                </div>
                {sentEmoji && (
                  <p className="mt-2 text-xs font-semibold text-foreground">
                    Sent {sentEmoji} to {nudgeTarget}.
                  </p>
                )}
              </motion.div>
            </div>
          )}

          {latestNudge && (
            <motion.div
              className="max-w-sm rounded-[1.5rem] p-4 text-foreground"
              style={{
                background: "color-mix(in oklch, hsl(var(--primary)) 18%, var(--color-glass))",
                border: "1px solid color-mix(in oklch, hsl(var(--primary)) 62%, var(--color-glass-border))",
                boxShadow: "0 18px 48px color-mix(in oklch, hsl(var(--primary)) 22%, transparent)",
              }}
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
              role="status"
            >
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-full bg-white/70 text-2xl dark:bg-white/15">
                  {latestNudge.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-[0.18em]">
                    {latestNudge.senderName} nudged you
                  </p>
                  <p className="mt-1 text-sm font-semibold">{latestNudge.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => markNudgeSeen({ nudgeId: latestNudge._id })}
                  className="rounded-full p-1.5 text-foreground/70 transition hover:bg-white/60 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:hover:bg-white/15"
                  aria-label="Dismiss nudge"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </motion.div>
          )}

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
