"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { formatDate } from "@/lib/utils";

export default function LogPage() {
  const periodHistory = useQuery(api.queries.history.getPeriodHistory);
  const logPeriodStart = useMutation(api.mutations.periods.logPeriodStart);
  const logPeriodEnd = useMutation(api.mutations.periods.logPeriodEnd);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  if (periodHistory === undefined) return <LoadingSpinner />;

  const ongoingPeriod = periodHistory?.find((p: any) => !p.endDate);

  const handleStartPeriod = async () => {
    if (!startDate) return;
    setIsSubmitting(true);
    try {
      await logPeriodStart({ startDate });
      setStartDate("");
      setMessage("Period started!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error: any) {
      setMessage(error.message || "Failed to log period start");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndPeriod = async () => {
    if (!endDate) return;
    setIsSubmitting(true);
    try {
      await logPeriodEnd({ endDate });
      setEndDate("");
      setMessage("Period ended!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error: any) {
      setMessage(error.message || "Failed to log period end");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Period Log</h1>

      {message && (
        <div className="p-3 bg-green-50 text-green-800 rounded-xl text-sm">
          {message}
        </div>
      )}

      {/* Log period start/end */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        {ongoingPeriod ? (
          <>
            <div className="p-3 bg-pink-50 text-pink-800 rounded-xl text-sm">
              Period in progress since {formatDate(ongoingPeriod.startDate)}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                When did your period end?
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={ongoingPeriod.startDate}
                max={new Date().toISOString().split("T")[0]}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
            <button
              onClick={handleEndPeriod}
              disabled={isSubmitting || !endDate}
              className="w-full py-3 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? "Saving..." : "End Period"}
            </button>
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                When did your period start?
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
            <button
              onClick={handleStartPeriod}
              disabled={isSubmitting || !startDate}
              className="w-full py-3 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? "Saving..." : "Start Period"}
            </button>
          </>
        )}
      </div>

      {/* Period history */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Period History</h2>
        {periodHistory && periodHistory.length > 0 ? (
          <div className="space-y-3">
            {periodHistory.slice(0, 12).map((period: any) => (
              <div
                key={period._id}
                className="flex justify-between items-center p-3 bg-gray-50 rounded-xl"
              >
                <div>
                  <p className="font-medium text-sm text-gray-900">
                    {formatDate(period.startDate)}
                  </p>
                  {period.endDate && (
                    <p className="text-xs text-gray-500">
                      to {formatDate(period.endDate)}
                    </p>
                  )}
                </div>
                {!period.endDate && (
                  <span className="text-xs bg-pink-100 text-pink-700 px-2 py-1 rounded-full">
                    Ongoing
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">No periods logged yet.</p>
        )}
      </div>
    </div>
  );
}
