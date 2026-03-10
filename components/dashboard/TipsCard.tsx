"use client";

interface TipsCardProps {
  tip: {
    title: string;
    suggestions: string[];
    safetyNote: string;
  };
}

export default function TipsCard({ tip }: TipsCardProps) {
  return (
    <div className="bg-blue-50 rounded-2xl border border-blue-100 p-6">
      <h3 className="text-lg font-semibold text-blue-900 mb-3">{tip.title}</h3>
      <ul className="space-y-2">
        {tip.suggestions.map((suggestion, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-blue-800">
            <span className="text-blue-400 mt-0.5">•</span>
            <span>{suggestion}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-blue-600 bg-blue-100 rounded-lg p-3">
        {tip.safetyNote}
      </p>
    </div>
  );
}
