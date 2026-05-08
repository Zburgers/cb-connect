"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getPainColor } from "@/lib/utils";
import { Check, Activity } from "lucide-react";

const PAIN_TAGS = ["cramps", "headache", "back", "fatigue", "other"] as const;

interface PainLoggerProps {
  currentPain: {
    score: number;
    severity: string;
    tags?: string[];
    note?: string;
  } | null;
}

export default function PainLogger({ currentPain }: PainLoggerProps) {
  const [painScore, setPainScore] = useState(currentPain?.score ?? 0);
  const [selectedTags, setSelectedTags] = useState<string[]>(currentPain?.tags ?? []);
  const [note, setNote] = useState(currentPain?.note ?? "");
  const [isLogging, setIsLogging] = useState(false);
  const [saved, setSaved] = useState(false);

  const logPain = useMutation(api.mutations.painLog.createOrUpdatePainLog);

  const handleSubmit = async () => {
    setIsLogging(true);
    setSaved(false);
    try {
      await logPain({
        date: new Date().toISOString().split("T")[0],
        painScore,
        tags: selectedTags as any,
        note: note || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Failed to log pain:", error);
    } finally {
      setIsLogging(false);
    }
  };

  const getPainLabel = (score: number) => {
    if (score === 0) return "No pain";
    if (score <= 3) return "Mild";
    if (score <= 6) return "Moderate";
    return "Severe";
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag]
    );
  };

  return (
    <div className="glass-card rounded-3xl p-6 animate-slide-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
          <Activity className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {currentPain ? "Update Today's Pain" : "Log Today's Pain"}
          </h2>
          <p className="text-xs text-muted-foreground">Track how you're feeling</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Pain slider */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-medium text-foreground">Pain Level</label>
            <span className={`text-sm font-semibold ${getPainColor(painScore)}`}>
              {painScore}/10 - {getPainLabel(painScore)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="10"
            value={painScore}
            onChange={(e) => setPainScore(parseInt(e.target.value))}
            className="w-full h-3 bg-muted rounded-full appearance-none cursor-pointer 
              accent-primary touch-target"
            style={{
              background: `linear-gradient(to right, hsl(var(--accent)) 0%, hsl(var(--accent)) ${painScore * 10}%, hsl(var(--muted)) ${painScore * 10}%, hsl(var(--muted)) 100%)`
            }}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>0</span>
            <span>5</span>
            <span>10</span>
          </div>
        </div>

        {/* Pain tags */}
        <div>
          <label className="text-sm font-medium text-foreground mb-3 block">Type of Pain</label>
          <div className="flex gap-2 flex-wrap">
            {PAIN_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                type="button"
                className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200 
                  press-feedback no-tap-highlight touch-target
                  ${selectedTags.includes(tag)
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
              >
                {tag.charAt(0).toUpperCase() + tag.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Notes <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 140))}
            placeholder="e.g., Sharp pain, worse when sitting"
            rows={2}
            className="w-full px-4 py-3 bg-muted/50 border border-input rounded-2xl text-sm 
              focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary 
              resize-none transition-all"
          />
          <p className="text-xs text-muted-foreground mt-2 text-right">{note.length}/140</p>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={isLogging}
          className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-semibold 
            hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all 
            press-feedback no-tap-highlight touch-target shadow-lg shadow-primary/30 
            flex items-center justify-center gap-2"
        >
          {saved ? (
            <>
              <Check className="w-5 h-5" />
              Saved!
            </>
          ) : (
            <>
              <Activity className="w-5 h-5" />
              {isLogging ? "Saving..." : "Log Pain"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
