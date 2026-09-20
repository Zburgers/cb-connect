import { requireValidCalendarDate } from "./calendarDates";
import {
  isStartAnchorEligible,
  type CycleFactLike,
} from "./cycleFactEligibility";
import { daysBetweenCalendarDates } from "./predictionBounds";
import { filterHistoryForPredictionSegment } from "./predictionSegments";

export const CYCLE_INTERVALS_VERSION = "cycle_intervals_v1" as const;

export type CycleIntervalReasonCode =
  | "LIMITED_HISTORY"
  | "APPROXIMATE_DATE"
  | "LEGACY_UNKNOWN"
  | "POSSIBLE_MISSING_LOG"
  | "CONTEXT_SEGMENT"
  | "RECENT_CORRECTION"
  | "PARTNER_ASSISTED"
  | "TOMBSTONED"
  | "AFTER_CUTOFF"
  | "INVALID_DATE"
  | "NON_POSITIVE_INTERVAL";

export type CycleIntervalEvent = CycleFactLike & {
  source?: "self" | "partner_assist" | "system";
  confirmationStatus?: "confirmed" | "unreviewed";
  authorityVersion?: number;
  primaryCorrectionVersion?: number;
  createdAt: number;
  updatedAt: number;
};

export type CycleIntervalSegment = {
  startDate: string;
  status: "active" | "superseded";
  createdAt: number;
  supersededAt?: number;
};

type CycleIntervalEndpoint = {
  provenance: "self" | "partner_assist" | "system" | "unknown";
  authorityVersion?: number;
  primaryCorrectionVersion?: number;
  createdAt: number;
  updatedAt: number;
};

export type CycleInterval = {
  lengthDays: number;
  from: CycleIntervalEndpoint;
  to: CycleIntervalEndpoint;
  included: boolean;
  reasonCodes: CycleIntervalReasonCode[];
};

export type CycleIntervalDerivation = {
  basis: {
    version: typeof CYCLE_INTERVALS_VERSION;
    cutoffAt: number;
    cutoffDate: string;
    segmentStartDate?: string;
    segmentCreatedAt?: number;
  };
  latestEligibleStartDate?: string;
  eligibleAnchorCount: number;
  eligibleIntervalCount: number;
  intervals: CycleInterval[];
  reasonCodes: CycleIntervalReasonCode[];
};

export type DeriveCycleIntervalsOptions = {
  cutoffAt: number;
  cutoffDate: string;
  segments?: readonly CycleIntervalSegment[];
};

function hasValidDate(value: string): boolean {
  try {
    requireValidCalendarDate(value, "Cycle start date");
    return true;
  } catch {
    return false;
  }
}

function activeSegmentAt(
  segments: readonly CycleIntervalSegment[],
  cutoffAt: number,
): CycleIntervalSegment | undefined {
  return segments
    .filter((segment) => {
      if (
        !hasValidDate(segment.startDate) ||
        segment.createdAt > cutoffAt ||
        !Number.isFinite(segment.createdAt)
      ) {
        return false;
      }

      if (segment.supersededAt === undefined) {
        return segment.status === "active";
      }

      return (
        segment.status === "superseded" &&
        Number.isFinite(segment.supersededAt) &&
        cutoffAt < segment.supersededAt
      );
    })
    .sort((left, right) => right.createdAt - left.createdAt)[0];
}

function isCorrected(event: CycleIntervalEvent): boolean {
  return (
    event.primaryCorrectionVersion !== undefined ||
    (event.authorityVersion ?? 0) > 1
  );
}

