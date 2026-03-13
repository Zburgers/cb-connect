"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getPhaseGradient } from "@/lib/utils";
import { Utensils, EyeOff } from "lucide-react";

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
    <div className={`glass-card rounded-3xl p-6 bg-gradient-to-br ${getPhaseGradient(phase)} 
      animate-slide-up border-0 shadow-lg`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-accent/10 dark:bg-accent/20 flex items-center 
          justify-center">
          <Utensils className="w-5 h-5 text-accent" />
        </div>
        <h3 className="text-lg font-semibold text-foreground capitalize">
          Nutrition for {phase} Phase
        </h3>
      </div>
      
      <div className="space-y-3">
        {tips.map((tip) => (
          <div
            key={tip._id}
            className="flex items-start justify-between gap-3 p-4 bg-muted/50 dark:bg-muted/30 
              rounded-2xl backdrop-blur-sm transition-all hover:bg-muted/80"
          >
            <div className="flex-1">
              <p className="font-medium text-foreground text-sm">{tip.foodItem}</p>
              <p className="text-xs text-muted-foreground mt-1">{tip.reasoning}</p>
            </div>
            <button
              onClick={() => hideTip({ nutritionTipId: tip._id })}
              type="button"
              className="text-muted-foreground hover:text-foreground p-2 rounded-full 
                hover:bg-muted/50 transition-all press-feedback no-tap-highlight touch-target"
              title="Hide for 30 days"
            >
              <EyeOff className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      
      {tips.length === 0 && (
        <div className="text-center py-8">
          <Utensils className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            No nutrition tips available for this phase right now.
          </p>
        </div>
      )}
    </div>
  );
}
