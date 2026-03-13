"use client";

import { Lightbulb } from "lucide-react";

interface TipsCardProps {
  tip: {
    title: string;
    suggestions: string[];
    safetyNote: string;
  };
}

export default function TipsCard({ tip }: TipsCardProps) {
  return (
    <div className="glass-card rounded-3xl p-6 bg-gradient-to-br from-blue-50 to-indigo-100/50 
      dark:from-blue-950/30 dark:to-indigo-900/20 animate-slide-up border-0 shadow-lg">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-blue-500/10 dark:bg-blue-400/10 flex items-center 
          justify-center">
          <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">{tip.title}</h3>
      </div>
      
      <ul className="space-y-3">
        {tip.suggestions.map((suggestion, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 dark:bg-blue-400/20 
              flex items-center justify-center mt-0.5">
              <span className="text-blue-600 dark:text-blue-400 text-xs font-bold">{i + 1}</span>
            </span>
            <span className="text-sm text-blue-800 dark:text-blue-200">{suggestion}</span>
          </li>
        ))}
      </ul>
      
      <div className="mt-5 p-4 rounded-2xl bg-blue-500/10 dark:bg-blue-400/10 border border-blue-500/20">
        <p className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
          <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {tip.safetyNote}
        </p>
      </div>
    </div>
  );
}