function endpoint(event: CycleIntervalEvent): CycleIntervalEndpoint {
  return {
    provenance: event.source ?? "unknown",
    ...(event.authorityVersion === undefined
      ? {}
      : { authorityVersion: event.authorityVersion }),
    ...(event.primaryCorrectionVersion === undefined
      ? {}
      : { primaryCorrectionVersion: event.primaryCorrectionVersion }),
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

function sortedReasons(
  reasons: ReadonlySet<CycleIntervalReasonCode>,
): CycleIntervalReasonCode[] {
  return [...reasons].sort();
}

function possibleMissingLog(
  lengthDays: number,
  precedingLengths: readonly number[],
): boolean {
  if (precedingLengths.length < 3) return false;

  // ponytail: prefix sorts are O(n^2 log n);
  // use a streaming median if lifetime histories grow.
  const ordered = [...precedingLengths].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  const median =
    ordered.length % 2 === 1
      ? ordered[middle]
      : (ordered[middle - 1] + ordered[middle]) / 2;
  if (lengthDays < 1.75 * median) return false;

  const nearestMultipleDistance = Math.min(
    Math.abs(lengthDays - 2 * median),
    Math.abs(lengthDays - 3 * median),
  );
  return nearestMultipleDistance <= Math.max(2, 0.15 * median);
}

export function deriveCycleIntervals(
  periods: readonly CycleIntervalEvent[],
  options: DeriveCycleIntervalsOptions,
): CycleIntervalDerivation {
  if (!Number.isFinite(options.cutoffAt)) {
    throw new Error("Cycle interval cutoff must be a finite timestamp");
  }
  requireValidCalendarDate(options.cutoffDate, "Cycle interval cutoff date");

  const reasonCodes = new Set<CycleIntervalReasonCode>();
  const cutoffEligible: CycleIntervalEvent[] = [];

  for (const period of periods) {
    if (period.tombstoneAt !== undefined) {
      reasonCodes.add("TOMBSTONED");
      continue;
    }
    if (!hasValidDate(period.startDate)) {
      reasonCodes.add("INVALID_DATE");
      continue;
    }
    if (
      !Number.isFinite(period.createdAt) ||
      !Number.isFinite(period.updatedAt) ||
      period.createdAt > options.cutoffAt ||
      period.updatedAt > options.cutoffAt ||
      period.startDate > options.cutoffDate
    ) {
      reasonCodes.add("AFTER_CUTOFF");
      continue;
    }
    if (period.confirmationStatus === "unreviewed") {
      reasonCodes.add("LEGACY_UNKNOWN");
      continue;
    }
    if (period.legacyReason !== undefined) {
      reasonCodes.add("LEGACY_UNKNOWN");
      continue;
    }
    if (period.startCertainty === "approximate") {
      reasonCodes.add("APPROXIMATE_DATE");
      continue;
    }
    if (!isStartAnchorEligible(period)) {
      reasonCodes.add("LEGACY_UNKNOWN");
      continue;
    }
    cutoffEligible.push(period);
  }

  const segment = activeSegmentAt(options.segments ?? [], options.cutoffAt);
  if (segment) reasonCodes.add("CONTEXT_SEGMENT");
  const anchors = filterHistoryForPredictionSegment(cutoffEligible, segment);
  if (anchors.length !== cutoffEligible.length) {
    reasonCodes.add("CONTEXT_SEGMENT");
  }

  anchors.sort(
    (left, right) =>
      left.startDate.localeCompare(right.startDate) ||
      left.createdAt - right.createdAt ||
      (left.source ?? "unknown").localeCompare(right.source ?? "unknown") ||
      (left.authorityVersion ?? 0) - (right.authorityVersion ?? 0),
  );

  const intervals: CycleInterval[] = [];
  const precedingLengths: number[] = [];
  let eligibleIntervalCount = 0;

  for (let index = 1; index < anchors.length; index += 1) {
    const from = anchors[index - 1];
    const to = anchors[index];
    const lengthDays = daysBetweenCalendarDates(from.startDate, to.startDate);
    const intervalReasons = new Set<CycleIntervalReasonCode>();
    if (segment) intervalReasons.add("CONTEXT_SEGMENT");
    if (from.source === "partner_assist" || to.source === "partner_assist") {
      intervalReasons.add("PARTNER_ASSISTED");
      reasonCodes.add("PARTNER_ASSISTED");
    }
    if (isCorrected(from) || isCorrected(to)) {
      // The frozen protocol has no recency window; retain every correction marker.
      intervalReasons.add("RECENT_CORRECTION");
      reasonCodes.add("RECENT_CORRECTION");
    }

    const included = lengthDays > 0;
    if (!included) {
      intervalReasons.add("NON_POSITIVE_INTERVAL");
    } else {
      if (possibleMissingLog(lengthDays, precedingLengths)) {
        intervalReasons.add("POSSIBLE_MISSING_LOG");
        reasonCodes.add("POSSIBLE_MISSING_LOG");
      }
      precedingLengths.push(lengthDays);
      eligibleIntervalCount += 1;
    }

    for (const reason of intervalReasons) reasonCodes.add(reason);
    intervals.push({
      lengthDays,
      from: endpoint(from),
      to: endpoint(to),
      included,
      reasonCodes: sortedReasons(intervalReasons),
    });
  }

  if (eligibleIntervalCount < 3) reasonCodes.add("LIMITED_HISTORY");

  return {
    basis: {
      version: CYCLE_INTERVALS_VERSION,
      cutoffAt: options.cutoffAt,
      cutoffDate: options.cutoffDate,
      ...(segment
        ? {
            segmentStartDate: segment.startDate,
            segmentCreatedAt: segment.createdAt,
          }
        : {}),
    },
    ...(anchors.length > 0
      ? { latestEligibleStartDate: anchors[anchors.length - 1].startDate }
      : {}),
    eligibleAnchorCount: anchors.length,
    eligibleIntervalCount,
    intervals,
    reasonCodes: sortedReasons(reasonCodes),
  };
}
