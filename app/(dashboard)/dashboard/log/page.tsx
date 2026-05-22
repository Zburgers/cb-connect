"use client";

import { useState, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { motion, useScroll, AnimatePresence } from "framer-motion";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { formatDate, cn, localDateDaysAgo, toLocalDateString } from "@/lib/utils";
import {
  CalendarDays, Download, HeartPulse, Lock, Shield, Sparkles,
  ArrowUp, Plus, X,
} from "lucide-react";

/* ── Types ── */
const PAIN_TAG_LABELS: Record<string, string> = {
  cramps:   "Cramps",
  headache: "Head pressure",
  back:     "Back ache",
  fatigue:  "Low energy",
  other:    "Something else",
};

function painScoreTone(score: number) {
  if (score === 0)  return { bg: "oklch(72% 0.16 145 / 0.14)", text: "oklch(48% 0.18 145)" };
  if (score <= 3)   return { bg: "oklch(78% 0.14 70 / 0.14)",  text: "oklch(52% 0.16 60)"  };
  if (score <= 6)   return { bg: "oklch(72% 0.16 42 / 0.14)",  text: "oklch(52% 0.18 38)"  };
  return                   { bg: "oklch(60% 0.18 22 / 0.14)",  text: "oklch(48% 0.20 22)"  };
}

/* ── Phase colors for timeline rail ── */
const PHASE_BAND_COLORS: Record<string, string> = {
  menstruation: "oklch(60% 0.18 22)",
  follicular:   "oklch(76% 0.14 58)",
  ovulation:    "oklch(70% 0.20 42)",
  luteal:       "oklch(56% 0.14 295)",
};

function getPhaseForDate(startDate: string, allPeriods: any[]): string {
  // Simple heuristic: if within any period range → menstruation, else follicular by default
  for (const period of allPeriods) {
    const s = new Date(period.startDate);
    const e = period.endDate ? new Date(period.endDate) : new Date(s.getTime() + 5 * 86400000);
    const d = new Date(startDate);
    if (d >= s && d <= e) return "menstruation";
  }
  return "follicular";
}

/* ── Privacy visibility helpers ── */
function describePainVisibility(shared: boolean, partnerView: boolean) {
  if (shared) return partnerView ? "Your partner can see this history." : "This history is shared with your partner.";
  return partnerView ? "Your partner cannot see pain history right now." : "Pain history stays private unless you turn sharing on.";
}
function describePeriodVisibility(shared: boolean, partnerView: boolean) {
  if (shared) return partnerView ? "Your partner can see period history." : "This history is shared with your partner.";
  return partnerView ? "Your partner cannot see period history right now." : "Period history stays private unless you turn sharing on.";
}

/* ── CSV export ── */
function csvCell(value: unknown) {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}
function downloadCsv(filename: string, rows: unknown[][]) {
  const csv  = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click();
  document.body.removeChild(link); URL.revokeObjectURL(url);
}

/* ── Timeline River entry ── */
function TimelineEntry({
  date,
  phase,
  pain,
  isOngoing,
  isFirst,
}: {
  date: string;
  phase: string;
  pain?: { score: number; tags?: string[]; note?: string };
  isOngoing?: boolean;
  isFirst?: boolean;
}) {
  const bandColor = PHASE_BAND_COLORS[phase] ?? PHASE_BAND_COLORS.follicular;

  return (
    <motion.div
      className="relative flex gap-5"
      initial={{ opacity: 0, x: -12 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Rail dot + connector */}
      <div className="flex flex-col items-center" aria-hidden="true">
        <div
          className="mt-1 h-3 w-3 flex-shrink-0 rounded-full ring-2 ring-white/60"
          style={{ background: bandColor }}
        />
        {!isFirst && (
          <div
            className="mt-1 w-0.5 flex-1"
            style={{
              background: `linear-gradient(to bottom, ${bandColor}, oklch(from ${bandColor} l c h / 0.2))`,
              minHeight: "1.5rem",
            }}
          />
        )}
      </div>

      <div
        className="mb-4 flex-1 rounded-[1.4rem] p-4"
        style={{
          background: "var(--color-glass)",
          backdropFilter: "blur(12px)",
          boxShadow: "inset 0 1px 0 var(--color-glass-border)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-sm" style={{ color: "hsl(var(--foreground))" }}>
              {formatDate(date)}
            </p>
            <p className="mt-0.5 text-xs capitalize" style={{ color: "hsl(var(--muted-foreground))" }}>
              {phase} {isOngoing ? "· ongoing" : ""}
            </p>
          </div>
          {isOngoing && (
            <span
              className="rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ background: `${bandColor}22`, color: bandColor }}
            >
              Active
            </span>
          )}
        </div>

        {pain && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ background: painScoreTone(pain.score).bg, color: painScoreTone(pain.score).text }}
            >
              {pain.score}/10
            </span>
            {pain.tags?.map((tag) => (
              <span
                key={tag}
                className="rounded-full px-2.5 py-1 text-xs"
                style={{
                  background: "oklch(0% 0 0 / 0.05)",
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                {PAIN_TAG_LABELS[tag] ?? tag}
              </span>
            ))}
            {pain.note && (
              <p className="mt-2 w-full text-sm leading-5" style={{ color: "hsl(var(--foreground))" }}>
                {pain.note}
              </p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Main log page ── */
export default function LogPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const me            = useQuery(api.queries.users.getMe, isLoaded && isSignedIn ? {} : "skip");
  const coupleStatus  = useQuery(api.queries.couples.getCoupleStatus, isLoaded && isSignedIn ? {} : "skip");
  const periodHistory = useQuery(api.queries.history.getPeriodHistory, isLoaded && isSignedIn ? {} : "skip");
  const painHistory   = useQuery(
    api.queries.history.getPainHistory,
    isLoaded && isSignedIn ? { startDate: localDateDaysAgo(90), endDate: toLocalDateString() } : "skip"
  );
  const logPeriodStart = useMutation(api.mutations.periods.logPeriodStart);
  const logPeriodEnd   = useMutation(api.mutations.periods.logPeriodEnd);

  const [startDate,    setStartDate]    = useState("");
  const [endDate,      setEndDate]      = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message,      setMessage]      = useState("");
  const [showLogger,   setShowLogger]   = useState(false);

  const topRef = useRef<HTMLDivElement>(null);

  // Scroll to today
  const scrollToToday = () => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const { scrollY } = useScroll();

  if (!isLoaded || me === undefined || coupleStatus === undefined || periodHistory === undefined || painHistory === undefined) {
    return <LoadingSpinner />;
  }

  const isPartnerView = coupleStatus?.role === "partner";
  const canWrite      = !isPartnerView;
  const isLinked      = Boolean(coupleStatus?.isLinked);
  const phaseShared   = Boolean(isLinked && coupleStatus?.sharingSettings?.phase);
  const painShared    = Boolean(isLinked && coupleStatus?.sharingSettings?.pain);
  const ongoingPeriod = periodHistory?.find((p: any) => !p.endDate);
  const visiblePainHistory = (painShared || !isPartnerView) ? painHistory ?? [] : [];

  const handleStartPeriod = async () => {
    if (!startDate) return;
    setIsSubmitting(true);
    try {
      await logPeriodStart({ startDate });
      setStartDate(""); setMessage("Period started."); setTimeout(() => setMessage(""), 3000);
    } catch (error: any) {
      setMessage(error.message || "Could not log period start.");
    } finally { setIsSubmitting(false); }
  };

  const handleEndPeriod = async () => {
    if (!endDate) return;
    setIsSubmitting(true);
    try {
      await logPeriodEnd({ endDate });
      setEndDate(""); setMessage("Period marked as ended."); setTimeout(() => setMessage(""), 3000);
    } catch (error: any) {
      setMessage(error.message || "Could not log period end.");
    } finally { setIsSubmitting(false); }
  };

  const handleExportCsv = () => {
    const rows: unknown[][] = [
      ["section", "date", "endDate", "painScore", "tags", "note", "status"],
      ...((canWrite || phaseShared) ? periodHistory ?? [] : []).map((p: any) => [
        "period", p.startDate, p.endDate ?? "", "", "", "", p.endDate ? "closed" : "open",
      ]),
      ...visiblePainHistory.map((p: any) => [
        "pain", p.date, "", p.painScore, p.tags?.join("; ") ?? "", p.note ?? "", "",
      ]),
    ];
    downloadCsv(`cb-connect-history-${toLocalDateString()}.csv`, rows);
  };

  /* ── Build unified timeline entries ── */
  const timelineEntries: Array<{
    date: string;
    phase: string;
    type: "period" | "pain";
    isOngoing?: boolean;
    pain?: { score: number; tags?: string[]; note?: string };
  }> = [];

  if (canWrite || phaseShared) {
    (periodHistory ?? []).forEach((period: any) => {
      const phase = "menstruation";
      timelineEntries.push({
        date: period.startDate,
        phase,
        type: "period",
        isOngoing: !period.endDate,
      });
    });
  }

  visiblePainHistory.forEach((pain: any) => {
    const phase = getPhaseForDate(pain.date, periodHistory ?? []);
    timelineEntries.push({
      date: pain.date,
      phase,
      type: "pain",
      pain: { score: pain.painScore, tags: pain.tags, note: pain.note },
    });
  });

  timelineEntries.sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6 animate-fade-in" ref={topRef}>

      {/* ── Page header ── */}
      <div>
        <p
          className="text-xs font-semibold uppercase tracking-[0.22em]"
          style={{ color: "hsl(var(--muted-foreground))" }}
        >
          {isPartnerView ? "Shared history" : "Your cycle history"}
        </p>
        <h1
          className="mt-2 font-display overflow-wrap-anywhere"
          style={{
            fontSize: "var(--text-display-s)",
            fontStyle: "italic",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: "hsl(var(--foreground))",
          }}
        >
          {isPartnerView ? "Partner-visible history" : "Cycle history"}
        </h1>
        <p className="mt-2 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
          {isPartnerView
            ? "Only the data your partner chose to share appears here."
            : "Your period and pain signals, rendered as a timeline."}
        </p>
      </div>

      {/* ── Privacy snapshot ── */}
      <div className="bento-cell p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: "hsl(var(--muted-foreground))" }}>
              Privacy snapshot
            </p>
            <h2
              className="mt-2 font-display"
              style={{ fontSize: "var(--text-2xl)", fontStyle: "italic", color: "hsl(var(--foreground))" }}
            >
              What your partner can see
            </h2>
          </div>
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
            style={{
              background: "var(--color-glass)",
              backdropFilter: "blur(8px)",
              boxShadow: "inset 0 1px 0 var(--color-glass-border)",
              color: "hsl(var(--foreground))",
            }}
          >
            <Shield className="h-3.5 w-3.5 text-primary" />
            {isLinked ? "Linked couple" : "Not linked"}
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {[
            { label: "Period history", shared: phaseShared, description: describePeriodVisibility(phaseShared, isPartnerView) },
            { label: "Pain history",   shared: painShared,  description: describePainVisibility(painShared, isPartnerView)   },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-[1.2rem] p-4"
              style={{
                background: "oklch(100% 0 0 / 0.45)",
                backdropFilter: "blur(8px)",
                boxShadow: "inset 0 1px 0 oklch(100% 0 0 / 0.5)",
              }}
            >
              <div className="flex items-center gap-2">
                {item.shared
                  ? <Sparkles className="h-4 w-4 text-primary" />
                  : <Lock className="h-4 w-4" style={{ color: "hsl(var(--muted-foreground))" }} />}
                <p className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>{item.label}</p>
              </div>
              <p className="mt-1.5 text-xs leading-5" style={{ color: "hsl(var(--muted-foreground))" }}>
                {item.description}
              </p>
            </div>
          ))}
        </div>

        <motion.button
          onClick={handleExportCsv}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
          className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold no-tap-highlight"
          style={{ background: "hsl(var(--foreground))", color: "hsl(var(--background))" }}
          aria-label="Export CSV"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </motion.button>
      </div>

      {/* ── Period logger (primary only) ── */}
      {canWrite && (
        <div className="bento-cell overflow-hidden">
          <button
            onClick={() => setShowLogger((v) => !v)}
            className="flex w-full items-center justify-between p-6 text-left no-tap-highlight"
            aria-expanded={showLogger}
          >
            <div>
              <p className="font-semibold" style={{ color: "hsl(var(--foreground))" }}>
                {ongoingPeriod ? `Period in progress since ${formatDate(ongoingPeriod.startDate)}` : "Log a period"}
              </p>
              <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                {ongoingPeriod ? "Tap to mark it as ended." : "Tap to open the logger."}
              </p>
            </div>
            <motion.div
              animate={{ rotate: showLogger ? 45 : 0 }}
              transition={{ duration: 0.2 }}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
              style={{ background: "var(--color-glass)", backdropFilter: "blur(8px)", boxShadow: "inset 0 1px 0 var(--color-glass-border)" }}
            >
              <Plus className="h-4 w-4" style={{ color: "hsl(var(--foreground))" }} />
            </motion.div>
          </button>

          <AnimatePresence>
            {showLogger && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 28 }}
                style={{ overflow: "hidden" }}
              >
                <div className="space-y-4 px-6 pb-6">
                  {message && (
                    <div
                      className="rounded-2xl p-3 text-sm font-medium"
                      style={{ background: "oklch(64% 0.18 145 / 0.12)", color: "oklch(42% 0.18 145)" }}
                    >
                      {message}
                    </div>
                  )}

                  {ongoingPeriod ? (
                    <>
                      <div>
                        <label
                          className="mb-2 block text-sm font-medium"
                          style={{ color: "hsl(var(--foreground))" }}
                          htmlFor="period-end-date"
                        >
                          When did your period end?
                        </label>
                        <input
                          id="period-end-date"
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          min={ongoingPeriod.startDate}
                          max={toLocalDateString()}
                          className="w-full rounded-[1.2rem] px-4 py-3 text-sm transition-all"
                          style={{
                            background: "var(--color-glass)",
                            backdropFilter: "blur(8px)",
                            boxShadow: "inset 0 1px 0 var(--color-glass-border)",
                            color: "hsl(var(--foreground))",
                            border: "none",
                            outline: "none",
                          }}
                        />
                      </div>
                      <motion.button
                        onClick={handleEndPeriod}
                        disabled={isSubmitting || !endDate}
                        whileTap={{ scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 400, damping: 15 }}
                        className="w-full rounded-full py-3.5 font-semibold no-tap-highlight disabled:opacity-50"
                        style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                      >
                        {isSubmitting ? "Saving…" : "Mark as ended"}
                      </motion.button>
                    </>
                  ) : (
                    <>
                      <div>
                        <label
                          className="mb-2 block text-sm font-medium"
                          style={{ color: "hsl(var(--foreground))" }}
                          htmlFor="period-start-date"
                        >
                          When did your period start?
                        </label>
                        <input
                          id="period-start-date"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          max={toLocalDateString()}
                          className="w-full rounded-[1.2rem] px-4 py-3 text-sm transition-all"
                          style={{
                            background: "var(--color-glass)",
                            backdropFilter: "blur(8px)",
                            boxShadow: "inset 0 1px 0 var(--color-glass-border)",
                            color: "hsl(var(--foreground))",
                            border: "none",
                            outline: "none",
                          }}
                        />
                      </div>
                      <motion.button
                        onClick={handleStartPeriod}
                        disabled={isSubmitting || !startDate}
                        whileTap={{ scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 400, damping: 15 }}
                        className="w-full rounded-full py-3.5 font-semibold no-tap-highlight disabled:opacity-50"
                        style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                      >
                        {isSubmitting ? "Saving…" : "Start period"}
                      </motion.button>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Timeline River ── */}
      <div className="bento-cell p-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h2
              className="font-display"
              style={{ fontSize: "var(--text-2xl)", fontStyle: "italic", color: "hsl(var(--foreground))" }}
            >
              Your timeline
            </h2>
            <p className="mt-1 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              {isPartnerView && !phaseShared && !painShared
                ? "Your partner's history is kept private right now."
                : "Periods and pain signals, flowing back in time."}
            </p>
          </div>
          <CalendarDays className="h-5 w-5 flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }} />
        </div>

        {/* Phase color legend */}
        <div className="mb-6 flex flex-wrap gap-3">
          {Object.entries(PHASE_BAND_COLORS).map(([phase, color]) => (
            <span
              key={phase}
              className="inline-flex items-center gap-1.5 text-xs capitalize"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: color }}
                aria-hidden="true"
              />
              {phase}
            </span>
          ))}
        </div>

        {/* River entries */}
        {timelineEntries.length > 0 ? (
          <div className="relative pl-2">
            {/* Vertical rail — behind all entries */}
            <div
              className="absolute left-2 top-0 bottom-0 w-0.5 opacity-20"
              style={{
                background: "linear-gradient(to bottom, hsl(var(--primary)), hsl(var(--muted-foreground)))",
              }}
              aria-hidden="true"
            />
            {timelineEntries.map((entry, i) => (
              <TimelineEntry
                key={`${entry.type}-${entry.date}-${i}`}
                date={entry.date}
                phase={entry.phase}
                pain={entry.pain}
                isOngoing={entry.isOngoing}
                isFirst={i > 0}
              />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <p
              className="font-display"
              style={{ fontSize: "var(--text-xl)", fontStyle: "italic", color: "hsl(var(--muted-foreground))" }}
            >
              {isPartnerView ? "Nothing shared yet." : "Your history will appear here."}
            </p>
            <p className="mt-2 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              {isPartnerView
                ? "Ask your partner to adjust sharing settings."
                : "Start by logging a period or a pain check-in."}
            </p>
          </div>
        )}
      </div>

      {/* ── Snap-to-Today floating pill ── */}
      <AnimatePresence>
        {timelineEntries.length > 3 && (
          <motion.div
            className="fixed bottom-24 left-1/2 z-50"
            style={{ x: "-50%" }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
          >
            <motion.button
              onClick={scrollToToday}
              whileTap={{ scale: 0.94 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold shadow-2xl no-tap-highlight"
              style={{
                background: "oklch(100% 0 0 / 0.82)",
                backdropFilter: "blur(20px) saturate(1.5)",
                boxShadow: "inset 0 1px 0 oklch(100% 0 0 / 0.7), 0 8px 32px oklch(0% 0 0 / 0.12)",
                color: "hsl(var(--foreground))",
              }}
              aria-label="Scroll back to today"
            >
              <ArrowUp className="h-4 w-4" />
              Back to today
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
