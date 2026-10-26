import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getCycleDashboardPresentation,
  formatCycleCalendarDate,
  shouldEnsureCyclePredictionSnapshot,
  type CycleDashboardData,
} from "./CycleDashboardModel";
import type { CycleCapabilities, CycleStateV1 } from "@cb-connect/contracts";

const legacyBounds = {
  version: 1 as const,
  source: "legacy_configured" as const,
  expectedDate: "2026-03-08",
  earliestDate: "2026-03-06",
  latestDate: "2026-03-10",
  reason: "LEGACY_UNCALIBRATED_GRACE" as const,
  basisCount: 1 as const,
};

const v2Prediction = {
  version: 2 as const,
  source: "period_prediction_v2" as const,
  status: "limited_evidence" as const,
  pointDate: "2026-03-08",
  earliestDate: "2026-03-06",
  latestDate: "2026-03-10",
  probabilityLabel: null,
  quality: "timing_less_predictable" as const,
  basisCount: 2,
  estimatorId: "configured_v1" as const,
  estimatorVersion: 1,
  calibrationVersion: null,
  reasonCodes: ["POSSIBLE_MISSING_LOG", "RECENT_TIMING_VARIABLE"] as const,
};

const partnerPrediction = {
  version: 2 as const,
  status: "estimated" as const,
  timingStatus: "estimated" as const,
  pointDate: "2026-03-08",
  earliestDate: "2026-03-06",
  latestDate: "2026-03-10",
  quality: "limited_evidence" as const,
  basisBand: "limited" as const,
};

const states: Record<"primary" | "partner", CycleStateV1[]> = {
  primary: [
    {
      version: 1,
      status: "recorded_period",
      phase: "menstruation",
      evidence: "RECORDED_EXACT",
      cycleDay: 2,
      coveringEventId: "private-event",
      reason: "CONFIRMED_EVENT_COVERS_TODAY",
    },
    {
      version: 1,
      status: "estimated",
      phase: "ovulation",
      evidence: "CALENDAR_ESTIMATE",
      cycleDay: 14,
      bounds: v2Prediction,
      reason: "ELIGIBLE_FACT_WITHIN_LATEST_BOUND",
    },
    {
      version: 1,
      status: "late_or_uncertain",
      phase: null,
      evidence: "TIMING_UNCERTAINTY",
      cycleDay: null,
      bounds: v2Prediction,
      reason: "AFTER_LATEST_BOUND",
    },
    {
      version: 1,
      status: "insufficient_data",
      phase: null,
      evidence: "UNAVAILABLE",
      cycleDay: null,
      reason: "NO_ELIGIBLE_FACT",
    },
    {
      version: 1,
      status: "prediction_paused",
      phase: null,
      evidence: "USER_PAUSED",
      cycleDay: null,
      reason: "USER_PAUSED",
    },
  ],
  partner: [
    {
      version: 1,
      status: "recorded_period",
      phase: "menstruation",
      evidence: "RECORDED_EXACT",
      cycleDay: 2,
      reason: "CONFIRMED_EVENT_COVERS_TODAY",
    },
    {
      version: 1,
      status: "estimated",
      phase: "follicular",
      evidence: "CALENDAR_ESTIMATE",
      cycleDay: 8,
      bounds: legacyBounds,
      reason: "ELIGIBLE_FACT_WITHIN_LATEST_BOUND",
    },
    {
      version: 1,
      status: "late_or_uncertain",
      phase: null,
      evidence: "TIMING_UNCERTAINTY",
      cycleDay: null,
      bounds: legacyBounds,
      reason: "AFTER_LATEST_BOUND",
    },
    {
      version: 1,
      status: "insufficient_data",
      phase: null,
      evidence: "UNAVAILABLE",
      cycleDay: null,
      reason: "NO_ELIGIBLE_FACT",
    },
    {
      version: 1,
      status: "prediction_paused",
      phase: null,
      evidence: "USER_PAUSED",
      cycleDay: null,
      reason: "USER_PAUSED",
    },
  ],
};

const capabilities: CycleCapabilities = {
  cycleFactsV1: false,
  cycleStateV1: true,
  periodPredictionV2: true,
  partnerPredictionV2: true,
};

function dataFor(
  role: "primary" | "partner",
  state: CycleStateV1,
): CycleDashboardData {
  return {
    hasData: true,
    isPartnerView: role === "partner",
    cycleStateV1: state,
    cycleStateV1Exposed: true,
    partnerPredictionV2: role === "partner" ? partnerPrediction : undefined,
    partnerPredictionV2Exposed: role === "partner",
    periodPredictionV2: role === "primary" ? v2Prediction : undefined,
  };
}

