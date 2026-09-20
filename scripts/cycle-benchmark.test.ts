// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { addCalendarDays } from "../convex/_helpers/cycleCalculations";
import {
  CYCLE_BENCHMARK_DATA_VERSION,
  deriveCycleBenchmarkPromotionVerdict,
  loadCycleBenchmarkFiles,
  runCycleBenchmark,
  validateCycleBenchmarkDataset,
  type CycleBenchmarkDataset,
  type CycleBenchmarkReport,
  type CycleBenchmarkUser,
} from "./cycle-benchmark";
import {
  assignCycleBenchmarkPartition,
  CYCLE_BENCHMARK_PROTOCOL_VERSION,
  CYCLE_BENCHMARK_SPLIT_VERSION,
  type CycleBenchmarkManifest,
} from "./cycle-benchmark-manifest";

const TEST_SALT = "cycle-benchmark-test-salt-123456";
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function timestamp(date: string, hour = 12): number {
  return Date.parse(`${date}T${String(hour).padStart(2, "0")}:00:00Z`);
}

function event(
  eventKey: string,
  startDate: string,
  createdAt = timestamp(startDate),
): CycleBenchmarkUser["events"][number] {
  return {
    eventKey,
    startDate,
    startCertainty: "exact",
    source: "self",
    confirmationStatus: "confirmed",
    authorityVersion: 1,
    createdAt,
    updatedAt: createdAt,
  };
}

function userKeyForPartition(
  partition: "development" | "calibration" | "evaluation",
): string {
  for (let index = 0; index < 10_000; index += 1) {
    const candidate = `synthetic-test-user-${index}`;
    if (assignCycleBenchmarkPartition(candidate, TEST_SALT) === partition) {
      return candidate;
    }
  }
  throw new Error(`Could not construct a ${partition} split test key`);
}

function userKeyForDevelopment(): string {
  return userKeyForPartition("development");
}

function regularCycleUser(
  userKey: string,
  eventCount = 45,
  cycleLength = 28,
): CycleBenchmarkUser {
  const events: CycleBenchmarkUser["events"] = [];
  let startDate = "2020-01-01";
  for (let index = 0; index < eventCount; index += 1) {
    events.push(event(`period-${index}`, startDate));
    startDate = addCalendarDays(startDate, cycleLength);
  }
  return {
    userKey,
    timezone: "UTC",
    configuredCycleLength: 28,
    events,
    segments: [],
  };
}

function manifest(): CycleBenchmarkManifest {
  return {
    manifestId: "synthetic-test-manifest-v1",
    protocolVersion: CYCLE_BENCHMARK_PROTOCOL_VERSION,
    datasetClass: "synthetic",
    datasetSha256: "a".repeat(64),
    split: {
      version: CYCLE_BENCHMARK_SPLIT_VERSION,
      saltId: "test-only",
      allocation: { development: 60, calibration: 20, evaluation: 20 },
    },
    synthetic: {
      fixtureId: "g3-bench-golden-v1",
      containsRealUserData: false,
    },
  };
}

function reportFor(
  user: CycleBenchmarkUser,
  configuredCycleLength = user.configuredCycleLength,
): CycleBenchmarkReport {
  const adjustedUser = { ...user, configuredCycleLength };
  const dataset: CycleBenchmarkDataset = {
    formatVersion: CYCLE_BENCHMARK_DATA_VERSION,
    users: [adjustedUser],
  };
  return runCycleBenchmark({
    dataset,
    manifest: manifest(),
    partition: "development",
    splitSalt: TEST_SALT,
    manifestSha256: "b".repeat(64),
    sourceCommit: "test-commit",
    sourceTreeState: "clean",
    protocolSha256: "c".repeat(64),
  });
}

function candidate(report: CycleBenchmarkReport, id: string) {
  const result = report.estimators.find((item) => item.estimatorId === id);
  if (!result) throw new Error(`Missing candidate: ${id}`);
  return result;
}

