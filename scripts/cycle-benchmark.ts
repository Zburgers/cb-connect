import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { addCalendarDays } from "../convex/_helpers/cycleCalculations";
import { isStartAnchorEligible } from "../convex/_helpers/cycleFactEligibility";
import {
  deriveCycleIntervals,
  isPossibleMissingLogInterval,
  type CycleIntervalDerivation,
  type CycleIntervalEvent,
  type CycleIntervalSegment,
} from "../convex/_helpers/cycleIntervals";
import { requireValidCalendarDate, toCalendarDateInTimeZone } from "../convex/_helpers/calendarDates";
import { daysBetweenCalendarDates } from "../convex/_helpers/predictionBounds";
import {
  buildPredictionIntervals,
  MIN_CALIBRATION_RESIDUALS,
  PREDICTION_CALIBRATION_VERSION,
  type BuildPredictionIntervalsInput,
  type PredictionCalibrationSource,
  type PredictionDateWindow,
  type PredictionIntervalReasonCode,
  type PredictionIntervals,
  type PredictionVariability,
  type PredictionVariabilityBand,
} from "../convex/_helpers/predictionIntervals";
import {
  derivePredictionQuality,
  type PredictionQuality,
  type PredictionQualityReasonCode,
  type PredictionQualityState,
} from "../convex/_helpers/predictionQuality";
import {
  estimatePredictionCandidate,
  PREDICTION_ESTIMATOR_IDS,
  type PredictionEstimatorId,
} from "../convex/_helpers/predictionEstimators";
import {
  assignCycleBenchmarkPartition,
  validateCycleBenchmarkManifest,
  type CycleBenchmarkManifest,
  type CycleBenchmarkPartition,
} from "./cycle-benchmark-manifest";

export const CYCLE_BENCHMARK_DATA_VERSION = "g3-cycle-benchmark-data-v1" as const;
export const CYCLE_BENCHMARK_METRIC_VERSION = "cycle-benchmark-metrics-v2" as const;
export const CYCLE_BENCHMARK_BOOTSTRAP_VERSION =
  "user-cluster-percentile-95-2000-v1" as const;
const BOOTSTRAP_SAMPLES = 2000;
const GOLDEN_SALT = "g3-golden-only-split-salt-v1";
const GOLDEN_SALT_ID = "synthetic-only-v1";
const GOLDEN_DATASET = "fixtures/cycle-benchmark";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EVALUATION_OPENINGS_DIR = resolve(
  REPO_ROOT,
  "docs/research/cycle-benchmark-evaluation-openings",
);

type BenchmarkEvent = CycleIntervalEvent & { eventKey: string };
type BenchmarkSegment = CycleIntervalSegment & { segmentKey: string };

export type CycleBenchmarkUser = {
  userKey: string;
  timezone: string;
  configuredCycleLength: number;
  events: BenchmarkEvent[];
  segments: BenchmarkSegment[];
};

export type CycleBenchmarkDataset = {
  formatVersion: typeof CYCLE_BENCHMARK_DATA_VERSION;
  users: CycleBenchmarkUser[];
};

type DevelopmentCutoffs = NonNullable<CycleBenchmarkManifest["developmentCutoffs"]>;

type BenchmarkPrediction = {
  pointDate: string;
  signedErrorDays: number;
  absoluteErrorDays: number;
  personalizationEligible: boolean;
  intervals?: PredictionIntervals;
  quality?: PredictionQuality;
};

type BenchmarkFold = {
  userKey: string;
  targetDate: string;
  historyCount: number;
  medianInterval: number;
  variabilityMad: number;
  groups: Record<string, string>;
  predictionContext: NonNullable<BuildPredictionIntervalsInput["context"]>;
  predictions: Record<PredictionEstimatorId, BenchmarkPrediction>;
};

type PredictionCalibrationSummary = {
  version: typeof PREDICTION_CALIBRATION_VERSION;
  calibrationSource: PredictionCalibrationSource | "mixed";
  calibrationSources: Record<PredictionCalibrationSource, number>;
  calibrationOutcomeCount: number;
  empiricalTargetCoverageLevel: 80 | null;
  intervalOutcomeCount: number;
  interval50CoverageRate: number;
  interval80CoverageRate: number;
  medianWindow50Days: number;
  medianWindow80Days: number;
  qualityCounts: Record<PredictionQualityState, number>;
  qualityScoreV1: { p10: number; median: number; p90: number } | null;
  reasonCodeCounts: Partial<
    Record<PredictionIntervalReasonCode | PredictionQualityReasonCode, number>
  >;
};

type InternalBenchmarkResult = {
  folds: BenchmarkFold[];
  unscorableTargets: Array<{ groups: Record<string, string> }>;
  targetCount: number;
};

type CandidateMetrics = {
  estimatorId: PredictionEstimatorId;
  estimatorVersion: 1;
  outcomeCount: number;
  meanAbsoluteErrorDays: number | null;
  medianAbsoluteErrorDays: number | null;
  rmseDays: number | null;
  within1DayRate: number | null;
  within2DayRate: number | null;
  within3DayRate: number | null;
  within5DayRate: number | null;
  signedErrorDays: {
    mean: number;
    p10: number;
    p25: number;
    median: number;
    p75: number;
    p90: number;
  } | null;
  abstentionRate: number;
  insufficientDataRate: number | null;
  personalizationEligibilityRate: number | null;
  pairedAbsoluteErrorDifferenceDays: {
    configured_v1: PairedDifference | null;
    all_median_v1: PairedDifference | null;
  };
  predictionCalibration: PredictionCalibrationSummary | null;
};

type PairedDifference = {
  mean: number;
  median: number;
  bootstrap95Ci: { lower: number; upper: number } | null;
};

export type CycleBenchmarkReport = {
  protocolVersion: string;
  dataFormatVersion: typeof CYCLE_BENCHMARK_DATA_VERSION;
  metricImplementationVersion: typeof CYCLE_BENCHMARK_METRIC_VERSION;
  pairedBootstrapVersion: typeof CYCLE_BENCHMARK_BOOTSTRAP_VERSION;
  partition: CycleBenchmarkPartition;
  datasetClass: CycleBenchmarkManifest["datasetClass"];
  manifestId: string;
  manifestSha256: string;
  datasetSha256: string;
  splitVersion: string;
  splitSaltId: string;
  sourceCommit: string;
  sourceTreeState: "clean" | "dirty";
  protocolSha256: string;
  calibration: {
    version: typeof PREDICTION_CALIBRATION_VERSION;
    source: "calibration_partition" | "none";
    fitOutcomeCount: number;
    empiricalTargetCoverageLevel: null;
  };
  userCount: number;
  targetCount: number;
  outcomeCount: number;
  unscorableTargetCount: number;
  developmentCutoffs: DevelopmentCutoffs | null;
  estimators: CandidateMetrics[];
  subgroups: Array<{
    dimension: string;
    group: string;
    targetCount: number;
    outcomeCount: number;
    unscorableTargetCount: number;
    estimators: CandidateMetrics[];
  }>;
  promotionStatus: "synthetic_not_evidence" | "not_assessed";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

function requireOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error(`${label} contains an unsupported field`);
  }
}

