"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import GlassPanel from "@/components/common/GlassPanel";
import { formatDate, cn, localDateDaysAgo, toLocalDateString } from "@/lib/utils";
import { CalendarDays, Download, HeartPulse, Lock, Shield, Sparkles } from "lucide-react";

const PAIN_TAG_LABELS: Record<string, string> = {
  cramps: "Cramps",
  headache: "Head pressure",
  back: "Back ache",
  fatigue: "Low energy",
  other: "Something else",
};

function describePainVisibility(shared: boolean, partnerView: boolean) {
  if (shared) {
    return partnerView
      ? "Your partner can see this history."
      : "This history is shared with your partner.";
  }
  return partnerView
    ? "Your partner cannot see pain history right now."
    : "Pain history stays private unless you turn sharing on.";
}

function describePeriodVisibility(shared: boolean, partnerView: boolean) {
  if (shared) {
    return partnerView
      ? "Your partner can see period history."
      : "This history is shared with your partner.";
  }
  return partnerView
    ? "Your partner cannot see period history right now."
    : "Period history stays private unless you turn sharing on.";
}

function painScoreTone(score: number) {
  if (score === 0) return "bg-accent/10 text-accent";
  if (score <= 3) return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  if (score <= 6) return "bg-orange-500/10 text-orange-600 dark:text-orange-400";
  return "bg-destructive/10 text-destructive";
}