describe("mobile cycle dashboard", () => {
  for (const role of ["primary", "partner"] as const) {
    it.each(states[role])(
      `${role} preserves the %s state semantics`,
      (state) => {
        const model = getCycleDashboardPresentation(
          dataFor(role, state),
          capabilities,
        );
        expect(model?.role).toBe(role);
        expect(model?.state?.status).toBe(
          {
            recorded_period: "Recorded",
            estimated: "Calendar estimate",
            late_or_uncertain: "Late",
            insufficient_data: "Unknown",
            prediction_paused: "Prediction paused",
          }[state.status],
        );
        if (state.status === "estimated")
          expect(model?.state?.title).toContain(`cycle day ${state.cycleDay}`);
        if (state.status === "late_or_uncertain")
          expect(model?.state?.details.join(" ")).toContain(
            "estimate has passed",
          );
        if (state.status === "insufficient_data")
          expect(model?.state?.details.join(" ")).toContain(
            "not enough information",
          );
        if (state.status === "prediction_paused")
          expect(model?.state?.title).toContain("paused");
      },
    );
  }

  it("keeps the V2 primary window, reasons, and non-probability wording", () => {
    const model = getCycleDashboardPresentation(
      dataFor("primary", states.primary[1]),
      capabilities,
    );
    expect(model?.prediction).toMatchObject({
      status: "Period timing estimate",
      title: "Estimated around Mar 8, 2026",
    });
    expect(model?.prediction?.details).toContain(
      "Estimated range: Mar 6, 2026–Mar 10, 2026",
    );
    expect(model?.prediction?.details).toContain(
      "A long recorded gap may include an unlogged period; it stays in the history and widens the range.",
    );
    expect(model?.prediction?.details.join(" ")).not.toContain("80% likely");
    expect(model?.state?.disclaimer).toContain("does not confirm ovulation");
  });

  it("uses an 80% label only when the backend calibration version is approved and matches", () => {
    const calibrated = {
      ...v2Prediction,
      status: "personalized" as const,
      calibrationVersion: "bench-v1",
      probabilityLabel: {
        level: 80 as const,
        calibrationStatus: "approved" as const,
        calibrationVersion: "bench-v1",
      },
    };
    const matched = getCycleDashboardPresentation(
      {
        ...dataFor("primary", states.primary[1]),
        periodPredictionV2: calibrated,
      },
      capabilities,
    );
    expect(matched?.prediction?.details.join(" ")).toContain(
      "80% likely range",
    );

    const mismatched = getCycleDashboardPresentation(
      {
        ...dataFor("primary", states.primary[1]),
        periodPredictionV2: {
          ...calibrated,
          calibrationVersion: "bench-v2",
        },
      },
      capabilities,
    );
    expect(mismatched?.prediction?.details.join(" ")).toContain(
      "Estimated range",
    );
    expect(mismatched?.prediction?.details.join(" ")).not.toContain(
      "80% likely",
    );
  });

  it("ensures enabled snapshots for both roles only when needed", () => {
    expect(
      shouldEnsureCyclePredictionSnapshot(
        dataFor("primary", states.primary[1]),
        capabilities,
      ),
    ).toBe(false);
    expect(
      shouldEnsureCyclePredictionSnapshot(
        { ...dataFor("primary", states.primary[1]), periodPredictionV2: undefined },
        capabilities,
      ),
    ).toBe(true);
    expect(
      shouldEnsureCyclePredictionSnapshot(
        { ...dataFor("partner", states.partner[1]), partnerPredictionV2: undefined },
        capabilities,
      ),
    ).toBe(true);
    expect(
      shouldEnsureCyclePredictionSnapshot(
        dataFor("partner", states.partner[1]),
        { ...capabilities, partnerPredictionV2: false },
      ),
    ).toBe(false);
    expect(
      shouldEnsureCyclePredictionSnapshot(
        { ...dataFor("primary", states.primary[1]), hasData: false },
        capabilities,
      ),
    ).toBe(false);
  });

  it("keeps a late timing explanation with a partner estimate date", () => {
    const model = getCycleDashboardPresentation(
      {
        ...dataFor("partner", states.partner[1]),
        partnerPredictionV2: {
          ...partnerPrediction,
          timingStatus: "late_or_uncertain",
        },
      },
      capabilities,
    );
    expect(model?.prediction?.title).toBe("Estimated around Mar 8, 2026");
    expect(model?.prediction?.details).toContain(
      "Timing is later than the current estimate.",
    );
  });

  it("uses the reduced partner projection and never renders primary prediction details", () => {
    const data = {
      ...dataFor("partner", states.partner[1]),
      periodPredictionV2: v2Prediction,
    };
    const model = getCycleDashboardPresentation(data, capabilities);
    expect(model?.prediction?.status).toBe("Estimated next period");
    expect(model?.prediction?.details).toContain(
      "Based on limited cycle history.",
    );
    expect(model?.prediction?.details.join(" ")).not.toContain(
      "eligible start-to-start",
    );
    expect(model?.prediction?.details.join(" ")).not.toContain(
      "long recorded gap",
    );
  });

  it("fails closed when capabilities or per-user exposure are off", () => {
    const data = dataFor("primary", states.primary[1]);
    const disabled = {
      ...capabilities,
      cycleStateV1: false,
      periodPredictionV2: false,
    };
    expect(getCycleDashboardPresentation(data, disabled)).toMatchObject({
      state: null,
      prediction: null,
    });
    expect(
      getCycleDashboardPresentation(
        { ...data, cycleStateV1Exposed: false },
        capabilities,
      )?.state,
    ).toBeNull();
    expect(getCycleDashboardPresentation(undefined, capabilities)).toBeNull();
    expect(getCycleDashboardPresentation(data, undefined)).toBeNull();
  });

  it("does not render invalid or DST-shifted date-only values through local time", () => {
    expect(formatCycleCalendarDate("2026-03-08")).toBe("Mar 8, 2026");
    expect(formatCycleCalendarDate("2026-02-30")).toBeNull();
  });

  it("uses scalable, semantic text in a scrollable layout for compact and large screens", () => {
    const screen = readFileSync(
      new URL("./CycleDashboard.tsx", import.meta.url),
      "utf8",
    );
    expect(screen).toContain("<ScrollView");
    expect(screen).toContain("<SafeAreaView");
    expect(screen).toContain("allowFontScaling");
    expect(screen).toContain('accessibilityRole="header"');
    expect(screen).toContain('accessibilityRole="summary"');
    expect(screen).toContain("maxWidth: 560");
    expect(screen).toContain("useColorScheme");
    expect(screen).not.toMatch(/\bheight:\s*\d/);
  });
});
