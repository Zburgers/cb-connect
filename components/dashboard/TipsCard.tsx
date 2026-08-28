"use client";

import { Lightbulb } from "lucide-react";
import { getPublicSupportCopy } from "./cycleStateCopy";

interface TipsCardProps {
  tip: {
    title: string;
    suggestions: string[];
    safetyNote: string;
  };
}

export default function TipsCard({ tip }: TipsCardProps) {
  const supportCopy = getPublicSupportCopy({
    state: "calendar_estimate",
  });

  return (
    <div className="glass-card rounded-3xl p-6 bg-gradient-to-br from-primary/5 to-secondary/5
      border-0 shadow-lg animate-slide-up">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Lightbulb className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">{tip.title}</h3>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {supportCopy.copy.label}
          </p>
        </div>
      </div>

      <ul className="space-y-3">
        {tip.suggestions.map((suggestion, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/15
              flex items-center justify-center mt-0.5">
              <span className="text-primary text-xs font-bold">{i + 1}</span>
            </span>
            <span className="text-sm text-foreground">{suggestion}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 p-4 rounded-2xl bg-muted/60 border border-border">
        <p className="text-xs text-muted-foreground flex items-start gap-2">
          <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
          {tip.safetyNote}
        </p>
      </div>
    </div>
  );
}