function requireTimestamp(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} must be an epoch-millisecond timestamp`);
}

function requireOptionalVersion(value: unknown, label: string): void {
  if (value !== undefined && (!Number.isSafeInteger(value) || (value as number) < 1)) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function validateEvent(value: unknown): asserts value is BenchmarkEvent {
  if (!isRecord(value)) throw new Error("Benchmark event is invalid");
  requireOnlyKeys(
    value,
    [
      "eventKey",
      "startDate",
      "startCertainty",
      "legacyReason",
      "tombstoneAt",
      "source",
      "confirmationStatus",
      "authorityVersion",
      "primaryCorrectionVersion",
      "createdAt",
      "updatedAt",
    ],
    "Benchmark event",
  );
  if (!isNonEmptyString(value.eventKey) || typeof value.startDate !== "string") {
    throw new Error("Benchmark event identity or date is invalid");
  }
  requireValidCalendarDate(value.startDate, "Benchmark event date");
  if (
    value.startCertainty !== undefined &&
    value.startCertainty !== "exact" &&
    value.startCertainty !== "approximate"
  ) {
    throw new Error("Benchmark event certainty is invalid");
  }
  if (value.legacyReason !== undefined && !isNonEmptyString(value.legacyReason)) {
    throw new Error("Benchmark event legacy marker is invalid");
  }
  if (value.source !== undefined && !["self", "partner_assist", "system"].includes(String(value.source))) {
    throw new Error("Benchmark event provenance is invalid");
  }
  if (
    value.confirmationStatus !== undefined &&
    value.confirmationStatus !== "confirmed" &&
    value.confirmationStatus !== "unreviewed"
  ) {
    throw new Error("Benchmark event confirmation state is invalid");
  }
  requireTimestamp(value.createdAt, "Benchmark event createdAt");
  requireTimestamp(value.updatedAt, "Benchmark event updatedAt");
  if (value.updatedAt < value.createdAt) {
    throw new Error("Benchmark event update predates its creation");
  }
  requireOptionalVersion(value.authorityVersion, "Benchmark authority version");
  requireOptionalVersion(value.primaryCorrectionVersion, "Primary correction version");
  if (value.tombstoneAt !== undefined) {
    requireTimestamp(value.tombstoneAt, "Benchmark tombstoneAt");
    if (value.tombstoneAt < value.createdAt || value.tombstoneAt > value.updatedAt) {
      throw new Error("Benchmark tombstone timing is invalid");
    }
  }
}

function validateSegment(value: unknown): asserts value is BenchmarkSegment {
  if (!isRecord(value)) throw new Error("Benchmark segment is invalid");
  requireOnlyKeys(
    value,
    ["segmentKey", "startDate", "status", "createdAt", "supersededAt"],
    "Benchmark segment",
  );
  if (
    !isNonEmptyString(value.segmentKey) ||
    typeof value.startDate !== "string" ||
    (value.status !== "active" && value.status !== "superseded")
  ) {
    throw new Error("Benchmark segment metadata is invalid");
  }
  requireValidCalendarDate(value.startDate, "Benchmark segment start date");
  requireTimestamp(value.createdAt, "Benchmark segment createdAt");
  if (value.status === "active" && value.supersededAt !== undefined) {
    throw new Error("Active benchmark segment cannot have a supersededAt timestamp");
  }
  if (value.status === "superseded") {
    requireTimestamp(value.supersededAt, "Benchmark segment supersededAt");
    if ((value.supersededAt as number) < value.createdAt) {
      throw new Error("Benchmark segment supersession predates creation");
    }
  }
}

export function validateCycleBenchmarkDataset(
  value: unknown,
): asserts value is CycleBenchmarkDataset {
  if (!isRecord(value)) throw new Error("Benchmark data file is invalid");
  requireOnlyKeys(value, ["formatVersion", "users"], "Benchmark data");
  if (
    value.formatVersion !== CYCLE_BENCHMARK_DATA_VERSION ||
    !Array.isArray(value.users)
  ) {
    throw new Error("Benchmark data format is unsupported");
  }

  const userKeys = new Set<string>();
  for (const candidate of value.users) {
    if (!isRecord(candidate)) throw new Error("Benchmark user is invalid");
    requireOnlyKeys(
      candidate,
      ["userKey", "timezone", "configuredCycleLength", "events", "segments"],
      "Benchmark user",
    );
    if (
      !isNonEmptyString(candidate.userKey) ||
      !isNonEmptyString(candidate.timezone) ||
      typeof candidate.configuredCycleLength !== "number" ||
      !Number.isFinite(candidate.configuredCycleLength) ||
      candidate.configuredCycleLength < 21 ||
      candidate.configuredCycleLength > 40 ||
      !Array.isArray(candidate.events) ||
      !Array.isArray(candidate.segments)
    ) {
      throw new Error("Benchmark user fields are invalid");
    }
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: candidate.timezone }).format();
    } catch {
      throw new Error("Benchmark user time zone is invalid");
    }
    if (userKeys.has(candidate.userKey)) throw new Error("Benchmark user key is duplicated");
    userKeys.add(candidate.userKey);

    const eventVersions = new Map<string, BenchmarkEvent[]>();
    for (const event of candidate.events) {
      validateEvent(event);
      const versions = eventVersions.get(event.eventKey) ?? [];
      versions.push(event);
      eventVersions.set(event.eventKey, versions);
    }
    for (const versions of eventVersions.values()) {
      versions.sort((left, right) => left.updatedAt - right.updatedAt);
      if (
        versions.some(
          (event, index) =>
            (index > 0 && event.updatedAt === versions[index - 1].updatedAt) ||
            event.createdAt !== versions[0].createdAt,
        )
      ) {
        throw new Error("Benchmark event version history is ambiguous");
      }
    }
    const exactStartDates = new Set<string>();
    for (const versions of eventVersions.values()) {
      const event = versions[versions.length - 1];
      if (
        event.startCertainty === "exact" &&
        event.legacyReason === undefined &&
        event.tombstoneAt === undefined &&
        event.confirmationStatus !== "unreviewed"
      ) {
        if (exactStartDates.has(event.startDate)) {
          throw new Error("Benchmark user has duplicate exact start dates");
        }
        exactStartDates.add(event.startDate);
      }
    }

    const segmentKeys = new Set<string>();
    for (const segment of candidate.segments) {
      validateSegment(segment);
      if (segmentKeys.has(segment.segmentKey)) {
        throw new Error("Benchmark segment key is duplicated");
      }
      segmentKeys.add(segment.segmentKey);
    }
  }
}

function latestEventVersions(user: CycleBenchmarkUser): BenchmarkEvent[] {
  const latest = new Map<string, BenchmarkEvent>();
  for (const event of user.events) {
    const previous = latest.get(event.eventKey);
    if (!previous || event.updatedAt > previous.updatedAt) latest.set(event.eventKey, event);
  }
  return [...latest.values()];
}

function eventSnapshotAt(
  user: CycleBenchmarkUser,
  cutoffAt: number,
): BenchmarkEvent[] {
  const asOf = new Map<string, BenchmarkEvent>();
  for (const event of user.events) {
    if (event.createdAt > cutoffAt || event.updatedAt > cutoffAt) continue;
    const previous = asOf.get(event.eventKey);
    if (!previous || event.updatedAt > previous.updatedAt) asOf.set(event.eventKey, event);
  }
  return [...asOf.values()];
}

function firstInstantOfLocalDate(date: string, timeZone: string): number {
  const target = Date.parse(`${date}T00:00:00.000Z`);
  let low = target - 36 * 60 * 60 * 1000;
  let high = target + 36 * 60 * 60 * 1000;
  if (
    toCalendarDateInTimeZone(new Date(low), timeZone) >= date ||
    toCalendarDateInTimeZone(new Date(high), timeZone) < date
  ) {
    throw new Error("Could not resolve the local prediction cutoff");
  }
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (toCalendarDateInTimeZone(new Date(middle), timeZone) < date) low = middle;
    else high = middle;
  }
  if (toCalendarDateInTimeZone(new Date(high), timeZone) !== date) {
    throw new Error("Local calendar date does not exist in the benchmark time zone");
  }
  return high;
}

function median(values: readonly number[]): number {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

function percentile(values: readonly number[], proportion: number): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.max(0, Math.ceil(proportion * ordered.length) - 1)];
}

function correctionMarked(event: BenchmarkEvent): boolean {
  return (
    event.primaryCorrectionVersion !== undefined ||
    (event.authorityVersion ?? 0) > 1
  );
}

function classifyVariability(
  mad: number,
  cutoffs: DevelopmentCutoffs | null,
): string {
  if (!cutoffs) return "unavailable";
  if (mad <= cutoffs.variabilityMadQ33) return "stable";
  if (mad > cutoffs.variabilityMadQ67) return "high";
  return "moderate";
}

function classifyRelativeLength(
  medianInterval: number,
  cutoffs: DevelopmentCutoffs | null,
): string {
  if (!cutoffs) return "unavailable";
  if (medianInterval <= cutoffs.medianIntervalQ33) return "short";
  if (medianInterval >= cutoffs.medianIntervalQ67) return "long";
  return "typical";
}

function deriveFoldGroups(
  user: CycleBenchmarkUser,
  target: BenchmarkEvent,
  cutoffAt: number,
  cutoffDate: string,
  history: readonly BenchmarkEvent[],
  segments: readonly BenchmarkSegment[],
  derivation: CycleIntervalDerivation,
  intervalLengths: readonly number[],
  variabilityMad: number | null,
  developmentCutoffs: DevelopmentCutoffs | null,
): Record<string, string> {
  const segmentStartDate = derivation.basis.segmentStartDate;
  const priorHistory = history.filter(
    (event) =>
      event.startDate <= cutoffDate &&
      event.startDate >= (segmentStartDate ?? "0000-01-01") &&
      event.tombstoneAt === undefined,
  );
  const priorEvents = priorHistory.filter(
    (event) =>
      event.confirmationStatus !== "unreviewed" &&
      isStartAnchorEligible(event),
  );
  const priorObservationDate = priorHistory
    .filter(
      (event) =>
        event.startDate < target.startDate &&
        event.startDate <= cutoffDate &&
        event.startDate >= (segmentStartDate ?? "0000-01-01") &&
        event.tombstoneAt === undefined,
    )
    .reduce<string | undefined>(
      (latest, event) =>
        latest === undefined || event.startDate > latest ? event.startDate : latest,
      undefined,
    );
  const nearbyExcluded = priorHistory.some(
    (event) =>
      event.startDate === priorObservationDate &&
      (event.legacyReason !== undefined || event.startCertainty === "approximate"),
  );
  const correctedInputKeys = new Set(
    user.events
      .filter((event) => event.updatedAt > cutoffAt && event.createdAt <= cutoffAt)
      .map((event) => event.eventKey),
  );
  const recentCorrection =
    correctionMarked(target) ||
    priorHistory.some(
      (event) => correctionMarked(event) || correctedInputKeys.has(event.eventKey),
    );
  const segmentBoundary =
    segmentStartDate !== undefined &&
    segments.some(
      (segment) =>
        segment.startDate > segmentStartDate &&
        segment.startDate <= target.startDate &&
        segment.createdAt > cutoffAt &&
        segment.createdAt <= target.createdAt,
    );
  const medianInterval = intervalLengths.length ? median(intervalLengths) : null;
  const targetInterval = derivation.latestEligibleStartDate
    ? daysBetweenCalendarDates(
        derivation.latestEligibleStartDate,
        target.startDate,
      )
    : null;

  return {
    variability:
      variabilityMad === null
        ? "unavailable"
        : classifyVariability(variabilityMad, developmentCutoffs),
    historyCount:
      intervalLengths.length < 3
        ? "sparse"
        : intervalLengths.length === 3
          ? "3"
          : intervalLengths.length <= 6
            ? "4-6"
            : intervalLengths.length <= 12
              ? "7-12"
              : "13+",
    relativeLength:
      medianInterval === null
        ? "unavailable"
        : classifyRelativeLength(medianInterval, developmentCutoffs),
    possibleMissingLog:
      targetInterval !== null &&
      isPossibleMissingLogInterval(targetInterval, intervalLengths)
        ? "yes"
        : "no",
    approximateLegacyAdjacent: nearbyExcluded ? "yes" : "no",
    recentCorrection: recentCorrection ? "yes" : "no",
    partnerAssisted:
      target.source === "partner_assist" ||
      priorEvents.some((event) => event.source === "partner_assist")
        ? "yes"
        : "no",
    segmentBoundary: segmentBoundary ? "yes" : "no",
  };
}

function buildUserFolds(
  user: CycleBenchmarkUser,
  developmentCutoffs: DevelopmentCutoffs | null,
): InternalBenchmarkResult {
  const targets = latestEventVersions(user)
    .filter(
      (event) =>
        event.confirmationStatus !== "unreviewed" &&
        event.tombstoneAt === undefined &&
        event.legacyReason === undefined &&
        event.startCertainty === "exact",
    )
    .sort((left, right) => left.startDate.localeCompare(right.startDate));
  const folds: BenchmarkFold[] = [];
  const unscorableTargets: InternalBenchmarkResult["unscorableTargets"] = [];
  let targetCount = 0;

  // ponytail: each target rebuilds prior history in O(n^2) per user; stream snapshots if histories grow.
  for (const target of targets) {
    // Freeze inputs immediately before the target's local start day.
    const cutoffAt = firstInstantOfLocalDate(target.startDate, user.timezone) - 1;
    const cutoffDate = addCalendarDays(target.startDate, -1);
    const knownTargetVersion = user.events.some(
      (event) =>
        event.eventKey === target.eventKey &&
        event.updatedAt <= cutoffAt &&
        event.createdAt <= cutoffAt,
    );
    if (knownTargetVersion) continue;

    targetCount += 1;
    const history = eventSnapshotAt(user, cutoffAt);
    const derived = deriveCycleIntervals(history, {
      cutoffAt,
      cutoffDate,
      segments: user.segments,
    });
    const intervalLengths = derived.intervals
      .filter((interval) => interval.included)
      .map((interval) => interval.lengthDays);
    const medianInterval = intervalLengths.length ? median(intervalLengths) : 0;
    const variabilityMad = intervalLengths.length
      ? median(intervalLengths.map((length) => Math.abs(length - medianInterval)))
      : null;
    const groups = deriveFoldGroups(
      user,
      target,
      cutoffAt,
      cutoffDate,
      history,
      user.segments,
      derived,
      intervalLengths,
      variabilityMad,
      developmentCutoffs,
    );
    if (!derived.latestEligibleStartDate) {
      unscorableTargets.push({ groups });
      continue;
    }
    const predictions = {} as Record<PredictionEstimatorId, BenchmarkPrediction>;
    for (const estimatorId of PREDICTION_ESTIMATOR_IDS) {
      const estimate = estimatePredictionCandidate(estimatorId, {
        configuredCycleLength: user.configuredCycleLength,
        intervalsOldestToNewest: intervalLengths,
      });
      const cycleDays = Math.floor(estimate.pointCycleLength + 0.5);
      const pointDate = addCalendarDays(derived.latestEligibleStartDate, cycleDays);
      const signedErrorDays = daysBetweenCalendarDates(target.startDate, pointDate);
      predictions[estimatorId] = {
        pointDate,
        signedErrorDays,
        absoluteErrorDays: Math.abs(signedErrorDays),
        personalizationEligible: estimate.personalizationEligible,
      };
    }
    folds.push({
      userKey: user.userKey,
      targetDate: target.startDate,
      historyCount: intervalLengths.length,
      medianInterval,
      variabilityMad: variabilityMad ?? 0,
      groups,
      // Derivation flags use only the cutoff history; groups also include target outcomes.
      predictionContext: {
        approximateLegacyAdjacent: groups.approximateLegacyAdjacent === "yes",
        partnerAssisted: derived.reasonCodes.includes("PARTNER_ASSISTED"),
        possibleMissingLog: derived.reasonCodes.includes("POSSIBLE_MISSING_LOG"),
        recentCorrection: derived.reasonCodes.includes("RECENT_CORRECTION"),
        segmentBoundary: derived.basis.segmentStartDate !== undefined,
      },
      predictions,
    });
  }

  return { folds, unscorableTargets, targetCount };
}

function deriveDevelopmentCutoffs(folds: readonly BenchmarkFold[]): DevelopmentCutoffs | null {
  const valid = folds.filter((fold) => fold.historyCount > 0);
  if (valid.length === 0) return null;
  const variability = valid.map((fold) => fold.variabilityMad);
  const medianIntervals = valid.map((fold) => fold.medianInterval);
  return {
    variabilityMadQ33: percentile(variability, 1 / 3) as number,
    variabilityMadQ67: percentile(variability, 2 / 3) as number,
    medianIntervalQ33: percentile(medianIntervals, 1 / 3) as number,
    medianIntervalQ67: percentile(medianIntervals, 2 / 3) as number,
  };
}

function emptyCandidateMetrics(
  estimatorId: PredictionEstimatorId,
  abstentionRate: number,
  insufficientDataRate: number | null,
): CandidateMetrics {
  return {
    estimatorId,
    estimatorVersion: 1,
    outcomeCount: 0,
    meanAbsoluteErrorDays: null,
    medianAbsoluteErrorDays: null,
    rmseDays: null,
    within1DayRate: null,
    within2DayRate: null,
    within3DayRate: null,
    within5DayRate: null,
    signedErrorDays: null,
    abstentionRate,
    insufficientDataRate,
    personalizationEligibilityRate: null,
    pairedAbsoluteErrorDifferenceDays: {
      configured_v1: null,
      all_median_v1: null,
    },
    predictionCalibration: null,
  };
}

function predictionCalibrationSummary(
  folds: readonly BenchmarkFold[],
  estimatorId: PredictionEstimatorId,
): PredictionCalibrationSummary | null {
  const predictions = folds
    .map((fold) => ({
      targetDate: fold.targetDate,
      prediction: fold.predictions[estimatorId],
    }))
    .filter(
      (row): row is { targetDate: string; prediction: BenchmarkPrediction & { intervals: PredictionIntervals; quality: PredictionQuality } } =>
        row.prediction.intervals !== undefined && row.prediction.quality !== undefined,
    );
  if (predictions.length === 0) return null;

  const inside = (date: string, interval: PredictionDateWindow) =>
    interval.earliestDate <= date && date <= interval.latestDate;
  const widths = (getWindow: (prediction: PredictionIntervals) => PredictionIntervals["window50"]) =>
    predictions.map(({ prediction }) => {
      const window = getWindow(prediction.intervals!);
      return daysBetweenCalendarDates(window.earliestDate, window.latestDate);
    });
  const scores = predictions
    .map(({ prediction }) => prediction.quality!.qualityScoreV1)
    .filter((score): score is number => score !== null);
  const qualityCounts: PredictionCalibrationSummary["qualityCounts"] = {
    high: 0,
    moderate: 0,
    low: 0,
    timing_less_predictable: 0,
    limited_evidence: 0,
  };
  const calibrationSources: PredictionCalibrationSummary["calibrationSources"] = {
    calibration_partition: 0,
    calibration_and_personal: 0,
    personal_walk_forward: 0,
    none: 0,
  };
  const reasonCodeCounts: PredictionCalibrationSummary["reasonCodeCounts"] = {};
  for (const { prediction } of predictions) {
    qualityCounts[prediction.quality!.quality] += 1;
    calibrationSources[prediction.intervals!.calibrationSource] += 1;
    for (
      const reason of new Set([
        ...prediction.intervals!.reasonCodes,
        ...prediction.quality!.reasonCodes,
      ])
    ) {
      reasonCodeCounts[reason] = (reasonCodeCounts[reason] ?? 0) + 1;
    }
  }
  const usedSources = Object.entries(calibrationSources)
    .filter(([, count]) => count > 0)
    .map(([source]) => source as PredictionCalibrationSource);

  return {
    version: PREDICTION_CALIBRATION_VERSION,
    calibrationSource: usedSources.length === 1 ? usedSources[0] : "mixed",
    calibrationSources,
    calibrationOutcomeCount: median(
      predictions.map(({ prediction }) => prediction.intervals!.calibrationOutcomeCount),
    ),
    empiricalTargetCoverageLevel: predictions.every(
      ({ prediction }) => prediction.intervals!.empiricalTargetCoverageLevel === 80,
    )
      ? 80
      : null,
    intervalOutcomeCount: predictions.length,
    interval50CoverageRate:
      predictions.filter(({ targetDate, prediction }) =>
        inside(targetDate, prediction.intervals!.window50),
      ).length / predictions.length,
    interval80CoverageRate:
      predictions.filter(({ targetDate, prediction }) =>
        inside(targetDate, prediction.intervals!.window80),
      ).length / predictions.length,
    medianWindow50Days: median(widths((intervals) => intervals.window50)),
    medianWindow80Days: median(widths((intervals) => intervals.window80)),
    qualityCounts,
    qualityScoreV1: scores.length
      ? {
          p10: percentile(scores, 0.1) as number,
          median: median(scores),
          p90: percentile(scores, 0.9) as number,
        }
      : null,
    reasonCodeCounts,
  };
}

function pairedDifference(
  folds: readonly BenchmarkFold[],
  estimatorId: PredictionEstimatorId,
  baselineId: "configured_v1" | "all_median_v1",
  seedKey: string,
  calculateBootstrapCi: boolean,
): PairedDifference | null {
  if (folds.length === 0) return null;
  const differences = folds.map(
    (fold) =>
      fold.predictions[estimatorId].absoluteErrorDays -
      fold.predictions[baselineId].absoluteErrorDays,
  );
  let bootstrap95Ci: PairedDifference["bootstrap95Ci"] = null;
  if (calculateBootstrapCi) {
    const byUser = new Map<string, { sum: number; count: number }>();
    for (const fold of folds) {
      const result = byUser.get(fold.userKey) ?? { sum: 0, count: 0 };
      result.sum +=
        fold.predictions[estimatorId].absoluteErrorDays -
        fold.predictions[baselineId].absoluteErrorDays;
      result.count += 1;
      byUser.set(fold.userKey, result);
    }
    const users = [...byUser.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, user]) => user);
    if (users.length >= 2) {
      let state = Number.parseInt(
        createHash("sha256").update(seedKey, "utf8").digest("hex").slice(0, 8),
        16,
      ) >>> 0;
      const samples: number[] = [];
      for (let iteration = 0; iteration < BOOTSTRAP_SAMPLES; iteration += 1) {
        let sum = 0;
        let count = 0;
        for (let index = 0; index < users.length; index += 1) {
          state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
          const user = users[Math.floor((state / 2 ** 32) * users.length)];
          sum += user.sum;
          count += user.count;
        }
        samples.push(sum / count);
      }
      bootstrap95Ci = {
        lower: percentile(samples, 0.025) as number,
        upper: percentile(samples, 0.975) as number,
      };
    }
  }
  return {
    mean: differences.reduce((sum, value) => sum + value, 0) / differences.length,
    median: median(differences),
    bootstrap95Ci,
  };
}

function candidateMetrics(
  estimatorId: PredictionEstimatorId,
  folds: readonly BenchmarkFold[],
  targetCount: number,
  unscorableTargetCount: number,
  bootstrapSeed: string,
  calculateBootstrapCi = false,
): CandidateMetrics {
  if (folds.length === 0) {
    return emptyCandidateMetrics(
      estimatorId,
      targetCount === 0 ? 0 : unscorableTargetCount / targetCount,
      targetCount === 0 ? null : unscorableTargetCount / targetCount,
    );
  }
  const predictions = folds.map((fold) => fold.predictions[estimatorId]);
  const absoluteErrors = predictions.map((prediction) => prediction.absoluteErrorDays);
  const signedErrors = predictions.map((prediction) => prediction.signedErrorDays);
  const rate = (limit: number) =>
    absoluteErrors.filter((error) => error <= limit).length / absoluteErrors.length;
  const metrics: CandidateMetrics = {
    estimatorId,
    estimatorVersion: 1,
    outcomeCount: folds.length,
    meanAbsoluteErrorDays:
      absoluteErrors.reduce((sum, error) => sum + error, 0) / absoluteErrors.length,
    medianAbsoluteErrorDays: median(absoluteErrors),
    rmseDays: Math.sqrt(
      absoluteErrors.reduce((sum, error) => sum + error * error, 0) /
        absoluteErrors.length,
    ),
    within1DayRate: rate(1),
    within2DayRate: rate(2),
    within3DayRate: rate(3),
    within5DayRate: rate(5),
    signedErrorDays: {
      mean: signedErrors.reduce((sum, error) => sum + error, 0) / signedErrors.length,
      p10: percentile(signedErrors, 0.1) as number,
      p25: percentile(signedErrors, 0.25) as number,
      median: median(signedErrors),
      p75: percentile(signedErrors, 0.75) as number,
      p90: percentile(signedErrors, 0.9) as number,
    },
    abstentionRate:
      targetCount === 0 ? 0 : unscorableTargetCount / targetCount,
    insufficientDataRate:
      targetCount === 0
        ? null
        : (unscorableTargetCount +
            folds.filter((fold) => fold.historyCount < 3).length) /
          targetCount,
    personalizationEligibilityRate:
      predictions.filter((prediction) => prediction.personalizationEligible).length /
      predictions.length,
    pairedAbsoluteErrorDifferenceDays: {
      configured_v1: pairedDifference(
        folds,
        estimatorId,
        "configured_v1",
        `${bootstrapSeed}:configured_v1`,
        calculateBootstrapCi,
      ),
      all_median_v1: pairedDifference(
        folds,
        estimatorId,
        "all_median_v1",
        `${bootstrapSeed}:all_median_v1`,
        calculateBootstrapCi,
      ),
    },
    predictionCalibration: predictionCalibrationSummary(folds, estimatorId),
  };
  return metrics;
}

function buildSubgroups(
  folds: readonly BenchmarkFold[],
  unscorableTargets: readonly { groups: Record<string, string> }[],
): CycleBenchmarkReport["subgroups"] {
  const dimensions: Record<string, readonly string[]> = {
    variability: ["stable", "moderate", "high", "unavailable"],
    historyCount: ["sparse", "3", "4-6", "7-12", "13+"],
    relativeLength: ["short", "typical", "long", "unavailable"],
    possibleMissingLog: ["yes", "no"],
    approximateLegacyAdjacent: ["yes", "no"],
    recentCorrection: ["yes", "no"],
    partnerAssisted: ["yes", "no"],
    segmentBoundary: ["yes", "no"],
  };
  const report: CycleBenchmarkReport["subgroups"] = [];
  for (const [dimension, groups] of Object.entries(dimensions)) {
    for (const group of groups) {
      const matched = folds.filter((fold) => fold.groups[dimension] === group);
      const unscorable = unscorableTargets.filter(
        (target) => target.groups[dimension] === group,
      );
      const groupTargetCount = matched.length + unscorable.length;
      report.push({
        dimension,
        group,
        targetCount: groupTargetCount,
        outcomeCount: matched.length,
        unscorableTargetCount: unscorable.length,
        estimators:
          groupTargetCount === 0
            ? []
            : PREDICTION_ESTIMATOR_IDS.map((id) =>
                candidateMetrics(
                  id,
                  matched,
                  groupTargetCount,
                  unscorable.length,
                  `${dimension}:${group}:${id}`,
                ),
              ),
      });
    }
  }
  return report;
}

type EstimatorCalibrationModel = {
  globalResiduals: number[];
  byVariability: Partial<Record<PredictionVariabilityBand, number[]>>;
  byHistoryBand: Map<string, number[]>;
  riskDeciles: Map<string, number | null>;
};

type CalibrationModel = Record<PredictionEstimatorId, EstimatorCalibrationModel>;

function historyBandKey(fold: BenchmarkFold): string {
  return `${fold.groups.historyCount}:${fold.groups.variability}`;
}

function fitCalibrationModel(folds: readonly BenchmarkFold[]): CalibrationModel {
  const model = {} as CalibrationModel;
  for (const estimatorId of PREDICTION_ESTIMATOR_IDS) {
    const estimator: EstimatorCalibrationModel = {
      globalResiduals: [],
      byVariability: { stable: [], moderate: [], high: [] },
      byHistoryBand: new Map(),
      riskDeciles: new Map(),
    };
    for (const fold of folds) {
      const residual = -fold.predictions[estimatorId].signedErrorDays;
      estimator.globalResiduals.push(residual);
      const variability = fold.groups.variability;
      if (variability === "stable" || variability === "moderate" || variability === "high") {
        estimator.byVariability[variability]!.push(residual);
      }
      const key = historyBandKey(fold);
      const residuals = estimator.byHistoryBand.get(key) ?? [];
      residuals.push(residual);
      estimator.byHistoryBand.set(key, residuals);
    }

    const risks = [...estimator.byHistoryBand.entries()]
      .filter(([, residuals]) => residuals.length >= MIN_CALIBRATION_RESIDUALS)
      .map(([key, residuals]) => {
        const [, variabilityText] = key.split(":");
        const variabilityBand =
          variabilityText === "stable" ||
          variabilityText === "moderate" ||
          variabilityText === "high"
            ? variabilityText
            : "unavailable";
        const interval = buildPredictionIntervals({
          pointDate: "2000-01-01",
          variabilityBand,
          calibrationResiduals: estimator.globalResiduals,
          calibrationResidualsByVariability: estimator.byVariability,
        });
        return {
          key,
          medianAbsoluteError: median(residuals.map(Math.abs)),
          medianWindowWidth: daysBetweenCalendarDates(
            interval.window80.earliestDate,
            interval.window80.latestDate,
          ),
        };
      })
      .sort(
        (left, right) =>
          left.medianAbsoluteError - right.medianAbsoluteError ||
          left.medianWindowWidth - right.medianWindowWidth ||
          left.key.localeCompare(right.key),
      );
    for (let index = 0; index < risks.length; index += 1) {
      estimator.riskDeciles.set(
        risks[index].key,
        risks.length < 2 ? null : Math.round((index * 9) / (risks.length - 1)),
      );
    }
    model[estimatorId] = estimator;
  }
  return model;
}

function applyCalibration(
  folds: readonly BenchmarkFold[],
  model: CalibrationModel,
): BenchmarkFold[] {
  const personalResiduals = new Map<
    string,
    Map<PredictionEstimatorId, number[]>
  >();
  return folds.map((fold) => {
    const userResiduals = personalResiduals.get(fold.userKey) ?? new Map();
    const predictions = {} as Record<PredictionEstimatorId, BenchmarkPrediction>;
    for (const estimatorId of PREDICTION_ESTIMATOR_IDS) {
      const estimatorModel = model[estimatorId];
      const variabilityBand = fold.groups.variability as PredictionVariability;
      const interval = buildPredictionIntervals({
        pointDate: fold.predictions[estimatorId].pointDate,
        variabilityBand,
        historyCount: fold.historyCount,
        context: fold.predictionContext,
        calibrationResiduals: estimatorModel.globalResiduals,
        calibrationResidualsByVariability: estimatorModel.byVariability,
        personalResiduals: userResiduals.get(estimatorId) ?? [],
      });
      const quality = derivePredictionQuality({
        calibrationRiskDecile:
          estimatorModel.riskDeciles.get(historyBandKey(fold)) ?? null,
        calibrationOutcomeCount:
          estimatorModel.byHistoryBand.get(historyBandKey(fold))?.length ?? 0,
        historyCount: fold.historyCount,
        variabilityBand,
      });
      predictions[estimatorId] = {
        ...fold.predictions[estimatorId],
        intervals: interval,
        quality,
      };
    }

    // Add this target's residual only after its interval has been sized.
    for (const estimatorId of PREDICTION_ESTIMATOR_IDS) {
      const residuals = userResiduals.get(estimatorId) ?? [];
      residuals.push(-fold.predictions[estimatorId].signedErrorDays);
      userResiduals.set(estimatorId, residuals);
    }
    personalResiduals.set(fold.userKey, userResiduals);
    return { ...fold, predictions };
  });
}

export function runCycleBenchmark(options: {
  dataset: CycleBenchmarkDataset;
  manifest: CycleBenchmarkManifest;
  partition: CycleBenchmarkPartition;
  splitSalt: string;
  manifestSha256: string;
  sourceCommit: string;
  sourceTreeState: "clean" | "dirty";
  protocolSha256: string;
}): CycleBenchmarkReport {
  const partitionUsers = options.dataset.users.filter(
    (user) => assignCycleBenchmarkPartition(user.userKey, options.splitSalt) === options.partition,
  );
  const preliminary =
    options.partition === "development"
      ? partitionUsers.map((user) => buildUserFolds(user, null))
      : [];
  const developmentCutoffs = options.partition === "development"
    ? deriveDevelopmentCutoffs(preliminary.flatMap((result) => result.folds))
    : options.manifest.developmentCutoffs ?? null;
  const results = partitionUsers.map((user) => buildUserFolds(user, developmentCutoffs));
  const partitionFolds = results.flatMap((result) => result.folds);
  const calibrationFolds = options.partition === "development"
    ? []
    : options.partition === "calibration"
      ? partitionFolds
      : options.dataset.users
          .filter(
            (user) =>
              assignCycleBenchmarkPartition(user.userKey, options.splitSalt) ===
              "calibration",
          )
          .flatMap((user) => buildUserFolds(user, developmentCutoffs).folds);
  const folds = options.partition === "evaluation"
    ? applyCalibration(partitionFolds, fitCalibrationModel(calibrationFolds))
    : partitionFolds;
  const targetCount = results.reduce((sum, result) => sum + result.targetCount, 0);
  const unscorableTargets = results.flatMap((result) => result.unscorableTargets);
  const unscorableTargetCount = unscorableTargets.length;

  return {
    protocolVersion: options.manifest.protocolVersion,
    dataFormatVersion: options.dataset.formatVersion,
    metricImplementationVersion: CYCLE_BENCHMARK_METRIC_VERSION,
    pairedBootstrapVersion: CYCLE_BENCHMARK_BOOTSTRAP_VERSION,
    partition: options.partition,
    datasetClass: options.manifest.datasetClass,
    manifestId: options.manifest.manifestId,
    manifestSha256: options.manifestSha256,
    datasetSha256: options.manifest.datasetSha256,
    splitVersion: options.manifest.split.version,
    splitSaltId: options.manifest.split.saltId,
    sourceCommit: options.sourceCommit,
    sourceTreeState: options.sourceTreeState,
    protocolSha256: options.protocolSha256,
    calibration: {
      version: PREDICTION_CALIBRATION_VERSION,
      source: calibrationFolds.length > 0 ? "calibration_partition" : "none",
      fitOutcomeCount: calibrationFolds.length,
      empiricalTargetCoverageLevel: null,
    },
    userCount: partitionUsers.length,
    targetCount,
    outcomeCount: folds.length,
    unscorableTargetCount,
    developmentCutoffs,
    estimators: PREDICTION_ESTIMATOR_IDS.map((id) =>
      candidateMetrics(
        id,
        folds,
        targetCount,
        unscorableTargetCount,
        `${options.manifestSha256}:${options.partition}:${CYCLE_BENCHMARK_METRIC_VERSION}:${id}`,
        true,
      ),
    ),
    subgroups: buildSubgroups(folds, unscorableTargets),
    promotionStatus:
      options.manifest.datasetClass === "synthetic"
        ? "synthetic_not_evidence"
        : "not_assessed",
  };
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function recordEvaluationOpening(options: {
  directory: string;
  protocolVersion: string;
  datasetSha256: string;
  manifestSha256: string;
}): void {
  mkdirSync(options.directory, { recursive: true });
  const receiptPath = join(
    options.directory,
    `${options.datasetSha256.toLowerCase()}.json`,
  );
  const receipt = {
    protocolVersion: options.protocolVersion,
    datasetSha256: options.datasetSha256,
    manifestSha256: options.manifestSha256,
    consumedAt: new Date().toISOString(),
  };
  try {
    writeFileSync(receiptPath, `${JSON.stringify(receipt)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "EEXIST"
    ) {
      throw new Error("D-013 evaluation holdout has already been opened in this checkout");
    }
    throw error;
  }
}