function subgroupCount(
  report: CycleBenchmarkReport,
  dimension: string,
  group: string,
): number {
  const result = report.subgroups.find(
    (item) => item.dimension === dimension && item.group === group,
  );
  if (!result) throw new Error(`Missing subgroup: ${dimension}/${group}`);
  return result.estimators.find((item) => item.estimatorId === "all_median_v1")
    ?.outcomeCount ?? 0;
}

type PromotionTestMetric = Parameters<
  typeof deriveCycleBenchmarkPromotionVerdict
>[0]["estimators"][number];

function promotionMetric(
  estimatorId: PromotionTestMetric["estimatorId"],
  overrides: Partial<PromotionTestMetric> = {},
): PromotionTestMetric {
  const difference = {
    mean: -0.3,
    median: -0.3,
    bootstrap95Ci: { lower: -0.5, upper: -0.1 },
  };
  return {
    estimatorId,
    outcomeCount: 1_000,
    meanAbsoluteErrorDays: 1.5,
    medianAbsoluteErrorDays: 1.5,
    within3DayRate: 0.9,
    pairedAbsoluteErrorDifferenceDays:
      estimatorId === "all_mean_v1"
        ? { configured_v1: difference, all_median_v1: difference }
        : { configured_v1: null, all_median_v1: null },
    predictionCalibration: {
      interval80CoverageRate: 0.8,
      medianWindow80Days: 7,
    },
    ...overrides,
  };
}

