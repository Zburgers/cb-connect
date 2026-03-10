"use client";

import { getPhaseEmoji, getPhaseColor } from "@/lib/utils";

interface PartnerDashboardProps {
  data: any;
}

export default function PartnerDashboard({ data }: PartnerDashboardProps) {
  if (!data.hasData) {
    return (
      <div className="text-center py-12 space-y-4">
        <span className="text-6xl">💕</span>
        <h2 className="text-2xl font-bold text-gray-900">Partner Dashboard</h2>
        <p className="text-gray-600">{data.message || "Waiting for your partner to set up their account."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl p-6">
        <h1 className="text-2xl font-bold">Partner Dashboard</h1>
        <p className="text-white/80 text-sm mt-1">Here's how you can support today</p>
      </div>

      {data.cycleInfo && (
        <div className={`rounded-2xl p-6 border ${getPhaseColor(data.cycleInfo.phase)}`}>
          <div className="flex items-center gap-4">
            <span className="text-5xl">{getPhaseEmoji(data.cycleInfo.phase)}</span>
            <div>
              <h2 className="text-xl font-bold capitalize">{data.cycleInfo.phase} Phase</h2>
              <p className="text-sm opacity-80">{data.cycleInfo.phaseDescription}</p>
              <p className="text-xs opacity-60 mt-1">Day {data.cycleInfo.cycleDay} of cycle</p>
            </div>
          </div>
        </div>
      )}

      {data.painData && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Pain Status</h3>
          <div className="flex items-center gap-4">
            <div className={`text-3xl font-bold ${
              data.painData.score <= 3 ? "text-green-600" :
              data.painData.score <= 6 ? "text-orange-600" : "text-red-600"
            }`}>
              {data.painData.score}/10
            </div>
            <div>
              <p className="font-medium text-gray-700 capitalize">{data.painData.severity}</p>
              <p className="text-sm text-gray-500">Current pain level</p>
            </div>
          </div>
        </div>
      )}

      {!data.painData && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Pain Status</h3>
          <p className="text-gray-500 text-sm">
            No pain data shared today. Pain sharing may be disabled.
          </p>
        </div>
      )}

      {data.painTip && (
        <div className="bg-blue-50 rounded-2xl border border-blue-100 p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">How to Help</h3>
          <ul className="space-y-2">
            {data.painTip.suggestions.map((s: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm text-blue-800">
                <span className="text-blue-400">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