export function loadCycleBenchmarkFiles(options: {
  datasetPath: string;
  manifestPath?: string;
  partition: CycleBenchmarkPartition;
  isGoldenFixture: boolean;
  evaluationReceiptDirectory?: string;
}): {
  dataset: CycleBenchmarkDataset;
  manifest: CycleBenchmarkManifest;
  manifestSha256: string;
} {
  if (!options.isGoldenFixture && !options.manifestPath) {
    throw new Error("Real benchmark data requires an explicit D-013 manifest");
  }
  const goldenDatasetPath = resolve(REPO_ROOT, GOLDEN_DATASET, "data.json");
  const goldenManifestPath = resolve(REPO_ROOT, GOLDEN_DATASET, "manifest.json");
  if (options.manifestPath && resolve(options.manifestPath) === resolve(options.datasetPath)) {
    throw new Error("Benchmark manifest and outcome data must be separate files");
  }
  if (
    options.isGoldenFixture &&
    (resolve(options.datasetPath) !== goldenDatasetPath ||
      (options.manifestPath !== undefined &&
        resolve(options.manifestPath) !== goldenManifestPath))
  ) {
    throw new Error("Synthetic data is limited to the checked-in golden fixture");
  }
  const manifestPath = options.manifestPath ?? goldenManifestPath;
  const manifestBytes = readFileSync(manifestPath);
  let rawManifest: unknown;
  try {
    rawManifest = JSON.parse(manifestBytes.toString("utf8"));
  } catch {
    throw new Error("Benchmark manifest is not valid JSON");
  }
  validateCycleBenchmarkManifest(rawManifest, options.partition, options.isGoldenFixture);
  if (rawManifest.datasetClass === "synthetic") {
    if (rawManifest.split.saltId !== GOLDEN_SALT_ID) {
      throw new Error("Synthetic split salt identifier does not match the golden fixture");
    }
  } else if (
    !process.env.CYCLE_BENCHMARK_SPLIT_SALT ||
    process.env.CYCLE_BENCHMARK_SPLIT_SALT.length < 16 ||
    process.env.CYCLE_BENCHMARK_SPLIT_SALT_ID !== rawManifest.split.saltId
  ) {
    throw new Error(
      "CYCLE_BENCHMARK_SPLIT_SALT and CYCLE_BENCHMARK_SPLIT_SALT_ID must match the D-013 manifest",
    );
  }

  const manifestSha256 = sha256(manifestBytes);
  if (options.partition === "evaluation") {
    // ponytail: this local receipt blocks repeat runs in this checkout; a shared D-013 ledger is needed across clones.
    recordEvaluationOpening({
      directory: options.evaluationReceiptDirectory ?? EVALUATION_OPENINGS_DIR,
      protocolVersion: rawManifest.protocolVersion,
      datasetSha256: rawManifest.datasetSha256,
      manifestSha256,
    });
  }

  const datasetBytes = readFileSync(options.datasetPath);
  if (sha256(datasetBytes).toLowerCase() !== rawManifest.datasetSha256.toLowerCase()) {
    throw new Error("Benchmark dataset checksum does not match its manifest");
  }
  let rawDataset: unknown;
  try {
    rawDataset = JSON.parse(datasetBytes.toString("utf8"));
  } catch {
    throw new Error("Benchmark data file is not valid JSON");
  }
  validateCycleBenchmarkDataset(rawDataset);
  if (rawManifest.datasetClass !== "synthetic") {
    const sourceFields = new Set<string>();
    let outcomeCount = 0;
    for (const user of rawDataset.users) {
      sourceFields.add("userKey");
      sourceFields.add("timezone");
      sourceFields.add("configuredCycleLength");
      for (const event of user.events) {
        for (const field of Object.keys(event)) sourceFields.add(field);
      }
      for (const segment of user.segments) {
        for (const field of Object.keys(segment)) sourceFields.add(field);
      }
      outcomeCount += new Set(user.events.map((event) => event.eventKey)).size;
    }
    if (
      !rawManifest.source ||
      rawManifest.source.userCount !== rawDataset.users.length ||
      rawManifest.source.outcomeCount !== outcomeCount ||
      rawManifest.source.fieldsUsed.length !== sourceFields.size ||
      rawManifest.source.fieldsUsed.some((field) => !sourceFields.has(field))
    ) {
      throw new Error("D-013 source field and count metadata does not match the dataset");
    }
  }
  return {
    dataset: rawDataset,
    manifest: rawManifest,
    manifestSha256,
  };
}

