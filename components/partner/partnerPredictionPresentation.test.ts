import { expect, test } from "vitest";

import {
  getPartnerPredictionPresentation,
  shouldEnsurePartnerPredictionSnapshot,
  type PartnerPredictionPresentation,
} from "./partnerPredictionPresentation";
import type { PartnerPredictionV2Projection } from "../../convex/_helpers/partnerCycleProjection";

const estimatedPrediction: PartnerPredictionV2Projection = {
  version: 2,
  status: "estimated",
  timingStatus: "estimated",
  pointDate: "2026-09-28",
  earliestDate: "2026-09-25",
  latestDate: "2026-10-01",
  quality: "limited_evidence",
  basisBand: "limited",
};

test("bootstraps a shared snapshot when partner data exists but projection is absent", () => {
  expect(
    shouldEnsurePartnerPredictionSnapshot(true, true, undefined),
  ).toBe(true);
  expect(
    shouldEnsurePartnerPredictionSnapshot(true, true, estimatedPrediction),
  ).toBe(false);
  expect(
    shouldEnsurePartnerPredictionSnapshot(false, true, undefined),
  ).toBe(false);
  expect(
    shouldEnsurePartnerPredictionSnapshot(true, false, undefined),
  ).toBe(false);
});

test("presents only the safe date, timing, quality, and basis summary", () => {
  expect(getPartnerPredictionPresentation(estimatedPrediction)).toEqual({
    statusLabel: "Estimated next period",
    timingLabel: "Cycle timing is estimated.",
    pointText: "Sep 28, 2026",
    rangeText: "Sep 25, 2026–Oct 1, 2026",
    qualityLabel: "Limited evidence",
    basisText: "Based on limited cycle history",
    careHeading: "Ideas, not assumptions.",
    careSuggestions: [
      "Ask what kind of support would feel helpful today.",
      "Check in before offering help.",
    ],
  });
});

test.each([
  [
    "paused",
    {
      ...estimatedPrediction,
      status: "paused",
      timingStatus: "prediction_paused",
      pointDate: null,
      earliestDate: null,
      latestDate: null,
    },
    "Prediction paused",
    "Predictions are paused.",
  ],
  [
    "unavailable",
    {
      ...estimatedPrediction,
      status: "unavailable",
      timingStatus: "insufficient_data",
      pointDate: null,
      earliestDate: null,
      latestDate: null,
    },
    "No estimate available",
    "There is not enough cycle information for a timing update.",
  ],
  [
    "late timing",
    { ...estimatedPrediction, timingStatus: "late_or_uncertain" },
    "Estimated next period",
    "Timing is later than the current estimate.",
  ],
] as const)("maps %s into broad, non-medical copy", (_case, data, title, timing) => {
  const presentation = getPartnerPredictionPresentation(
    data as PartnerPredictionV2Projection,
  );

  expect(presentation?.statusLabel).toBe(title);
  expect(presentation?.timingLabel).toBe(timing);
});

test("care suggestions are explicitly ideas, not assumptions", () => {
  const presentation = getPartnerPredictionPresentation(estimatedPrediction);

  expect(presentation?.careSuggestions).toEqual([
    "Ask what kind of support would feel helpful today.",
    "Check in before offering help.",
  ] satisfies PartnerPredictionPresentation["careSuggestions"]);
});

test("malformed dates are omitted from the presentation", () => {
  const presentation = getPartnerPredictionPresentation({
    ...estimatedPrediction,
    pointDate: "2026-02-30",
    earliestDate: "not-a-date",
  });

  expect(presentation?.pointText).toBeNull();
  expect(presentation?.rangeText).toBeNull();
});
