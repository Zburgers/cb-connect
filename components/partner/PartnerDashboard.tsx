"use client";

import { motion } from "framer-motion";
import { Heart, Shield, Info } from "lucide-react";
import {
  getPartnerCyclePresentation,
  isPartnerCycleStateExposed,
  type PartnerCyclePresentation,
} from "./partnerCyclePresentation";
import PartnerPulse from "./PartnerPulse";

interface PartnerDashboardProps {
  data: any;
  partnerPresent?: boolean;
}

function getPainConfig(score: number) {
  if (score <= 3) return { bg: "bg-accent/10",      icon: "text-accent",      text: "text-accent"      };
  if (score <= 6) return { bg: "bg-secondary/10",   icon: "text-secondary",   text: "text-secondary"   };
  return             { bg: "bg-destructive/10", icon: "text-destructive", text: "text-destructive" };
}

export function PartnerCycleStateCard({
  presentation,
}: {
  presentation: PartnerCyclePresentation;
}) {
  if (!presentation.visible) {
    return (
      <div
        className="contrast-glass rounded-[1.5rem] p-6"
        role="status"
        aria-label="Partner cycle sharing"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Cycle sharing
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {presentation.emptyState}
        </p>
      </div>
    );
  }

  return (
    <div
      className="contrast-glass rounded-[1.5rem] p-6"
      data-cycle-state={presentation.status ?? undefined}
      role="status"
      aria-label="Partner cycle state"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Shared cycle state · v{presentation.version}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">
            {presentation.statusLabel}
          </h2>
        </div>
        <span className="rounded-full bg-secondary/10 px-3 py-1.5 text-xs font-semibold text-secondary">
          {presentation.evidenceLabel}
        </span>
      </div>

      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        {presentation.phaseLabel && (
          <div>
            <dt className="text-muted-foreground">Phase</dt>
            <dd className="mt-1 font-semibold text-foreground">
              {presentation.phaseLabel}
            </dd>
          </div>
        )}
        {presentation.cycleDay !== null && (
          <div>
            <dt className="text-muted-foreground">Cycle day</dt>
            <dd className="mt-1 font-semibold text-foreground">
              {presentation.cycleDay}
            </dd>
          </div>
        )}
        {presentation.bounds && (
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Calendar bounds</dt>
            <dd className="mt-1 text-foreground">
              {presentation.bounds.earliestDate}–{presentation.bounds.latestDate}
              <span className="text-muted-foreground">
                {` · expected ${presentation.bounds.expectedDate}`}
              </span>
            </dd>
          </div>
        )}
        {presentation.basisCount !== null && (
          <div>
            <dt className="text-muted-foreground">Evidence basis</dt>
            <dd className="mt-1 font-semibold text-foreground">
              {presentation.basisCount}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-muted-foreground">State reason</dt>
          <dd className="mt-1 font-mono text-xs text-foreground">
            {presentation.reason}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default function PartnerDashboard({ data, partnerPresent = false }: PartnerDashboardProps) {
  const showCycleStateV1 = isPartnerCycleStateExposed(data.cycleStateV1Exposed);
  const partnerProjection = showCycleStateV1
    ? data.cycleStateV1 ?? null
    : null;
  const partnerPresentation = getPartnerCyclePresentation(partnerProjection);

  if (!data.hasData) {
    return (
      <motion.div
        className="bento-cell-warm space-y-6 p-8 text-center animate-fade-up"
        style={{ borderRadius: "var(--radius-xl)" }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-secondary/10">
          <Heart className="w-10 h-10 text-secondary" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Partner mode
          </p>
          <h2
            className="mt-3 font-display text-foreground text-balance"
            style={{ fontSize: "var(--text-display-s)", fontStyle: "italic", lineHeight: 1.1 }}
          >
            The shared space is not ready yet
          </h2>
          <p className="mt-3 text-muted-foreground max-w-md mx-auto text-sm leading-6">
            {data.message || "Waiting for your partner to set up their account."}
          </p>
        </div>
        {showCycleStateV1 && (
          <PartnerCycleStateCard presentation={partnerPresentation} />
        )}
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="animate-fade-up">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Partner mode
        </p>
        <h1
          className="mt-2 font-display text-foreground text-balance"
          style={{ fontSize: "var(--text-display-s)", fontStyle: "italic", lineHeight: 1.1 }}
        >
          What today asks from you
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Support signals are shown only when your partner has shared them.
        </p>
      </div>

      {showCycleStateV1 ? (
        <PartnerCycleStateCard presentation={partnerPresentation} />
      ) : (
        <PartnerPulse
          cycleInfo={data.cycleInfo}
          painData={data.painData}
          partnerPresent={partnerPresent}
        />
      )}

      {/* Pain status card */}
      {data.painData && (() => {
        const cfg = getPainConfig(data.painData.score);
        return (
          <motion.div
            className="bento-cell p-6 animate-fade-up delay-2"
            style={{ borderRadius: "var(--radius-xl)" }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${cfg.bg}`}>
                <Heart className={`w-6 h-6 ${cfg.icon}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">How today feels</h3>
                <p className="text-xs text-muted-foreground">Shared pain signal</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <p
                className={`font-data font-bold leading-none ${cfg.text}`}
                style={{ fontSize: "3rem", letterSpacing: "-0.04em" }}
              >
                {data.painData.score}<span className="text-2xl opacity-60">/10</span>
              </p>
              <div>
                <p className="font-semibold text-foreground capitalize">{data.painData.severity}</p>
                <p className="text-sm text-muted-foreground">Severity level</p>
              </div>
            </div>
          </motion.div>
        );
      })()}

      {/* No pain data */}
      {!data.painData && (
        <motion.div
          className="bento-cell p-6"
          style={{ borderRadius: "var(--radius-xl)" }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-3 mb-3">
            <Shield className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <h3 className="text-base font-semibold text-foreground">Pain signal is private</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            No pain data is shared today. That may mean nothing was logged, or that your partner chose not to share it.
          </p>
        </motion.div>
      )}

      {/* How to help tip */}
      {!showCycleStateV1 && data.painTip && (
        <motion.div
          className="bento-cell-warm p-6"
          style={{ borderRadius: "var(--radius-xl)" }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Info className="w-5 h-5 text-primary" />
            </div>
            <h3
              className="font-display text-foreground"
              style={{ fontSize: "var(--text-xl)", fontStyle: "italic" }}
            >
              How to help without making it weird
            </h3>
          </div>
          <ul className="space-y-3">
            {data.painTip.suggestions.map((s: string, i: number) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center mt-0.5">
                  <span className="text-primary text-xs font-bold">{i + 1}</span>
                </span>
                <span className="text-sm text-foreground leading-6">{s}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </div>
  );
}