type CliOptions = {
  dataset?: string;
  manifest?: string;
  partition: CycleBenchmarkPartition;
  isGoldenFixture: boolean;
};

function parseCliOptions(argv: readonly string[]): CliOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--") || !argv[index + 1] || argv[index + 1].startsWith("--")) {
      throw new Error("Benchmark arguments must use --name value pairs");
    }
    if (!["--dataset", "--manifest", "--partition"].includes(argument)) {
      throw new Error("Benchmark argument is not supported");
    }
    if (values.has(argument)) throw new Error("Benchmark argument is duplicated");
    values.set(argument, argv[++index]);
  }
  const partition = values.get("--partition") ?? "development";
  if (!(["development", "calibration", "evaluation"] as const).includes(partition as CycleBenchmarkPartition)) {
    throw new Error("Benchmark partition is invalid");
  }
  const dataset = values.get("--dataset");
  const isGoldenFixture = dataset === "fixtures";
  if (isGoldenFixture && values.has("--manifest")) {
    throw new Error("Golden fixture manifest is fixed and cannot be overridden");
  }
  if (!dataset) throw new Error("Real benchmark data requires --dataset and an explicit D-013 --manifest");
  if (!isGoldenFixture && !values.has("--manifest")) {
    throw new Error("Real benchmark data requires an explicit D-013 --manifest");
  }
  return {
    dataset,
    manifest: values.get("--manifest"),
    partition: partition as CycleBenchmarkPartition,
    isGoldenFixture,
  };
}

