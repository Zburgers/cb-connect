export const TELEMETRY_OPERATIONS = [
  "release_readiness",
  "authenticated_session_start",
  "critical_mutation",
  "scheduled_effect_uniqueness",
  "recovery_readiness",
] as const;

export const TELEMETRY_OUTCOMES = ["success", "failure"] as const;

export const TELEMETRY_REASONS = [
  "ok",
  "timeout",
  "unavailable",
  "mismatch",
  "invalid_fixture",
  "validation_rejected",
  "unauthenticated",
  "client_cancelled",
  "duplicate",
  "infrastructure_failure",
] as const;

export const TELEMETRY_DURATION_BUCKETS = [
  "0-10ms",
  "10-50ms",
  "50-100ms",
  "100-250ms",
  "250-500ms",
  "500-1000ms",
  "1000ms+",
] as const;

type TelemetryOperation = (typeof TELEMETRY_OPERATIONS)[number];
type TelemetryOutcome = (typeof TELEMETRY_OUTCOMES)[number];
type TelemetryReason = (typeof TELEMETRY_REASONS)[number];
type TelemetryDurationBucket = (typeof TELEMETRY_DURATION_BUCKETS)[number];

export type SerializedTelemetry = {
  operation: TelemetryOperation;
  outcome: TelemetryOutcome;
  reason: TelemetryReason;
  durationBucket: TelemetryDurationBucket;
  synthetic: boolean;
};

const ALLOWED_INPUT_KEYS = [
  "operation",
  "outcome",
  "reason",
  "durationMs",
  "synthetic",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAllowedValue<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function getDurationBucket(durationMs: number): TelemetryDurationBucket {
  if (durationMs < 10) return "0-10ms";
  if (durationMs < 50) return "10-50ms";
  if (durationMs < 100) return "50-100ms";
  if (durationMs < 250) return "100-250ms";
  if (durationMs < 500) return "250-500ms";
  if (durationMs < 1000) return "500-1000ms";
  return "1000ms+";
}

export function serializeTelemetry(
  input: unknown,
): SerializedTelemetry | null {
  if (!isRecord(input)) {
    return null;
  }

  if (
    Object.keys(input).some(
      (key) => !(ALLOWED_INPUT_KEYS as readonly string[]).includes(key),
    )
  ) {
    return null;
  }

  const { operation, outcome, reason, durationMs, synthetic } = input;

  if (
    !isAllowedValue(TELEMETRY_OPERATIONS, operation) ||
    !isAllowedValue(TELEMETRY_OUTCOMES, outcome) ||
    !isAllowedValue(TELEMETRY_REASONS, reason) ||
    typeof durationMs !== "number" ||
    !Number.isFinite(durationMs) ||
    durationMs < 0 ||
    durationMs > 86_400_000 ||
    typeof synthetic !== "boolean"
  ) {
    return null;
  }

  return {
    operation,
    outcome,
    reason,
    durationBucket: getDurationBucket(durationMs),
    synthetic,
  };
}
