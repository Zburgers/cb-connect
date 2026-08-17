import { describe, expect, test } from "vitest";

import { serializeTelemetry } from "./telemetry";

const validMetric = {
  operation: "critical_mutation",
  outcome: "success",
  reason: "ok",
  durationMs: 42,
  synthetic: true,
};

describe("serializeTelemetry", () => {
  test("serializes an allowlisted metric with a bounded duration bucket", () => {
    expect(serializeTelemetry(validMetric)).toEqual({
      operation: "critical_mutation",
      outcome: "success",
      reason: "ok",
      durationBucket: "10-50ms",
      synthetic: true,
    });
  });

  test.each([
    "date",
    "note",
    "painScore",
    "message",
    "email",
    "userId",
    "coupleId",
    "token",
  ])("rejects sensitive or high-cardinality %s fields", (field) => {
    expect(
      serializeTelemetry({
        ...validMetric,
        [field]: "<redacted>",
      }),
    ).toBeNull();
  });

  test("rejects free-form operation and reason values", () => {
    expect(
      serializeTelemetry({
        ...validMetric,
        operation: "user-specific-operation",
      }),
    ).toBeNull();
    expect(
      serializeTelemetry({
        ...validMetric,
        reason: "unbounded-detail",
      }),
    ).toBeNull();
  });

  test("rejects invalid durations and never serializes the raw duration", () => {
    expect(
      serializeTelemetry({
        ...validMetric,
        durationMs: -1,
      }),
    ).toBeNull();
    expect(serializeTelemetry(validMetric)).not.toHaveProperty("durationMs");
  });
});
