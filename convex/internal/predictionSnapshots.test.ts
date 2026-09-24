import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { internal, api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";

type TestBackend = ReturnType<typeof convexTest>;

async function withScheduledFunctions<T>(
  t: TestBackend,
  action: () => Promise<T>,
) {
  vi.useFakeTimers();
  try {
    const result = await action();
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    return result;
  } finally {
    vi.useRealTimers();
  }
}

const inputCutoffAt = Date.UTC(2026, 0, 15, 12);
const generatedAt = inputCutoffAt + 1_000;
const outcomeCreatedAt = Date.UTC(2026, 0, 20, 12);

beforeEach(() => {
  vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
  vi.stubEnv("CB_CONNECT_PERIOD_PREDICTION_V2", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function seedPredictionContext(
  t: TestBackend,
  userId: Id<"users">
) {
  return await t.run(async (ctx) => {
    await ctx.db.insert("periodEvents", {
      userId,
      startDate: "2026-01-01",
      endDate: "2026-01-05",
      startCertainty: "exact",
      endCertainty: "exact",
      authorityVersion: 1,
      createdAt: Date.UTC(2026, 0, 1),
      updatedAt: Date.UTC(2026, 0, 1),
    });
    const predictionSegmentId = await ctx.db.insert(
      "cyclePredictionSegments",
      {
        userId,
        startDate: "2026-01-01",
        status: "active",
        createdAt: Date.UTC(2026, 0, 1),
      }
    );
    return { predictionSegmentId };
  });
}

function snapshotArgs(
  userId: Id<"users">,
  predictionSegmentId: Id<"cyclePredictionSegments">
) {
  const reasonCodes: (
    | "LIMITED_HISTORY"
    | "INSUFFICIENT_CALIBRATION"
  )[] = ["LIMITED_HISTORY", "INSUFFICIENT_CALIBRATION"];
  return {
    userId,
    generatedAt,
    inputCutoffAt,
    inputCutoffDate: "2026-01-15",
    status: "limited_evidence" as const,
    estimatorId: "cycle-interval",
    estimatorVersion: 2,
    intervalMethodVersion: "cycle_intervals_v1",
    calibrationVersion: "empirical-residual-quantiles-v1",
    pointDate: "2026-01-30",
    earliestDate: "2026-01-29",
    latestDate: "2026-01-31",
    probabilityLabel: null,
    quality: "limited_evidence" as const,
    qualityScoreV1: null,
    basisCount: 2,
    reasonCodes,
    displayStatus: "shadow" as const,
    predictionSegmentId,
    featureVersion: "period_prediction_v2",
    contractVersion: 2,
  };
}

async function seedOutcomeEvent(
  t: TestBackend,
  userId: Id<"users">,
  startDate = "2026-01-30",
  endDate?: string,
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("periodEvents", {
      userId,
      startDate,
      ...(endDate ? { endDate, endCertainty: "exact" as const } : {}),
      startCertainty: "exact",
      authorityVersion: 1,
      createdAt: outcomeCreatedAt,
      updatedAt: outcomeCreatedAt,
    })
  );
}

describe("immutable prediction snapshots", () => {
  test("records an outcome, then appends supersession when the primary corrects it", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    const { predictionSegmentId } = await seedPredictionContext(t, primaryId);
    const args = snapshotArgs(primaryId, predictionSegmentId);

    await expect(
      t.mutation(internal.internal.predictionSnapshots.createSnapshot, {
        ...args,
        earliestDate: "2026-01-31",
      })
    ).rejects.toThrow("PREDICTION_SNAPSHOT_INVALID_WINDOW");

    const { snapshotId } = await t.mutation(
      internal.internal.predictionSnapshots.createSnapshot,
      args
    );
    const beforeAssessment = await t.run(async (ctx) =>
      ctx.db.get("predictionSnapshots", snapshotId)
    );
    const periodEventId = await seedOutcomeEvent(t, primaryId);
    const outcome = await t.mutation(
      internal.internal.predictionSnapshots.recordOutcome,
      { snapshotId, sourcePeriodEventId: periodEventId }
    );
    expect(outcome).toEqual({
      assessmentId: expect.any(String),
      signedErrorDays: 0,
      absoluteErrorDays: 0,
      insideWindow: true,
    });
    await expect(
      t.mutation(internal.internal.predictionSnapshots.recordOutcome, {
        snapshotId,
        sourcePeriodEventId: periodEventId,
      })
    ).rejects.toThrow("PREDICTION_SNAPSHOT_ALREADY_ASSESSED");

    await asPrimary.mutation(api.mutations.periods.updatePeriodEvent, {
      periodEventId,
      startDate: "2026-01-31",
      startCertainty: "exact",
      timeZone: "UTC",
      expectedAuthorityVersion: 1,
    });

    const [
      afterCorrection,
      outcomeAssessments,
      supersessions,
      futureIntervals,
    ] = await Promise.all([
      t.run(async (ctx) => ctx.db.get("predictionSnapshots", snapshotId)),
      t.run(async (ctx) =>
        ctx.db
          .query("predictionSnapshotAssessments")
          .withIndex("by_snapshot_and_type", (q) =>
            q.eq("snapshotId", snapshotId).eq("type", "outcome")
          )
          .take(2)
      ),
      t.run(async (ctx) =>
        ctx.db
          .query("predictionSnapshotAssessments")
          .withIndex("by_snapshot_and_type", (q) =>
            q.eq("snapshotId", snapshotId).eq("type", "superseded")
          )
          .take(2)
      ),
      t.query(internal.queries.history.getCycleIntervalsForUser, {
        userId: primaryId,
      }),
    ]);
    expect(afterCorrection).toEqual(beforeAssessment);
    expect(outcomeAssessments).toHaveLength(1);
    expect(outcomeAssessments[0]).toMatchObject({
      type: "outcome",
      observedEligibleStartDate: "2026-01-30",
      signedErrorDays: 0,
      absoluteErrorDays: 0,
      insideWindow: true,
    });
    expect(supersessions).toHaveLength(1);
    expect(supersessions[0]).toMatchObject({
      type: "superseded",
      sourcePeriodEventId: periodEventId,
      sourceAuthorityVersion: 2,
      reason: "primary_correction",
    });
    expect(futureIntervals?.latestEligibleStartDate).toBe("2026-01-31");
  });

  test("records a new eligible outcome after the latest outcome is corrected", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    const { predictionSegmentId } = await seedPredictionContext(t, primaryId);
    const { snapshotId } = await t.mutation(
      internal.internal.predictionSnapshots.createSnapshot,
      snapshotArgs(primaryId, predictionSegmentId),
    );
    const correctedEventId = await seedOutcomeEvent(t, primaryId, "2026-01-30");
    await t.mutation(internal.internal.predictionSnapshots.recordOutcome, {
      snapshotId,
      sourcePeriodEventId: correctedEventId,
    });
    await asPrimary.mutation(api.mutations.periods.deletePeriodEvent, {
      periodEventId: correctedEventId,
      expectedAuthorityVersion: 1,
    });

    const replacementEventId = await seedOutcomeEvent(t, primaryId, "2026-01-20");
    await expect(
      t.mutation(internal.internal.predictionSnapshots.recordOutcome, {
        snapshotId,
        sourcePeriodEventId: replacementEventId,
      }),
    ).resolves.toMatchObject({ assessmentId: expect.any(String) });
  });

  test("Gate 3 does not reinstate a source deleted with Cycle Facts V1 off", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    const { predictionSegmentId } = await seedPredictionContext(t, primaryId);
    const { snapshotId } = await t.mutation(
      internal.internal.predictionSnapshots.createSnapshot,
      snapshotArgs(primaryId, predictionSegmentId),
    );
    const periodEventId = await seedOutcomeEvent(t, primaryId, "2026-01-30");
    await t.mutation(internal.internal.predictionSnapshots.recordOutcome, {
      snapshotId,
      sourcePeriodEventId: periodEventId,
    });
    vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "false");

    await withScheduledFunctions(t, () =>
      asPrimary.mutation(api.mutations.periods.deletePeriodEvent, {
        periodEventId,
        expectedAuthorityVersion: 1,
      }),
    );

    const [event, outcomes, candidates, supersessions] = await Promise.all([
      t.run(async (ctx) => ctx.db.get("periodEvents", periodEventId)),
      t.run(async (ctx) =>
        ctx.db
          .query("predictionSnapshotAssessments")
          .withIndex("by_snapshot_and_type", (q) =>
            q.eq("snapshotId", snapshotId).eq("type", "outcome"),
          )
          .take(3),
      ),
      t.run(async (ctx) =>
        ctx.db
          .query("predictionSnapshotOutcomeCandidates")
          .withIndex("by_source_event", (q) =>
            q.eq("sourcePeriodEventId", periodEventId),
          )
          .take(3),
      ),
      t.run(async (ctx) =>
        ctx.db
          .query("predictionSnapshotAssessments")
          .withIndex("by_snapshot_and_type", (q) =>
            q.eq("snapshotId", snapshotId).eq("type", "superseded"),
          )
          .take(3),
      ),
    ]);
    expect(event).toBeNull();
    expect(outcomes).toHaveLength(1);
    expect(candidates).toHaveLength(0);
    expect(supersessions).toHaveLength(1);
  });

  test.each(["correction", "deletion"] as const)(
    "keeps the earliest remaining outcome effective after an earlier start is corrected or deleted (%s)",
    async (change) => {
      const t = convexTest(schema, modules);
      const { asPrimary, primaryId } = await seedActiveCouple(t);
      const { predictionSegmentId } = await seedPredictionContext(t, primaryId);
      const { snapshotId } = await t.mutation(
        internal.internal.predictionSnapshots.createSnapshot,
        snapshotArgs(primaryId, predictionSegmentId),
      );
      const laterEventId = await seedOutcomeEvent(t, primaryId, "2026-02-20", "2026-02-24");
      const earlierEventId = await seedOutcomeEvent(t, primaryId, "2026-01-23", "2026-01-27");

      await t.mutation(internal.internal.predictionSnapshots.recordOutcome, {
        snapshotId,
        sourcePeriodEventId: laterEventId,
      });
      await t.mutation(internal.internal.predictionSnapshots.recordOutcome, {
        snapshotId,
        sourcePeriodEventId: earlierEventId,
      });

      await withScheduledFunctions(t, () =>
        change === "deletion"
          ? asPrimary.mutation(api.mutations.periods.deletePeriodEvent, {
              periodEventId: earlierEventId,
              expectedAuthorityVersion: 1,
            })
          : asPrimary.mutation(api.mutations.periods.updatePeriodEvent, {
              periodEventId: earlierEventId,
              startDate: "2026-02-25",
              endDate: "2026-02-27",
              startCertainty: "exact",
              endCertainty: "exact",
              timeZone: "UTC",
              expectedAuthorityVersion: 1,
            }),
      );

      const newerEventId = await seedOutcomeEvent(t, primaryId, "2026-03-20");
      await expect(
        t.mutation(internal.internal.predictionSnapshots.recordOutcome, {
          snapshotId,
          sourcePeriodEventId: newerEventId,
        }),
      ).rejects.toThrow("PREDICTION_SNAPSHOT_ALREADY_ASSESSED");

      const [outcomes, supersessions] = await Promise.all([
        t.run(async (ctx) =>
          ctx.db
            .query("predictionSnapshotAssessments")
            .withIndex("by_snapshot_and_type", (q) =>
              q.eq("snapshotId", snapshotId).eq("type", "outcome"),
            )
            .take(3),
        ),
        t.run(async (ctx) =>
          ctx.db
            .query("predictionSnapshotAssessments")
            .withIndex("by_snapshot_and_type", (q) =>
              q.eq("snapshotId", snapshotId).eq("type", "superseded"),
            )
            .take(3),
        ),
      ]);
      expect(outcomes.map((item) => item.sourcePeriodEventId)).toEqual([
        laterEventId,
        earlierEventId,
        laterEventId,
      ]);
      expect(outcomes[2]).toMatchObject({ reason: "outcome_reinstated" });
      expect(supersessions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourcePeriodEventId: laterEventId,
            reason: "earlier_eligible_start_discovered",
          }),
          expect.objectContaining({
            sourcePeriodEventId: earlierEventId,
            reason: "primary_correction",
          }),
        ]),
      );
    },
  );

  test.each(["correction", "deletion"] as const)(
    "reinstates a later scheduled outcome when the earlier scheduled outcome is invalidated (%s)",
    async (change) => {
      const t = convexTest(schema, modules);
      const { asPrimary, primaryId } = await seedActiveCouple(t);
      const { predictionSegmentId } = await seedPredictionContext(t, primaryId);
      const { snapshotId } = await t.mutation(
        internal.internal.predictionSnapshots.createSnapshot,
        snapshotArgs(primaryId, predictionSegmentId),
      );
      const earlierEventId = await seedOutcomeEvent(
        t,
        primaryId,
        "2026-01-23",
        "2026-01-27",
      );
      const laterEventId = await seedOutcomeEvent(
        t,
        primaryId,
        "2026-02-20",
        "2026-02-24",
      );

      await t.mutation(
        internal.internal.predictionSnapshots.recordOutcomesForStart,
        { sourcePeriodEventId: earlierEventId },
      );
      await t.mutation(
        internal.internal.predictionSnapshots.recordOutcomesForStart,
        { sourcePeriodEventId: laterEventId },
      );

      await withScheduledFunctions(t, () =>
        change === "deletion"
          ? asPrimary.mutation(api.mutations.periods.deletePeriodEvent, {
              periodEventId: earlierEventId,
              expectedAuthorityVersion: 1,
            })
          : asPrimary.mutation(api.mutations.periods.updatePeriodEvent, {
              periodEventId: earlierEventId,
              startDate: "2026-02-25",
              endDate: "2026-02-27",
              startCertainty: "exact",
              endCertainty: "exact",
              timeZone: "UTC",
              expectedAuthorityVersion: 1,
            }),
      );

      const outcomes = await t.run(async (ctx) =>
        ctx.db
          .query("predictionSnapshotAssessments")
          .withIndex("by_snapshot_and_type", (q) =>
            q.eq("snapshotId", snapshotId).eq("type", "outcome"),
          )
          .take(3),
      );
      expect(outcomes.map((outcome) => outcome.sourcePeriodEventId)).toEqual([
        earlierEventId,
        laterEventId,
      ]);
      expect(outcomes[1]).toMatchObject({ reason: "outcome_reinstated" });
    },
  );

  test("records an outcome after ordinary period-end completion", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    const { predictionSegmentId } = await seedPredictionContext(t, primaryId);
    const { snapshotId } = await t.mutation(
      internal.internal.predictionSnapshots.createSnapshot,
      snapshotArgs(primaryId, predictionSegmentId)
    );
    const periodEventId = await seedOutcomeEvent(t, primaryId);

    await asPrimary.mutation(api.mutations.periods.logPeriodEnd, {
      endDate: "2026-02-03",
      endCertainty: "exact",
      timeZone: "UTC",
      periodEventId,
      expectedAuthorityVersion: 1,
    });

    const event = await t.run(async (ctx) =>
      ctx.db.get("periodEvents", periodEventId)
    );
    expect(event?.updatedAt).not.toBe(event?.createdAt);
    expect(event?.primaryCorrectionVersion).toBeUndefined();
    await expect(
      t.mutation(internal.internal.predictionSnapshots.recordOutcome, {
        snapshotId,
        sourcePeriodEventId: periodEventId,
      })
    ).resolves.toMatchObject({
      signedErrorDays: 0,
      absoluteErrorDays: 0,
      insideWindow: true,
    });
  });

  test("signed outcome error is observed start minus predicted point", async () => {
    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    const { predictionSegmentId } = await seedPredictionContext(t, primaryId);
    const { snapshotId } = await t.mutation(
      internal.internal.predictionSnapshots.createSnapshot,
      snapshotArgs(primaryId, predictionSegmentId),
    );
    const periodEventId = await seedOutcomeEvent(t, primaryId, "2026-02-01");

    await expect(
      t.mutation(internal.internal.predictionSnapshots.recordOutcome, {
        snapshotId,
        sourcePeriodEventId: periodEventId,
      }),
    ).resolves.toMatchObject({
      signedErrorDays: 2,
      absoluteErrorDays: 2,
      insideWindow: false,
    });
  });

  test("a primary end-only correction keeps the start outcome valid", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    const { predictionSegmentId } = await seedPredictionContext(t, primaryId);
    const { snapshotId } = await t.mutation(
      internal.internal.predictionSnapshots.createSnapshot,
      snapshotArgs(primaryId, predictionSegmentId),
    );
    const periodEventId = await seedOutcomeEvent(t, primaryId);
    await t.mutation(internal.internal.predictionSnapshots.recordOutcome, {
      snapshotId,
      sourcePeriodEventId: periodEventId,
    });

    await asPrimary.mutation(api.mutations.periods.updatePeriodEvent, {
      periodEventId,
      startDate: "2026-01-30",
      endDate: "2026-02-02",
      endCertainty: "exact",
      timeZone: "UTC",
      expectedAuthorityVersion: 1,
    });

    const [event, supersessions] = await Promise.all([
      t.run(async (ctx) => ctx.db.get("periodEvents", periodEventId)),
      t.run(async (ctx) =>
        ctx.db
          .query("predictionSnapshotAssessments")
          .withIndex("by_snapshot_and_type", (q) =>
            q.eq("snapshotId", snapshotId).eq("type", "superseded"),
          )
          .take(2),
      ),
    ]);
    expect(event?.primaryCorrectionVersion).toBeUndefined();
    expect(supersessions).toHaveLength(0);
  });

  test("a partner end-only correction keeps the start outcome valid", async () => {
    const t = convexTest(schema, modules);
    const { asPartner, primaryId } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });
    const { predictionSegmentId } = await seedPredictionContext(t, primaryId);
    const { snapshotId } = await t.mutation(
      internal.internal.predictionSnapshots.createSnapshot,
      snapshotArgs(primaryId, predictionSegmentId),
    );
    const { eventId } = await asPartner.mutation(
      api.mutations.periods.assistLogPeriodStart,
      { startDate: "2026-01-30", startCertainty: "exact" },
    );
    await t.mutation(internal.internal.predictionSnapshots.recordOutcome, {
      snapshotId,
      sourcePeriodEventId: eventId,
    });

    await asPartner.mutation(
      api.mutations.periods.correctAssistedPeriodEvent,
      {
        periodEventId: eventId,
        expectedAuthorityVersion: 1,
        startDate: "2026-01-30",
        endDate: "2026-02-02",
        endCertainty: "exact",
      },
    );

    const [event, supersessions] = await Promise.all([
      t.run(async (ctx) => ctx.db.get("periodEvents", eventId)),
      t.run(async (ctx) =>
        ctx.db
          .query("predictionSnapshotAssessments")
          .withIndex("by_snapshot_and_type", (q) =>
            q.eq("snapshotId", snapshotId).eq("type", "superseded"),
          )
          .take(2),
      ),
    ]);
    expect(event?.partnerCorrectionVersion).toBeUndefined();
    expect(supersessions).toHaveLength(0);
  });

  test("a backfilled earlier start replaces a later recorded outcome", async () => {
    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    const { predictionSegmentId } = await seedPredictionContext(t, primaryId);
    const { snapshotId } = await t.mutation(
      internal.internal.predictionSnapshots.createSnapshot,
      snapshotArgs(primaryId, predictionSegmentId),
    );
    const laterId = await seedOutcomeEvent(t, primaryId, "2026-06-20");
    const earlierId = await seedOutcomeEvent(t, primaryId, "2026-06-10");
    const middleId = await seedOutcomeEvent(t, primaryId, "2026-06-15");

    await t.mutation(internal.internal.predictionSnapshots.recordOutcome, {
      snapshotId,
      sourcePeriodEventId: laterId,
    });
    await t.mutation(
      internal.internal.predictionSnapshots.recordOutcomesForStart,
      { sourcePeriodEventId: earlierId },
    );
    await t.mutation(
      internal.internal.predictionSnapshots.recordOutcomesForStart,
      { sourcePeriodEventId: middleId },
    );

    const [outcomes, supersessions, candidates] = await Promise.all([
      t.run(async (ctx) =>
        ctx.db
          .query("predictionSnapshotAssessments")
          .withIndex("by_snapshot_and_type", (q) =>
            q.eq("snapshotId", snapshotId).eq("type", "outcome"),
          )
          .take(5),
      ),
      t.run(async (ctx) =>
        ctx.db
          .query("predictionSnapshotAssessments")
          .withIndex("by_snapshot_and_type", (q) =>
            q.eq("snapshotId", snapshotId).eq("type", "superseded"),
          )
          .take(5),
      ),
      t.run(async (ctx) =>
        ctx.db
          .query("predictionSnapshotOutcomeCandidates")
          .withIndex("by_snapshot_and_status_and_observed_date", (q) =>
            q.eq("snapshotId", snapshotId).eq("status", "eligible"),
          )
          .take(5),
      ),
    ]);
    expect(
      outcomes.flatMap((item) =>
        item.type === "outcome" ? [item.observedEligibleStartDate] : [],
      ),
    ).toEqual(["2026-06-20", "2026-06-10"]);
    expect(supersessions).toMatchObject([
      {
        type: "superseded",
        sourcePeriodEventId: laterId,
        reason: "earlier_eligible_start_discovered",
      },
    ]);
    expect(candidates).toMatchObject([
      {
        sourcePeriodEventId: earlierId,
        observedEligibleStartDate: "2026-06-10",
      },
    ]);
  });

  test("a newly logged period start appends its eligible outcome to prior snapshots", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    const { predictionSegmentId } = await seedPredictionContext(t, primaryId);
    const { snapshotId } = await t.mutation(
      internal.internal.predictionSnapshots.createSnapshot,
      snapshotArgs(primaryId, predictionSegmentId),
    );
    const before = await t.run(async (ctx) => ctx.db.get("predictionSnapshots", snapshotId));

    vi.useFakeTimers();
    try {
      const { eventId } = await asPrimary.mutation(
        api.mutations.periods.logPeriodStart,
        {
          startDate: "2026-01-30",
          startCertainty: "exact",
          timeZone: "UTC",
        },
      );
      await t.finishAllScheduledFunctions(() => vi.runAllTimers());

      const [after, assessments] = await Promise.all([
        t.run(async (ctx) => ctx.db.get("predictionSnapshots", snapshotId)),
        t.run(async (ctx) =>
          ctx.db
            .query("predictionSnapshotAssessments")
            .withIndex("by_snapshot_and_type", (q) =>
              q.eq("snapshotId", snapshotId).eq("type", "outcome"),
            )
            .take(2),
        ),
      ]);
      expect(after).toEqual(before);
      expect(assessments).toHaveLength(1);
      expect(assessments[0]).toMatchObject({
        type: "outcome",
        sourcePeriodEventId: eventId,
        observedEligibleStartDate: "2026-01-30",
        signedErrorDays: 0,
        absoluteErrorDays: 0,
        insideWindow: true,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  test("a partner correction supersedes the assisted-start snapshot outcome", async () => {
    const t = convexTest(schema, modules);
    const { asPartner, primaryId } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });
    const { predictionSegmentId } = await seedPredictionContext(t, primaryId);
    const { snapshotId } = await t.mutation(
      internal.internal.predictionSnapshots.createSnapshot,
      snapshotArgs(primaryId, predictionSegmentId),
    );
    const before = await t.run(async (ctx) => ctx.db.get("predictionSnapshots", snapshotId));

    vi.useFakeTimers();
    try {
      const { eventId } = await asPartner.mutation(
        api.mutations.periods.assistLogPeriodStart,
        { startDate: "2026-01-30" },
      );
      await t.finishAllScheduledFunctions(() => vi.runAllTimers());

      await asPartner.mutation(
        api.mutations.periods.correctAssistedPeriodEvent,
        {
          periodEventId: eventId,
          expectedAuthorityVersion: 1,
          startDate: "2026-01-31",
        },
      );

      const [after, outcomes, supersessions] = await Promise.all([
        t.run(async (ctx) => ctx.db.get("predictionSnapshots", snapshotId)),
        t.run(async (ctx) =>
          ctx.db
            .query("predictionSnapshotAssessments")
            .withIndex("by_snapshot_and_type", (q) =>
              q.eq("snapshotId", snapshotId).eq("type", "outcome"),
            )
            .take(2),
        ),
        t.run(async (ctx) =>
          ctx.db
            .query("predictionSnapshotAssessments")
            .withIndex("by_snapshot_and_type", (q) =>
              q.eq("snapshotId", snapshotId).eq("type", "superseded"),
            )
            .take(2),
        ),
      ]);
      expect(after).toEqual(before);
      expect(outcomes).toHaveLength(1);
      expect(outcomes[0]).toMatchObject({
        observedEligibleStartDate: "2026-01-30",
        sourcePeriodEventId: eventId,
      });
      expect(supersessions).toHaveLength(1);
      expect(supersessions[0]).toMatchObject({
        type: "superseded",
        sourcePeriodEventId: eventId,
        sourceAuthorityVersion: 2,
        reason: "partner_correction",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  test("a partner correction before deferred outcome recording is not scored", async () => {
    const t = convexTest(schema, modules);
    const { asPartner, primaryId } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });
    const { predictionSegmentId } = await seedPredictionContext(t, primaryId);
    const { snapshotId } = await t.mutation(
      internal.internal.predictionSnapshots.createSnapshot,
      snapshotArgs(primaryId, predictionSegmentId),
    );

    vi.useFakeTimers();
    try {
      const { eventId } = await asPartner.mutation(
        api.mutations.periods.assistLogPeriodStart,
        { startDate: "2026-01-30" },
      );
      await asPartner.mutation(
        api.mutations.periods.correctAssistedPeriodEvent,
        {
          periodEventId: eventId,
          expectedAuthorityVersion: 1,
          startDate: "2026-01-31",
        },
      );

      await expect(
        t.mutation(internal.internal.predictionSnapshots.recordOutcome, {
          snapshotId,
          sourcePeriodEventId: eventId,
        }),
      ).rejects.toThrow("PREDICTION_SNAPSHOT_OUTCOME_NOT_ELIGIBLE");

      await t.finishAllScheduledFunctions(() => vi.runAllTimers());

      const assessments = await t.run(async (ctx) =>
        ctx.db
          .query("predictionSnapshotAssessments")
          .withIndex("by_snapshot_and_type", (q) =>
            q.eq("snapshotId", snapshotId).eq("type", "outcome"),
          )
          .take(2),
      );
      expect(assessments).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  test("feature-off period starts keep scoring existing snapshots without creating new ones", async () => {
    vi.stubEnv("CB_CONNECT_PERIOD_PREDICTION_V2", "false");
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    const { predictionSegmentId } = await seedPredictionContext(t, primaryId);
    const { snapshotId } = await t.mutation(
      internal.internal.predictionSnapshots.createSnapshot,
      snapshotArgs(primaryId, predictionSegmentId),
    );

    vi.useFakeTimers();
    try {
      await asPrimary.mutation(api.mutations.periods.logPeriodStart, {
        startDate: "2026-01-30",
        startCertainty: "exact",
        timeZone: "UTC",
      });
      await t.finishAllScheduledFunctions(() => vi.runAllTimers());

      const [snapshots, assessments] = await Promise.all([
        t.run(async (ctx) =>
          ctx.db
            .query("predictionSnapshots")
            .withIndex("by_user_and_generated_at", (q) => q.eq("userId", primaryId))
            .take(2),
        ),
        t.run(async (ctx) =>
          ctx.db
            .query("predictionSnapshotAssessments")
            .withIndex("by_snapshot_and_type", (q) =>
              q.eq("snapshotId", snapshotId).eq("type", "outcome"),
            )
            .take(2),
        ),
      ]);
      expect(snapshots).toHaveLength(1);
      expect(assessments).toHaveLength(1);
      expect(assessments[0]).toMatchObject({
        type: "outcome",
        sourcePeriodEventId: expect.any(String),
      });
    } finally {
      vi.useRealTimers();
    }
  });

  test("a primary edit appends supersession when cycle-fact versioning is off", async () => {
    vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "false");
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    const { predictionSegmentId } = await seedPredictionContext(t, primaryId);
    const { snapshotId } = await t.mutation(
      internal.internal.predictionSnapshots.createSnapshot,
      snapshotArgs(primaryId, predictionSegmentId)
    );
    const periodEventId = await seedOutcomeEvent(t, primaryId);

    await t.mutation(internal.internal.predictionSnapshots.recordOutcome, {
      snapshotId,
      sourcePeriodEventId: periodEventId,
    });
    await asPrimary.mutation(api.mutations.periods.updatePeriodEvent, {
      periodEventId,
      startDate: "2026-01-31",
      timeZone: "UTC",
    });

    const supersessions = await t.run(async (ctx) =>
      ctx.db
        .query("predictionSnapshotAssessments")
        .withIndex("by_snapshot_and_type", (q) =>
          q.eq("snapshotId", snapshotId).eq("type", "superseded")
        )
        .take(2)
    );
    const correctedEvent = await t.run(async (ctx) =>
      ctx.db.get("periodEvents", periodEventId)
    );
    expect(supersessions).toHaveLength(1);
    expect(supersessions[0]).toMatchObject({
      type: "superseded",
      sourcePeriodEventId: periodEventId,
      reason: "primary_correction",
    });
    expect(correctedEvent?.primaryCorrectionVersion).toBe(2);
  });

  test("continues supersession in bounded scheduled pages", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    const { predictionSegmentId } = await seedPredictionContext(t, primaryId);
    const periodEventId = await seedOutcomeEvent(t, primaryId);
    const outcomeCount = 205;

    await t.run(async (ctx) => {
      const { qualityScoreV1, ...snapshotFields } = snapshotArgs(
        primaryId,
        predictionSegmentId
      );
      for (let index = 0; index < outcomeCount; index += 1) {
        const snapshotId = await ctx.db.insert("predictionSnapshots", {
          ...snapshotFields,
          generatedAt: generatedAt + index,
          ...(qualityScoreV1 === null ? {} : { qualityScoreV1 }),
        });
        await ctx.db.insert("predictionSnapshotAssessments", {
          snapshotId,
          type: "outcome",
          observedEligibleStartDate: "2026-01-30",
          signedErrorDays: 0,
          absoluteErrorDays: 0,
          insideWindow: true,
          sourcePeriodEventId: periodEventId,
          sourceAuthorityVersion: 1,
          reason: "eligible_outcome",
          recordedAt: outcomeCreatedAt,
        });
        await ctx.db.insert("predictionSnapshotOutcomeCandidates", {
          snapshotId,
          sourcePeriodEventId: periodEventId,
          observedEligibleStartDate: "2026-01-30",
          sourceAuthorityVersion: 1,
          status: "superseded",
          recordedAt: outcomeCreatedAt,
        });
      }
    });

    vi.useFakeTimers();
    try {
      await asPrimary.mutation(api.mutations.periods.updatePeriodEvent, {
        periodEventId,
        startDate: "2026-01-31",
        startCertainty: "exact",
        timeZone: "UTC",
        expectedAuthorityVersion: 1,
      });
      await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    } finally {
      vi.useRealTimers();
    }

    const supersessions = await t.run(async (ctx) =>
      ctx.db
        .query("predictionSnapshotAssessments")
        .withIndex("by_source_period_event_and_type", (q) =>
          q
            .eq("sourcePeriodEventId", periodEventId)
            .eq("type", "superseded")
        )
        .take(outcomeCount + 1)
    );
    const candidates = await t.run(async (ctx) =>
      ctx.db
        .query("predictionSnapshotOutcomeCandidates")
        .withIndex("by_source_event", (q) =>
          q.eq("sourcePeriodEventId", periodEventId),
        )
        .take(outcomeCount + 1),
    );
    expect(supersessions).toHaveLength(outcomeCount);
    expect(candidates).toHaveLength(0);
  });

  test.each([true, false])(
    "a primary deletion appends a supersession assessment (cycle facts v1: %s)",
    async (cycleFactsEnabled) => {
      vi.stubEnv(
        "CB_CONNECT_CYCLE_FACTS_V1",
        cycleFactsEnabled ? "true" : "false"
      );
      const t = convexTest(schema, modules);
      const { asPrimary, primaryId } = await seedActiveCouple(t);
      const { predictionSegmentId } = await seedPredictionContext(t, primaryId);
      const { snapshotId } = await t.mutation(
        internal.internal.predictionSnapshots.createSnapshot,
        snapshotArgs(primaryId, predictionSegmentId)
      );
      const periodEventId = await seedOutcomeEvent(t, primaryId);

      await t.mutation(internal.internal.predictionSnapshots.recordOutcome, {
        snapshotId,
        sourcePeriodEventId: periodEventId,
      });
      await asPrimary.mutation(api.mutations.periods.deletePeriodEvent, {
        periodEventId,
        expectedAuthorityVersion: 1,
      });

      const assessments = await t.run(async (ctx) =>
        ctx.db
          .query("predictionSnapshotAssessments")
          .withIndex("by_snapshot_and_type", (q) =>
            q.eq("snapshotId", snapshotId).eq("type", "superseded")
          )
          .take(2)
      );
      const correctedEvent = await t.run(async (ctx) =>
        ctx.db.get("periodEvents", periodEventId)
      );
      expect(assessments).toHaveLength(1);
      expect(assessments[0]).toMatchObject({
        type: "superseded",
        sourcePeriodEventId: periodEventId,
        reason: "primary_correction",
      });
      if (cycleFactsEnabled) {
        expect(assessments[0].sourceAuthorityVersion).toBe(2);
        expect(correctedEvent).toMatchObject({ tombstoneAuthorityVersion: 2 });
      } else {
        expect(assessments[0].sourceAuthorityVersion).toBeUndefined();
        expect(correctedEvent).toBeNull();
      }
    }
  );
});
