"use client";

import { useState, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { formatDate, localDateDaysAgo, toLocalDateString } from "@/lib/utils";
import {
  ArrowUp,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  Download,
  Lock,
  Pencil,
  Shield,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { TimelinePhase } from "@/convex/_helpers/timelinePhases";
import type { Id } from "@/convex/_generated/dataModel";

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
  private: "oklch(62% 0.02 255)",
  unknown: "oklch(72% 0.03 95)",
};

function phaseLabel(phase: TimelinePhase) {
  if (phase === "private") return "Phase hidden";
  if (phase === "unknown") return "Phase unavailable";
  return phase;
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

type PeriodTimelineMetadata = {
  id: Id<"periodEvents">;
  startDate: string;
  endDate?: string;
  source: "self" | "partner_assist" | "system";
  confirmationStatus: "confirmed" | "unreviewed";
  createdByUserId: Id<"users">;
  updatedByUserId: Id<"users">;
  createdByName: string;
  updatedByName: string;
  canCorrect: boolean;
};

function attributionCopy(
  period: PeriodTimelineMetadata,
  viewerId: Id<"users">,
  partnerView: boolean
) {
  if (period.source === "system") return "Auto-ended by CB Connect";
  if (period.source === "partner_assist") {
    if (period.updatedByUserId === viewerId && period.createdByUserId !== viewerId) {
      return `Added by ${period.createdByName} · Corrected by you`;
    }
    if (partnerView && period.createdByUserId === viewerId) {
      return "Added by you for your partner";
    }
    return `Added by ${period.createdByName}`;
  }
  return partnerView ? `Logged by ${period.createdByName}` : "Logged by you";
}

/* ── Timeline River entry ── */
function TimelineEntry({
  date,
  phase,
  pain,
  period,
  isOngoing,
  isFirst,
  viewerId,
  partnerView,
  onSaveCorrection,
  onDelete,
}: {
  date: string;
  phase: TimelinePhase;
  pain?: { score: number; tags?: string[]; note?: string };
  period?: PeriodTimelineMetadata;
  isOngoing?: boolean;
  isFirst?: boolean;
  viewerId: Id<"users">;
  partnerView: boolean;
  onSaveCorrection: (
    periodEventId: Id<"periodEvents">,
    startDate: string,
    endDate?: string
  ) => Promise<void>;
  onDelete: (periodEventId: Id<"periodEvents">) => Promise<void>;
}) {
  const bandColor = PHASE_BAND_COLORS[phase] ?? PHASE_BAND_COLORS.follicular;
  const [isEditing, setIsEditing] = useState(false);
  const [editStartDate, setEditStartDate] = useState(period?.startDate ?? "");
  const [editEndDate, setEditEndDate] = useState(period?.endDate ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [editorMessage, setEditorMessage] = useState("");

  const saveCorrection = async () => {
    if (!period || !editStartDate) return;
    setIsSaving(true);
    setEditorMessage("");
    try {
      await onSaveCorrection(
        period.id,
        editStartDate,
        editEndDate || undefined
      );
      setIsEditing(false);
    } catch (error) {
      setEditorMessage(
        error instanceof Error ? error.message : "Could not save that correction."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const deleteEntry = async () => {
    if (!period) return;
    setIsSaving(true);
    setEditorMessage("");
    try {
      await onDelete(period.id);
      setIsEditing(false);
    } catch (error) {
      setEditorMessage(
        error instanceof Error ? error.message : "Could not delete that entry."
      );
    } finally {
      setIsSaving(false);
    }
  };

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

      <div className="contrast-glass mb-4 flex-1 rounded-[1.4rem] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-sm" style={{ color: "hsl(var(--foreground))" }}>
              {formatDate(date)}
            </p>
            <p className="mt-0.5 text-xs capitalize" style={{ color: "hsl(var(--muted-foreground))" }}>
              {phaseLabel(phase)} {isOngoing ? "· ongoing" : ""}
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
                className="rounded-full bg-foreground/10 px-2.5 py-1 text-xs font-medium text-foreground"
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

        {period && (
          <div className="mt-3 border-t border-foreground/10 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-foreground/75">
                  {attributionCopy(period, viewerId, partnerView)}
                </p>
                {period.source === "partner_assist" && period.canCorrect && (
                  <p className="mt-1 text-xs text-foreground/60">
                    Added with your permission. You can correct this anytime.
                  </p>
                )}
              </div>
              {period.canCorrect && !isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    setEditStartDate(period.startDate);
                    setEditEndDate(period.endDate ?? "");
                    setEditorMessage("");
                    setIsEditing(true);
                  }}
                  className="touch-target inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  Edit
                </button>
              )}
            </div>

            {isEditing && (
              <div className="contrast-glass mt-3 space-y-3 rounded-[1.2rem] p-4">
                <p className="text-sm font-semibold text-foreground">Wrong date?</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-foreground">
                      Start date
                    </span>
                    <input
                      type="date"
                      value={editStartDate}
                      max={toLocalDateString()}
                      onChange={(event) => setEditStartDate(event.target.value)}
                      className="min-h-11 w-full rounded-xl border border-foreground/15 bg-[var(--color-glass)] px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-foreground">
                      End date, optional
                    </span>
                    <input
                      type="date"
                      value={editEndDate}
                      min={editStartDate}
                      max={toLocalDateString()}
                      onChange={(event) => setEditEndDate(event.target.value)}
                      className="min-h-11 w-full rounded-xl border border-foreground/15 bg-[var(--color-glass)] px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </label>
                </div>
                {editorMessage && (
                  <p className="text-xs font-medium text-destructive" role="alert">
                    {editorMessage}
                  </p>
                )}
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    onClick={saveCorrection}
                    disabled={isSaving || !editStartDate}
                    className="touch-target whitespace-nowrap rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? "Saving…" : "Save correction"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setEditStartDate(period.startDate);
                      setEditEndDate(period.endDate ?? "");
                      setEditorMessage("");
                    }}
                    disabled={isSaving}
                    className="touch-target whitespace-nowrap rounded-full px-4 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={deleteEntry}
                    disabled={isSaving}
                    className="touch-target inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-semibold text-destructive outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Delete entry
                  </button>
                </div>
              </div>
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
  const timelineHistory = useQuery(
    api.queries.history.getTimelineHistory,
    isLoaded && isSignedIn ? { startDate: localDateDaysAgo(90), endDate: toLocalDateString() } : "skip"
  );
  const logPeriodStart = useMutation(api.mutations.periods.logPeriodStart);
  const logPeriodEnd   = useMutation(api.mutations.periods.logPeriodEnd);
  const assistLogPeriodStart = useMutation(api.mutations.periods.assistLogPeriodStart);
  const assistLogPeriodEnd = useMutation(api.mutations.periods.assistLogPeriodEnd);
  const updatePeriodEvent = useMutation(api.mutations.periods.updatePeriodEvent);
  const deletePeriodEvent = useMutation(api.mutations.periods.deletePeriodEvent);

  const [selectedDate, setSelectedDate] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message,      setMessage]      = useState("");

  const topRef = useRef<HTMLDivElement>(null);

  // Scroll to today
  const scrollToToday = () => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (
    !isLoaded ||
    me === undefined ||
    me === null ||
    coupleStatus === undefined ||
    periodHistory === undefined ||
    painHistory === undefined ||
    timelineHistory === undefined
  ) {
    return <LoadingSpinner />;
  }

  const isPartnerView = coupleStatus?.role === "partner";
  const canWrite      = !isPartnerView;
  const isLinked      = Boolean(coupleStatus?.isLinked);
  // Sharing flags should rely solely on the primary member's sharing settings.
  // Previously these were gated by isLinked, which prevented the timeline
  // from showing shared history even when sharing was enabled. We now read
  // the flags directly.
  const phaseShared   = Boolean(coupleStatus?.sharingSettings?.phase);
  const painShared    = Boolean(coupleStatus?.sharingSettings?.pain);
  const periodWriteAllowed = Boolean(coupleStatus?.sharingSettings?.periodWrite);
  const canAssist = isPartnerView && phaseShared && periodWriteAllowed && isLinked;
  const ongoingPeriod = periodHistory?.find((p: any) => !p.endDate);
  const visiblePainHistory = (painShared || !isPartnerView) ? painHistory ?? [] : [];

  const chooseDate = (date: string) => {
    setSelectedDate(date);
    setShowDatePicker(false);
    setMessage("");
  };

  const handlePeriodUpdate = async () => {
    if (!selectedDate) return;
    setIsSubmitting(true);
    setMessage("");
    try {
      if (ongoingPeriod) {
        if (isPartnerView) {
          await assistLogPeriodEnd({ endDate: selectedDate });
        } else {
          await logPeriodEnd({ endDate: selectedDate });
        }
      } else if (isPartnerView) {
        await assistLogPeriodStart({ startDate: selectedDate });
      } else {
        await logPeriodStart({ startDate: selectedDate });
      }
      setSelectedDate("");
      setShowDatePicker(false);
      setMessage(
        isPartnerView
          ? "Saved. This was added as partner-assisted and your partner can correct it anytime."
          : ongoingPeriod
            ? "Period marked as ended."
            : "Period started."
      );
      setTimeout(() => setMessage(""), 5000);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save that period update."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveCorrection = async (
    periodEventId: Id<"periodEvents">,
    correctedStartDate: string,
    correctedEndDate?: string
  ) => {
    await updatePeriodEvent({
      periodEventId,
      startDate: correctedStartDate,
      endDate: correctedEndDate,
    });
    setMessage("Correction saved.");
  };

  const handleDeletePeriod = async (periodEventId: Id<"periodEvents">) => {
    await deletePeriodEvent({ periodEventId });
    setMessage("Period entry removed.");
  };

  const handleExportCsv = () => {
    const rows: unknown[][] = [
      [
        "section",
        "date",
        "endDate",
        "painScore",
        "tags",
        "note",
        "status",
        "source",
        "createdBy",
        "updatedBy",
      ],
      ...((canWrite || phaseShared) ? periodHistory ?? [] : []).map((p: any) => [
        "period",
        p.startDate,
        p.endDate ?? "",
        "",
        "",
        "",
        p.endDate ? "closed" : "open",
        p.source,
        p.createdByName,
        p.updatedByName,
      ]),
      ...visiblePainHistory.map((p: any) => [
        "pain",
        p.date,
        "",
        p.painScore,
        p.tags?.join("; ") ?? "",
        p.note ?? "",
        "",
        "",
        "",
        "",
      ]),
    ];
    downloadCsv(`cb-connect-history-${toLocalDateString()}.csv`, rows);
  };

  const timelineEntries = timelineHistory ?? [];

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
            className="phase-chip gap-2 text-xs"
          >
            <Shield className="h-3.5 w-3.5 text-primary" />
            {isLinked ? "Linked couple" : "Not linked"}
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            { label: "Period history", shared: phaseShared, description: describePeriodVisibility(phaseShared, isPartnerView) },
            {
              label: "Assisted logging",
              shared: periodWriteAllowed,
              description: periodWriteAllowed
                ? isPartnerView
                  ? "You can help update period start and end dates."
                  : "Your partner can help update period start and end dates."
                : isLinked
                  ? "Only the primary user can log period dates."
                  : "No partner is linked yet.",
            },
            { label: "Pain history",   shared: painShared,  description: describePainVisibility(painShared, isPartnerView)   },
          ].map((item) => (
            <div
              key={item.label}
              className="contrast-glass rounded-[1.2rem] p-4"
            >
              <div className="flex items-center gap-2">
                {item.shared
                  ? <Sparkles className="h-4 w-4 text-primary" />
                  : <Lock className="h-4 w-4" style={{ color: "hsl(var(--muted-foreground))" }} />}
                <p className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>{item.label}</p>
              </div>
              <p className="mt-1.5 text-xs leading-5 text-foreground/75">
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

      {/* ── Role-aware period check-in ── */}
      {(canWrite || canAssist) && (
        <div className="bento-cell p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
              <CalendarCheck2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/60">
                {isPartnerView ? "Shared care" : "Today's check-in"}
              </p>
              <h2 className="mt-1 font-display text-2xl italic text-foreground">
                {isPartnerView
                  ? "Help update period dates"
                  : ongoingPeriod
                    ? `Period in progress since ${formatDate(ongoingPeriod.startDate)}`
                    : "Did your period start?"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-foreground/75">
                {isPartnerView
                  ? "You can help keep the timeline accurate because your partner allowed this. They can edit or remove anything you add anytime."
                  : ongoingPeriod
                    ? "Choose when it ended. You can correct the date from the timeline later."
                    : "A quick date is enough. Pain logging stays separate and optional."}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button
              type="button"
              onClick={() => chooseDate(toLocalDateString())}
              className="touch-target whitespace-nowrap rounded-full border border-foreground/15 bg-[var(--color-glass)] px-4 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => chooseDate(localDateDaysAgo(1))}
              className="touch-target whitespace-nowrap rounded-full border border-foreground/15 bg-[var(--color-glass)] px-4 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => setShowDatePicker((visible) => !visible)}
              className="touch-target col-span-2 whitespace-nowrap rounded-full border border-foreground/15 bg-[var(--color-glass)] px-4 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:col-span-1"
              aria-expanded={showDatePicker}
            >
              Choose date
            </button>
          </div>

          {showDatePicker && (
            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-medium text-foreground">
                {ongoingPeriod ? "Period end date" : "Period start date"}
              </span>
              <input
                type="date"
                value={selectedDate}
                min={ongoingPeriod?.startDate}
                max={toLocalDateString()}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="min-h-11 w-full rounded-[1.2rem] border border-foreground/15 bg-[var(--color-glass)] px-4 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </label>
          )}

          {selectedDate && (
            <div className="contrast-glass mt-4 rounded-[1.3rem] p-4">
              <p className="text-sm font-semibold text-foreground">
                {isPartnerView
                  ? `${ongoingPeriod ? "Add period end" : "Add period start"} for ${formatDate(selectedDate)}?`
                  : `${ongoingPeriod ? "Mark period ended" : "Start period"} on ${formatDate(selectedDate)}?`}
              </p>
              <button
                type="button"
                onClick={handlePeriodUpdate}
                disabled={isSubmitting}
                className="touch-target mt-3 w-full whitespace-nowrap rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {isSubmitting
                  ? "Saving…"
                  : isPartnerView
                    ? "Save update"
                    : ongoingPeriod
                      ? "Mark as ended"
                      : "Start period"}
              </button>
            </div>
          )}
        </div>
      )}

      {isPartnerView && phaseShared && !periodWriteAllowed && (
        <div className="bento-cell p-6">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 flex-shrink-0 text-foreground/60" aria-hidden="true" />
            <div>
              <h2 className="font-semibold text-foreground">Period history is visible</h2>
              <p className="mt-1 text-sm leading-6 text-foreground/75">
                Your partner has not enabled assisted logging, so this stays read-only.
              </p>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div
          className="contrast-glass flex items-start gap-2 rounded-[1.2rem] p-4 text-sm font-medium text-foreground"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
          {message}
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
                period={entry.period}
                isOngoing={entry.isOngoing}
                isFirst={i > 0}
                viewerId={me._id}
                partnerView={isPartnerView}
                onSaveCorrection={handleSaveCorrection}
                onDelete={handleDeletePeriod}
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
