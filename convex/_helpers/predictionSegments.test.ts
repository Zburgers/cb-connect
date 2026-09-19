import { describe, expect, test } from "vitest";

import { filterHistoryForPredictionSegment } from "./predictionSegments";

describe("prediction segments", () => {
  const history = [
    { startDate: "2026-01-01", id: "first" },
    { startDate: "2026-05-01", id: "baseline" },
    { startDate: "2026-07-01", id: "later" },
  ];

  test("uses all eligible history when no user segment exists", () => {
    expect(filterHistoryForPredictionSegment(history)).toEqual(history);
    expect(filterHistoryForPredictionSegment(history, null)).toEqual(history);
  });

  test("excludes earlier history and includes the segment start", () => {
    expect(
      filterHistoryForPredictionSegment(history, { startDate: "2026-05-01" }),
    ).toEqual(history.slice(1));
  });

  test("restoring an earlier segment includes the previously excluded facts", () => {
    const recent = filterHistoryForPredictionSegment(history, {
      startDate: "2026-07-01",
    });
    const restored = filterHistoryForPredictionSegment(history, {
      startDate: "2026-05-01",
    });

    expect(recent).toEqual([history[2]]);
    expect(restored).toEqual(history.slice(1));
  });
});
