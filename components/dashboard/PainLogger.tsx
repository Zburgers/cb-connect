"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

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

  const getPainColor = (score: number) => {
    if (score === 0) return "text-green-600";
    if (score <= 3) return "text-yellow-600";
    if (score <= 6) return "text-orange-600";
    return "text-red-600";
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        {currentPain ? "Update Today's Pain" : "Log Today's Pain"}
      </h2>

      <div className="space-y-5">
        {/* Pain slider */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-gray-700">Pain Level</label>
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
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>0</span>
            <span>5</span>
            <span>10</span>
          </div>
        </div>

        {/* Pain tags */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">Type of Pain</label>
          <div className="flex gap-2 flex-wrap">
            {PAIN_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() =>
                  setSelectedTags((prev) =>
                    prev.includes(tag)
                      ? prev.filter((t) => t !== tag)
                      : [...prev, tag]
                  )
                }
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedTags.includes(tag)
                    ? "bg-primary-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tag.charAt(0).toUpperCase() + tag.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Notes <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 140))}
            placeholder="e.g., Sharp pain, worse when sitting"
            rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{note.length}/140</p>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={isLogging}
          className="w-full py-3 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLogging ? "Saving..." : saved ? "Saved!" : "Log Pain"}
        </button>
      </div>
    </div>
  );
}
