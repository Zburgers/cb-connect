"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, HeartPulse, Minus, Plus } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import GlassPanel from "@/components/common/GlassPanel";
import { cn, toLocalDateString } from "@/lib/utils";

const PAIN_TAGS = [
  { value: "cramps", label: "Cramps" },
  { value: "headache", label: "Head pressure" },
  { value: "back", label: "Back ache" },
  { value: "fatigue", label: "Low energy" },
  { value: "other", label: "Something else" },
] as const;

const FEELING_BANDS = [
  { label: "Clear", help: "Body feels mostly okay", score: 0 },
  { label: "Tender", help: "Noticeable but manageable", score: 3 },
  { label: "Heavy", help: "Needs a softer day", score: 6 },
  { label: "Rough", help: "Needs active care", score: 8 },
] as const;

interface TactilePainLoggerProps {
  currentPain: {
    score: number;
    severity: string;
    tags?: string[];
    note?: string;
  } | null;
}

function feelingForScore(score: number) {
  if (score <= 1) return "Clear";
  if (score <= 4) return "Tender";
  if (score <= 7) return "Heavy";
  return "Rough";
}

export default function TactilePainLogger({ currentPain }: TactilePainLoggerProps) {
  const [painScore, setPainScore] = useState(currentPain?.score ?? 0);
  const [selectedTags, setSelectedTags] = useState<string[]>(currentPain?.tags ?? []);
  const [note, setNote] = useState(currentPain?.note ?? "");
  const [isLogging, setIsLogging] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const logPain = useMutation(api.mutations.painLog.createOrUpdatePainLog);
  const activeFeeling = feelingForScore(painScore);

  const handleSubmit = async () => {
    setIsLogging(true);
    setSaved(false);
    setError("");
    try {
      await logPain({
        date: toLocalDateString(),
        painScore,
        tags: selectedTags as any,
        note: note || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err?.message ?? "Could not save this check-in.");
    } finally {
      setIsLogging(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <GlassPanel variant="quiet" className="overflow-hidden p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Body check-in
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground">
            How does today feel?
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            Choose the closest feeling first. The number stays here for accuracy, not as the main story.
          </p>
        </div>
        <div className="hidden h-14 w-14 items-center justify-center rounded-3xl bg-primary/[0.12] text-primary md:flex">
          <HeartPulse className="h-7 w-7" />
        </div>
      </div>

      <div
        className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4"
        role="group"
        aria-label="How today feels"
      >
        {FEELING_BANDS.map((band) => {
          const selected = activeFeeling === band.label;
          return (
            <button
              key={band.label}
              type="button"
              onClick={() => setPainScore(band.score)}
              aria-pressed={selected}
              className={cn(
                "touch-target rounded-[1.4rem] border p-4 text-left transition-all press-feedback",
                selected
                  ? "border-primary/50 bg-primary text-primary-foreground shadow-xl shadow-primary/20"
                  : "border-white/50 bg-white/[0.42] text-foreground hover:bg-white/[0.64] dark:border-white/10 dark:bg-white/[0.07] dark:hover:bg-white/[0.12]"
              )}
            >
              <span className="block font-semibold">{band.label}</span>
              <span className={cn("mt-1 block text-xs leading-5", selected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                {band.help}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 rounded-[1.6rem] border border-white/50 bg-white/[0.42] p-4 dark:border-white/10 dark:bg-white/[0.07]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Fine tune intensity</p>
            <p className="text-xs text-muted-foreground">Saved as {painScore}/10 for your history.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPainScore((score) => Math.max(0, score - 1))}
              className="touch-target rounded-full bg-muted text-foreground press-feedback"
              aria-label="Decrease pain intensity"
            >
              <Minus className="mx-auto h-4 w-4" />
            </button>
            <motion.span
              key={painScore}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="block min-w-12 text-center font-data text-3xl font-semibold text-primary"
            >
              {painScore}
            </motion.span>
            <button
              type="button"
              onClick={() => setPainScore((score) => Math.min(10, score + 1))}
              className="touch-target rounded-full bg-muted text-foreground press-feedback"
              aria-label="Increase pain intensity"
            >
              <Plus className="mx-auto h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-sm font-semibold text-foreground">What is asking for attention?</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PAIN_TAGS.map((tag) => (
            <button
              key={tag.value}
              onClick={() => toggleTag(tag.value)}
              type="button"
              className={cn(
                "touch-target rounded-full px-4 py-2 text-sm font-medium transition-all press-feedback",
                selectedTags.includes(tag.value)
                  ? "bg-foreground text-background dark:bg-white dark:text-slate-950"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <label className="text-sm font-semibold text-foreground" htmlFor="pain-note">
          Anything your partner should understand?
        </label>
        <textarea
          id="pain-note"
          value={note}
          onChange={(event) => setNote(event.target.value.slice(0, 140))}
          placeholder="e.g. I can function, but I need a slower evening."
          rows={3}
          className="mt-3 w-full resize-none rounded-[1.4rem] border border-white/50 bg-white/50 px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/15 dark:border-white/10 dark:bg-white/7"
        />
        <p className="mt-2 text-right text-xs text-muted-foreground">{note.length}/140</p>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isLogging}
        className="mt-6 flex w-full touch-target items-center justify-center gap-2 rounded-[1.4rem] bg-foreground px-5 py-4 font-semibold text-background shadow-2xl shadow-foreground/10 transition-all press-feedback disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950"
      >
        {saved ? (
          <>
            <Check className="h-5 w-5" />
            Check-in saved
          </>
        ) : (
          <>
            <HeartPulse className="h-5 w-5" />
            {isLogging ? "Saving..." : "Save today’s signal"}
          </>
        )}
      </button>
    </GlassPanel>
  );
}
