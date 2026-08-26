"use client";

import { motion } from "framer-motion";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { X } from "lucide-react";
import {
  cycleStateCopy,
  getPublicSupportCopy,
  type ExplicitUserReport,
  type CycleStateCopyState,
} from "./cycleStateCopy";

interface NutritionTip {
  _id: any;
  foodItem: string;
  reasoning: string;
}

interface NutritionSuggestionsProps {
  tips: NutritionTip[];
  phase?: string | null;
  state?: CycleStateCopyState;
  explicitReport?: ExplicitUserReport | null;
}

export default function NutritionSuggestions({
  tips,
  phase,
  state = "calendar_estimate",
  explicitReport,
}: NutritionSuggestionsProps) {
  const hideTip = useMutation(api.mutations.misc.hideNutritionTip);
  const supportCopy = getPublicSupportCopy({ state, explicitReport });
  const showCalendarTips = supportCopy.key === "calendarEstimate";

  if (tips.length === 0 && showCalendarTips) return null;

  return (
    <div
      className="bento-cell overflow-hidden"
      style={{ borderRadius: "var(--radius-xl)" }}
    >
      <div className="p-6">
        <div className="mb-5">
          <p
            className="text-xs font-semibold uppercase tracking-[0.22em]"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            {supportCopy.copy.label}
          </p>
          <p
            className="mt-2 font-display"
            style={{
              fontSize: "var(--text-2xl)",
              fontStyle: "italic",
              lineHeight: 1.2,
              color: "hsl(var(--foreground))",
            }}
          >
            {supportCopy.copy.title}
          </p>
          <p
            className="mt-2 text-sm leading-6"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            {supportCopy.copy.text}
          </p>
          {showCalendarTips && phase === "ovulation" && (
            <p
              className="mt-2 text-xs leading-5"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              {cycleStateCopy.estimatedOvulationDisclaimer.text}
            </p>
          )}
        </div>

        {showCalendarTips && (
          <div className="space-y-3">
            {tips.map((tip, i) => (
            <motion.div
              key={tip._id}
              className="group flex items-start justify-between gap-3 rounded-[1.2rem] p-4"
              style={{
                background: "oklch(100% 0 0 / 0.45)",
                backdropFilter: "blur(8px)",
                boxShadow: "inset 0 1px 0 oklch(100% 0 0 / 0.5)",
              }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, type: "spring", stiffness: 300, damping: 22 }}
              whileHover={{ y: -2 }}
            >
              <div className="flex-1">
                {/* Food item — high-contrast serif, the star */}
                <p
                  className="font-display font-semibold"
                  style={{
                    fontSize: "var(--text-lg)",
                    fontStyle: "italic",
                    color: "hsl(var(--foreground))",
                    lineHeight: 1.2,
                  }}
                >
                  {tip.foodItem}
                </p>
                {/* Reasoning — small and whispered */}
                <p
                  className="mt-1 text-xs leading-5"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  {tip.reasoning}
                </p>
              </div>

              <motion.button
                onClick={() => hideTip({ nutritionTipId: tip._id })}
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 no-tap-highlight"
                style={{ color: "hsl(var(--muted-foreground))" }}
                title="Dismiss for 30 days"
                aria-label={`Dismiss ${tip.foodItem}`}
              >
                <X className="h-3.5 w-3.5" />
              </motion.button>
            </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
