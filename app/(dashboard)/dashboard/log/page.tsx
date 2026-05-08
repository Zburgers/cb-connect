"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { formatDate } from "@/lib/utils";

export default function LogPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const periodHistory = useQuery(
    api.queries.history.getPeriodHistory,
    isLoaded && isSignedIn ? {} : "skip"
  );
  const logPeriodStart = useMutation(api.mutations.periods.logPeriodStart);
  const logPeriodEnd = useMutation(api.mutations.periods.logPeriodEnd);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  if (!isLoaded || periodHistory === undefined) return <LoadingSpinner />;

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
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Period Log</h1>
        <p className="text-muted-foreground text-sm">Track your cycle history</p>
      </div>

      {message && (
        <div className="p-3 bg-primary/10 text-primary rounded-xl text-sm border border-primary/20">
          {message}
        </div>
      )}

      {/* Log period start/end */}
      <div className="glass-card rounded-3xl p-6 space-y-4 animate-slide-up">
        {ongoingPeriod ? (
          <>
            <div className="p-3 bg-secondary/10 text-secondary rounded-xl text-sm border border-secondary/20">
              Period in progress since {formatDate(ongoingPeriod.startDate)}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                When did your period end?
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={ongoingPeriod.startDate}
                max={new Date().toISOString().split("T")[0]}
                className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-foreground
                  focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
            </div>
            <button
              onClick={handleEndPeriod}
              disabled={isSubmitting || !endDate}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? "Saving..." : "End Period"}
            </button>
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                When did your period start?
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-foreground
                  focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
            </div>
            <button
              onClick={handleStartPeriod}
              disabled={isSubmitting || !startDate}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? "Saving..." : "Start Period"}
            </button>
          </>
        )}
      </div>

      {/* Period history */}
      <div className="glass-card rounded-3xl p-6 animate-slide-up">
        <h2 className="text-lg font-semibold text-foreground mb-4">Period History</h2>
        {periodHistory && periodHistory.length > 0 ? (
          <div className="space-y-3">
            {periodHistory.slice(0, 12).map((period: any) => (
              <div
                key={period._id}
                className="flex justify-between items-center p-3 bg-muted rounded-xl"
              >
                <div>
                  <p className="font-medium text-sm text-foreground">
                    {formatDate(period.startDate)}
                  </p>
                  {period.endDate && (
                    <p className="text-xs text-muted-foreground">
                      to {formatDate(period.endDate)}
                    </p>
                  )}
                </div>
                {!period.endDate && (
                  <span className="text-xs bg-secondary/10 text-secondary px-2 py-1 rounded-full border border-secondary/20">
                    Ongoing
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No periods logged yet.</p>
        )}
      </div>
    </div>
  );
}
