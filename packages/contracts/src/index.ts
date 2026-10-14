/** Presentation DTOs only. Never export authorization, estimators, schema or server data. */
export const CYCLE_STATE_STATUS = [
  "recorded_period", "estimated", "late_or_uncertain",
  "insufficient_data", "prediction_paused",
] as const;
export type CycleStateStatus = (typeof CYCLE_STATE_STATUS)[number];

export type CycleCapabilities = Readonly<{
  cycleFactsV1: boolean;
  cycleStateV1: boolean;
  periodPredictionV2: boolean;
  partnerPredictionV2: boolean;
}>;

export type CycleFactCertainty = "exact" | "approximate" | "legacy_unknown";
export type SharingFlags = Readonly<{
  pain: boolean;
  phase: boolean;
  periodWrite: boolean;
}>;

export type PartnerCycleSummary = Readonly<{
  status: CycleStateStatus;
  // Intentionally no primary event ID, exact period fact or pain note.
  phaseLabel: string | null;
  timingLabel: string | null;
}>;

/** Input-format check only. Server remains authoritative about calendar validity. */
export function isLocalDateInput(value: string): boolean {
  return /^\\d{4}-\\d{2}-\\d{2}$/.test(value);
}
