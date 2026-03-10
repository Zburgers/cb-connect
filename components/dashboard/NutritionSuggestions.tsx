"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getPhaseEmoji } from "@/lib/utils";

interface NutritionTip {
  _id: any;
  foodItem: string;
  reasoning: string;
}

interface NutritionSuggestionsProps {
  tips: NutritionTip[];
  phase: string;
}

export default function NutritionSuggestions({ tips, phase }: NutritionSuggestionsProps) {
  const hideTip = useMutation(api.mutations.misc.hideNutritionTip);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">{getPhaseEmoji(phase)}</span>
        <h3 className="text-lg font-semibold text-gray-900">
          Nutrition for <span className="capitalize">{phase}</span> Phase
        </h3>
      </div>
      <div className="space-y-3">
        {tips.map((tip) => (
          <div
            key={tip._id}
            className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-xl"
          >
            <div className="flex-1">
              <p className="font-medium text-gray-900 text-sm">{tip.foodItem}</p>
              <p className="text-xs text-gray-500 mt-0.5">{tip.reasoning}</p>
            </div>
            <button
              onClick={() => hideTip({ nutritionTipId: tip._id })}
              className="text-gray-400 hover:text-gray-600 text-xs shrink-0"
              title="Hide for 30 days"
            >
              Hide
            </button>
          </div>
        ))}
      </div>
      {tips.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">
          No nutrition tips available for this phase right now.
        </p>
      )}
    </div>
  );
}