describe("cycle benchmark runner", () => {
  test("loads and scores only the checked-in synthetic golden development partition", () => {
    const loaded = loadCycleBenchmarkFiles({
      datasetPath: resolve(repoRoot, "fixtures/cycle-benchmark/data.json"),
      partition: "development",
      isGoldenFixture: true,
    });
    const report = runCycleBenchmark({
      dataset: loaded.dataset,
      manifest: loaded.manifest,
      partition: "development",
      splitSalt: "g3-golden-only-split-salt-v1",
      manifestSha256: loaded.manifestSha256,
      sourceCommit: "test-commit",
      sourceTreeState: "clean",
      protocolSha256: "c".repeat(64),
    });
    const output = JSON.stringify(report);
    expect(report.datasetClass).toBe("synthetic");
    expect(report.userCount).toBeGreaterThan(0);
    expect(report.outcomeCount).toBeGreaterThan(0);
    expect(report.promotionVerdict).toEqual({
      status: "synthetic_not_evidence",
      candidates: [],
      reason: "Synthetic benchmark outcomes cannot establish promotion evidence",
      recommendedEstimatorId: null,
      manualGates: [],
    });
    expect(report.metricImplementationVersion).toBe("cycle-benchmark-metrics-v3");
    expect(report.calibration.source).toBe("none");
    expect(report.calibration.empiricalTargetCoverageLevel).toBeNull();
    expect(report.pairedBootstrapVersion).toBe("user-cluster-percentile-95-2000-v1");
    expect(subgroupCount(report, "possibleMissingLog", "yes")).toBeGreaterThan(0);
    expect(subgroupCount(report, "variability", "high")).toBeGreaterThan(0);
    expect(subgroupCount(report, "partnerAssisted", "yes")).toBeGreaterThan(0);
    expect(subgroupCount(report, "segmentBoundary", "yes")).toBeGreaterThan(0);
    expect(subgroupCount(report, "recentCorrection", "yes")).toBeGreaterThan(0);
    expect(subgroupCount(report, "approximateLegacyAdjacent", "yes")).toBeGreaterThan(0);
    expect(
      report.subgroups.find(
        (item) => item.dimension === "segmentBoundary" && item.group === "yes",
      )?.targetCount,
    ).toBe(1);
    expect(output).not.toContain("synthetic-user-");
    expect(output).not.toContain("startDate");
    expect(output).not.toContain("eventKey");
    const bootstrapCi = candidate(report, "last3_mean_v1")
      .pairedAbsoluteErrorDifferenceDays.configured_v1?.bootstrap95Ci;
    expect(bootstrapCi).not.toBeNull();
    const repeated = runCycleBenchmark({
      dataset: loaded.dataset,
      manifest: loaded.manifest,
      partition: "development",
      splitSalt: "g3-golden-only-split-salt-v1",
      manifestSha256: loaded.manifestSha256,
      sourceCommit: "test-commit",
      sourceTreeState: "clean",
      protocolSha256: "c".repeat(64),
    });
    expect(
      candidate(repeated, "last3_mean_v1").pairedAbsoluteErrorDifferenceDays
        .configured_v1?.bootstrap95Ci,
    ).toEqual(bootstrapCi);
  });

  test("does not back-propagate a correction recorded after the prediction cutoff", () => {
    const key = userKeyForDevelopment();
    const prior = event("period-3", "2020-02-26");
    const futureCorrection = {
      ...prior,
      startDate: "2020-02-27",
      updatedAt: timestamp("2020-03-28"),
      authorityVersion: 2,
      primaryCorrectionVersion: 1,
    };
    const user: CycleBenchmarkUser = {
      userKey: key,
      timezone: "UTC",
      configuredCycleLength: 28,
      events: [
        event("period-1", "2020-01-01"),
        event("period-2", "2020-01-29"),
        prior,
        futureCorrection,
        event("period-4", "2020-03-27"),
      ],
      segments: [],
    };
    const asOfReport = reportFor(user);
    const intentionallyLeakyReport = reportFor({
      ...user,
      events: user.events.map((item) =>
        item.eventKey === "period-3" && item.authorityVersion === 2
          ? { ...item, updatedAt: timestamp("2020-03-26") }
          : item,
      ),
    });

    expect(asOfReport.outcomeCount).toBe(2);
    expect(candidate(asOfReport, "all_median_v1").meanAbsoluteErrorDays).toBe(1);
    expect(candidate(intentionallyLeakyReport, "all_median_v1").meanAbsoluteErrorDays).toBe(0);
  });

  test("does not classify ordinary period completion as a recent correction", () => {
    const user = regularCycleUser(userKeyForDevelopment());
    const completedBeforeCutoff = user.events[0];
    user.events[0] = {
      ...completedBeforeCutoff,
      updatedAt: timestamp("2020-02-01"),
      authorityVersion: 2,
    };

    const report = reportFor(user);

    expect(subgroupCount(report, "recentCorrection", "yes")).toBe(0);
  });

  test(
    "recognizes a partner correction without treating version increments as corrections",
    () => {
      const user = regularCycleUser(userKeyForDevelopment());
      const correctedBeforeCutoff = user.events[0];
      user.events[0] = {
        ...correctedBeforeCutoff,
        updatedAt: timestamp("2020-02-01"),
        authorityVersion: 2,
        partnerCorrectionVersion: 2,
      };

      const report = reportFor(user);

      expect(subgroupCount(report, "recentCorrection", "yes")).toBeGreaterThan(0);
    },
  );

  test("uses local calendar cutoffs across daylight saving time", () => {
    const user: CycleBenchmarkUser = {
      userKey: userKeyForDevelopment(),
      timezone: "America/Los_Angeles",
      configuredCycleLength: 28,
      events: [
        event("period-1", "2021-02-06", timestamp("2021-02-06", 20)),
        event("period-2", "2021-03-06", timestamp("2021-03-06", 20)),
        event("period-3", "2021-04-03", timestamp("2021-04-03", 20)),
        event("period-4", "2021-05-01", timestamp("2021-05-01", 20)),
      ],
      segments: [],
    };
    const report = reportFor(user);
    expect(candidate(report, "all_median_v1").meanAbsoluteErrorDays).toBe(0);
  });

  test("fits intervals from calibration users and sizes a target before its outcome", () => {
    const calibrationUser = regularCycleUser(
      userKeyForPartition("calibration"),
      45,
      30,
    );
    const evaluationUser = regularCycleUser(userKeyForPartition("evaluation"));
    evaluationUser.segments.push({
      segmentKey: "existing-segment",
      startDate: "2020-01-01",
      status: "active",
      createdAt: timestamp("2020-01-01"),
    });
    const dataset: CycleBenchmarkDataset = {
      formatVersion: CYCLE_BENCHMARK_DATA_VERSION,
      users: [calibrationUser, evaluationUser],
    };
    const evaluationManifest = {
      ...manifest(),
      developmentCutoffs: {
        variabilityMadQ33: 1,
        variabilityMadQ67: 3,
        medianIntervalQ33: 27,
        medianIntervalQ67: 29,
      },
    };
    const run = (users: CycleBenchmarkUser[]) =>
      runCycleBenchmark({
        dataset: { ...dataset, users },
        manifest: evaluationManifest,
        partition: "evaluation",
        splitSalt: TEST_SALT,
        manifestSha256: "b".repeat(64),
        sourceCommit: "test-commit",
        sourceTreeState: "clean",
        protocolSha256: "c".repeat(64),
      });
    const report = run(dataset.users);
    const finalEvent = evaluationUser.events.at(-1)!;
    const changedTargetDate = addCalendarDays(finalEvent.startDate, 56);
    const shiftedUser = {
      ...evaluationUser,
      events: evaluationUser.events.map((item) =>
        item.eventKey === finalEvent.eventKey
          ? {
              ...item,
              startDate: changedTargetDate,
              createdAt: timestamp(changedTargetDate),
              updatedAt: timestamp(changedTargetDate),
              primaryCorrectionVersion: 1,
            }
          : item,
      ),
      segments: [
        ...evaluationUser.segments,
        {
          segmentKey: "future-segment",
          startDate: changedTargetDate,
          status: "active" as const,
          createdAt: timestamp(changedTargetDate),
        },
      ],
    };
    const changedOutcome = run([calibrationUser, shiftedUser]);
    const baseMetrics = candidate(report, "configured_v1").predictionCalibration;
    const changedMetrics = candidate(changedOutcome, "configured_v1").predictionCalibration;

    expect(report.calibration.source).toBe("calibration_partition");
    expect(report.calibration.fitOutcomeCount).toBeGreaterThanOrEqual(20);
    expect(report.calibration.empiricalTargetCoverageLevel).toBeNull();
    const calibrationSourceSubgroup = (source: string) =>
      report.subgroups.find(
        (item) =>
          item.dimension === "calibrationSource" &&
          item.group === source,
      );
    expect(
      calibrationSourceSubgroup("calibration_partition")?.targetCount,
    ).toBeGreaterThan(0);
    expect(
      calibrationSourceSubgroup("calibration_and_personal")?.targetCount,
    ).toBeGreaterThan(0);
    expect(
      calibrationSourceSubgroup("calibration_and_personal")?.estimators.map(
        (item) => item.estimatorId,
      ),
    ).toEqual(expect.arrayContaining(["configured_v1", "all_median_v1"]));
    expect(baseMetrics).not.toBeNull();
    expect(changedMetrics).not.toBeNull();
    expect(baseMetrics!.medianWindow80Days).toBeGreaterThan(0);
    expect(changedMetrics!.medianWindow80Days).toBe(baseMetrics!.medianWindow80Days);
    expect(subgroupCount(changedOutcome, "possibleMissingLog", "yes")).toBeGreaterThan(0);
    expect(subgroupCount(changedOutcome, "recentCorrection", "yes")).toBeGreaterThan(0);
    expect(subgroupCount(changedOutcome, "segmentBoundary", "yes")).toBeGreaterThan(0);
    expect(changedMetrics!.reasonCodeCounts.POSSIBLE_MISSING_LOG ?? 0).toBe(0);
    expect(changedMetrics!.reasonCodeCounts.RECENT_CORRECTION ?? 0).toBe(0);
    expect(changedMetrics!.reasonCodeCounts.CONTEXT_BOUNDARY ?? 0).toBe(
      baseMetrics!.reasonCodeCounts.CONTEXT_BOUNDARY ?? 0,
    );
    expect(changedMetrics!.interval80CoverageRate).toBeLessThan(
      baseMetrics!.interval80CoverageRate,
    );
  });

  test("scores promotion criteria while retaining required manual gates", () => {
    const configured = promotionMetric("configured_v1", {
      meanAbsoluteErrorDays: 2,
      medianAbsoluteErrorDays: 2,
      within3DayRate: 0.85,
    });
    const rollingMedian = promotionMetric("all_median_v1", {
      meanAbsoluteErrorDays: 1.8,
      medianAbsoluteErrorDays: 1.8,
      within3DayRate: 0.86,
    });
    const candidate = promotionMetric("all_mean_v1");
    const narrowerCandidate = promotionMetric("last3_mean_v1", {
      pairedAbsoluteErrorDifferenceDays:
        candidate.pairedAbsoluteErrorDifferenceDays,
      predictionCalibration: {
        interval80CoverageRate: 0.8,
        medianWindow80Days: 5,
      },
    });
    const verdict = deriveCycleBenchmarkPromotionVerdict({
      datasetClass: "external_academic",
      partition: "evaluation",
      estimators: [configured, rollingMedian, candidate, narrowerCandidate],
      subgroups: [],
    });
    expect(verdict).toEqual({
      status: "metrics_pass_manual_gates_pending",
      candidates: [
        {
          estimatorId: "all_median_v1",
          passed: false,
          failedCriteria: [
            "paired_improvement_vs_configured_v1",
            "paired_improvement_vs_all_median_v1",
          ],
        },
        { estimatorId: "all_mean_v1", passed: true, failedCriteria: [] },
        { estimatorId: "last3_mean_v1", passed: true, failedCriteria: [] },
      ],
      reason:
        "Metric criteria pass; independent quality, snapshot, leakage, and approval gates remain",
      recommendedEstimatorId: "last3_mean_v1",
      manualGates: [
        "variability_quality_monotonicity",
        "snapshot_input_cutoff_and_leakage_audits",
        "named_model_promotion_approval",
      ],
    });

    const regressed = deriveCycleBenchmarkPromotionVerdict({
      datasetClass: "external_academic",
      partition: "evaluation",
      estimators: [configured, rollingMedian, candidate, narrowerCandidate],
      subgroups: [
        {
          dimension: "variability",
          group: "high",
          outcomeCount: 200,
          estimators: [
            configured,
            rollingMedian,
            promotionMetric("all_mean_v1", {
              meanAbsoluteErrorDays: 3,
              within3DayRate: 0.8,
            }),
          ],
        },
      ],
    });
    expect(
      regressed.candidates.find((item) => item.estimatorId === "all_mean_v1")
        ?.failedCriteria,
    ).toContain("subgroup:variability:high:mae_regression_over_0.5");
  });

  test("rounds a fractional configured interval half-up only when producing a calendar date", () => {
    const user: CycleBenchmarkUser = {
      userKey: userKeyForDevelopment(),
      timezone: "UTC",
      configuredCycleLength: 28.5,
      events: [event("period-1", "2023-01-01"), event("period-2", "2023-01-30")],
      segments: [],
    };
    const report = reportFor(user);
    expect(candidate(report, "configured_v1").meanAbsoluteErrorDays).toBe(0);
  });

  test("rejects data fields outside the privacy-safe benchmark schema", () => {
    const dataset = JSON.parse(
      readFileSync(resolve(repoRoot, "fixtures/cycle-benchmark/data.json"), "utf8"),
    ) as Record<string, unknown>;
    const users = dataset.users as Array<Record<string, unknown>>;
    const firstUser = users[0];
    const events = firstUser.events as Array<Record<string, unknown>>;
    events[0].painScore = 7;
    expect(() => validateCycleBenchmarkDataset(dataset)).toThrow(
      "Benchmark event contains an unsupported field",
    );
  });
});