function runCli(): void {
  const options = parseCliOptions(process.argv.slice(2));
  let sourceCommit = "unknown";
  let sourceTreeState: "clean" | "dirty" = "dirty";
  try {
    sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    sourceTreeState = execFileSync("git", ["status", "--porcelain"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
      ? "dirty"
      : "clean";
  } catch {
    // Missing Git metadata is recorded as unknown for synthetic runs.
  }
  if (!options.isGoldenFixture && (sourceCommit === "unknown" || sourceTreeState !== "clean")) {
    throw new Error("Real benchmark data requires a committed, clean source tree");
  }
  const datasetPath = options.isGoldenFixture
    ? resolve(REPO_ROOT, GOLDEN_DATASET, "data.json")
    : resolve(options.dataset as string);
  const manifestPath = options.manifest ? resolve(options.manifest) : undefined;
  const loaded = loadCycleBenchmarkFiles({
    datasetPath,
    manifestPath,
    partition: options.partition,
    isGoldenFixture: options.isGoldenFixture,
  });
  const salt =
    loaded.manifest.datasetClass === "synthetic"
      ? GOLDEN_SALT
      : process.env.CYCLE_BENCHMARK_SPLIT_SALT;
  if (!salt) throw new Error("D-013 benchmark split salt is unavailable");
  const protocolPath = resolve(REPO_ROOT, "docs/research/cycle-benchmark-protocol.md");
  const report = runCycleBenchmark({
    dataset: loaded.dataset,
    manifest: loaded.manifest,
    partition: options.partition,
    splitSalt: salt,
    manifestSha256: loaded.manifestSha256,
    sourceCommit,
    sourceTreeState,
    protocolSha256: sha256(readFileSync(protocolPath)),
  });
  process.stdout.write(`${JSON.stringify(report)}\n`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === resolve(fileURLToPath(import.meta.url))) {
  try {
    runCli();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown benchmark failure";
    process.stderr.write(`cycle benchmark: ${message}\n`);
    process.exitCode = 1;
  }
}