function csvCell(value: unknown) {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function LogPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const me = useQuery(api.queries.users.getMe, isLoaded && isSignedIn ? {} : "skip");
  const coupleStatus = useQuery(
    api.queries.couples.getCoupleStatus,
    isLoaded && isSignedIn ? {} : "skip"
  );
  const periodHistory = useQuery(
    api.queries.history.getPeriodHistory,
    isLoaded && isSignedIn ? {} : "skip"
  );
  const painHistory = useQuery(
    api.queries.history.getPainHistory,
    isLoaded && isSignedIn
      ? { startDate: localDateDaysAgo(30), endDate: toLocalDateString() }
      : "skip"
  );
  const logPeriodStart = useMutation(api.mutations.periods.logPeriodStart);
  const logPeriodEnd = useMutation(api.mutations.periods.logPeriodEnd);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  if (
    !isLoaded ||
    me === undefined ||
    coupleStatus === undefined ||
    periodHistory === undefined ||
    painHistory === undefined
  ) {
    return <LoadingSpinner />;
  }

  const isPartnerView = coupleStatus?.role === "partner";
  const canWrite = !isPartnerView;
  const isLinked = Boolean(coupleStatus?.isLinked);
  const phaseShared = Boolean(isLinked && coupleStatus?.sharingSettings?.phase);
  const painShared = Boolean(isLinked && coupleStatus?.sharingSettings?.pain);

  const ongoingPeriod = periodHistory?.find((period: any) => !period.endDate);
  const visiblePainHistory = (painShared || !isPartnerView) ? painHistory ?? [] : [];

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

  const handleExportCsv = () => {
    const rows: unknown[][] = [
      ["section", "date", "endDate", "painScore", "tags", "note", "status"],
      ...((canWrite || phaseShared) ? periodHistory ?? [] : []).map((period: any) => [
        "period",
        period.startDate,
        period.endDate ?? "",
        "",
        "",
        "",
        period.endDate ? "closed" : "open",
      ]),
      ...visiblePainHistory.map((pain: any) => [
        "pain",
        pain.date,
        "",
        pain.painScore,
        pain.tags?.join("; ") ?? "",
        pain.note ?? "",
        "",
      ]),
    ];

    downloadCsv(`cb-connect-history-${toLocalDateString()}.csv`, rows);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Shared history
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-foreground">
          {isPartnerView ? "Partner-visible history" : "Cycle history"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isPartnerView
            ? "This page shows only the data your partner chose to share."
            : "Review your period and pain history in one place."}
        </p>
      </div>

      {message && canWrite && (
        <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-sm text-primary">
          {message}
        </div>
      )}

      <GlassPanel variant="quiet" className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Privacy snapshot
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground">
              What your partner can see
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              These states reflect the current sharing toggles. A hidden state means the
              partner view stays read-only and intentionally blank for that section.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/[0.42] px-3 py-2 text-xs font-semibold text-foreground dark:border-white/10 dark:bg-white/[0.07]">
            <Shield className="h-4 w-4 text-primary" />
            {isLinked ? "Linked couple" : "Not linked"}
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <div className="rounded-[1.4rem] border border-white/50 bg-white/[0.42] p-4 dark:border-white/10 dark:bg-white/[0.07]">
            <div className="flex items-center gap-2">
              {phaseShared ? (
                <Sparkles className="h-4 w-4 text-primary" />
              ) : (
                <Lock className="h-4 w-4 text-muted-foreground" />
              )}
              <p className="text-sm font-semibold text-foreground">Period history</p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {describePeriodVisibility(phaseShared, isPartnerView)}
            </p>
          </div>

          <div className="rounded-[1.4rem] border border-white/50 bg-white/[0.42] p-4 dark:border-white/10 dark:bg-white/[0.07]">
            <div className="flex items-center gap-2">
              {painShared ? (
                <HeartPulse className="h-4 w-4 text-primary" />
              ) : (
                <Lock className="h-4 w-4 text-muted-foreground" />
              )}
              <p className="text-sm font-semibold text-foreground">Pain history</p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {describePainVisibility(painShared, isPartnerView)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </GlassPanel>

      {canWrite ? (
        <GlassPanel variant="quiet" className="space-y-4 p-6">
          {ongoingPeriod ? (
            <>
              <div className="rounded-2xl border border-secondary/20 bg-secondary/10 p-3 text-sm text-secondary">
                Period in progress since {formatDate(ongoingPeriod.startDate)}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  When did your period end?
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={ongoingPeriod.startDate}
                  max={toLocalDateString()}
                  className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <button
                onClick={handleEndPeriod}
                disabled={isSubmitting || !endDate}
                className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : "End Period"}
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  When did your period start?
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={toLocalDateString()}
                  className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <button
                onClick={handleStartPeriod}
                disabled={isSubmitting || !startDate}
                className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : "Start Period"}
              </button>
            </>
          )}
        </GlassPanel>
      ) : (
        <GlassPanel variant="quiet" className="p-6">
          <p className="text-sm text-muted-foreground">
            This is read-only for partner views. The data below is what your partner shared.
          </p>
        </GlassPanel>
      )}

      <GlassPanel variant="quiet" className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Period history</h2>
            <p className="text-sm text-muted-foreground">
              {isPartnerView && !phaseShared
                ? "Period history is hidden right now."
                : "The latest periods appear first."}
            </p>
          </div>
          <CalendarDays className="h-5 w-5 text-muted-foreground" />
        </div>
        {periodHistory && periodHistory.length > 0 && (canWrite || phaseShared) ? (
          <div className="mt-4 space-y-3">
            {periodHistory.slice(0, 12).map((period: any) => (
              <div
                key={period._id}
                className="flex items-center justify-between gap-4 rounded-[1.4rem] border border-white/50 bg-white/[0.42] p-4 dark:border-white/10 dark:bg-white/[0.07]"
              >
                <div>
                  <p className="font-medium text-sm text-foreground">
                    {formatDate(period.startDate)}
                  </p>
                  {period.endDate ? (
                    <p className="text-xs text-muted-foreground">
                      to {formatDate(period.endDate)}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Ongoing period</p>
                  )}
                </div>
                <span className="rounded-full border border-border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                  {period.endDate ? "Closed" : "Open"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {isPartnerView && !phaseShared
              ? "Period history is hidden from partner view."
              : "No periods logged yet."}
          </p>
        )}
      </GlassPanel>

      <GlassPanel variant="quiet" className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Pain history</h2>
            <p className="text-sm text-muted-foreground">
              {isPartnerView && !painShared
                ? "Pain history is hidden right now."
                : "Recent check-ins from the last 30 days."}
            </p>
          </div>
          <HeartPulse className="h-5 w-5 text-muted-foreground" />
        </div>

        {visiblePainHistory.length > 0 ? (
          <div className="mt-4 space-y-3">
            {visiblePainHistory.map((pain: any) => (
              <div
                key={pain._id}
                className="rounded-[1.4rem] border border-white/50 bg-white/[0.42] p-4 dark:border-white/10 dark:bg-white/[0.07]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-3">
                      <p className="font-medium text-sm text-foreground">{formatDate(pain.date)}</p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-1 text-xs font-semibold",
                          painScoreTone(pain.painScore)
                        )}
                      >
                        {pain.painScore}/10
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {pain.tags?.length
                        ? pain.tags
                            .map((tag: string) => PAIN_TAG_LABELS[tag] ?? tag)
                            .join(" · ")
                        : "No tags"}
                    </p>
                  </div>
                </div>

                {pain.note && (
                  <p className="mt-3 text-sm leading-6 text-foreground/90">{pain.note}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {isPartnerView && !painShared
              ? "Pain history is hidden from partner view."
              : "No pain check-ins logged yet."}
          </p>
        )}
      </GlassPanel>
    </div>
  );
}
