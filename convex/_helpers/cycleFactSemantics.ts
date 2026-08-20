export const CYCLE_FACT_CERTAINTIES = [
  "exact",
  "approximate",
  "legacy_unknown",
] as const;

export type CycleFactCertainty = (typeof CYCLE_FACT_CERTAINTIES)[number];

export const LEGACY_CYCLE_FACT_REASONS = [
  "missing_provenance",
  "inferred_end",
  "duplicate",
  "overlap",
  "unprovable",
] as const;

export type LegacyCycleFactReason =
  (typeof LEGACY_CYCLE_FACT_REASONS)[number];

export interface CycleFactSemanticsInput {
  startCertainty?: string;
  endCertainty?: string;
  legacyReason?: string;
  authorityVersion?: number;
  tombstoneByUserId?: string;
  tombstoneAt?: number;
  tombstoneAuthorityVersion?: number;
}

export type CycleFactSemanticsErrorCode =
  | "MISSING_START_CERTAINTY"
  | "INVALID_START_CERTAINTY"
  | "INVALID_END_CERTAINTY"
  | "INVALID_LEGACY_REASON"
  | "LEGACY_REASON_REQUIRED"
  | "LEGACY_REASON_UNEXPECTED"
  | "HIDDEN_DATE_RANGE"
  | "INVALID_AUTHORITY_VERSION"
  | "INCOMPLETE_TOMBSTONE"
  | "INVALID_TOMBSTONE_ACTOR"
  | "INVALID_TOMBSTONE_TIME"
  | "INVALID_TOMBSTONE_VERSION";

export type CycleFactSemanticsResult =
  | { valid: true }
  | {
      valid: false;
      code: CycleFactSemanticsErrorCode;
      message: string;
    };

const hiddenDateRangeFields = [
  "startDateMin",
  "startDateMax",
  "endDateMin",
  "endDateMax",
] as const;

function failure(
  code: CycleFactSemanticsErrorCode,
  message: string
): CycleFactSemanticsResult {
  return { valid: false, code, message };
}

function isCycleFactCertainty(value: unknown): value is CycleFactCertainty {
  return (
    typeof value === "string" &&
    (CYCLE_FACT_CERTAINTIES as readonly string[]).includes(value)
  );
}

function isLegacyCycleFactReason(value: unknown): value is LegacyCycleFactReason {
  return (
    typeof value === "string" &&
    (LEGACY_CYCLE_FACT_REASONS as readonly string[]).includes(value)
  );
}

function isValidVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function validateCycleFactSemantics(
  input: CycleFactSemanticsInput
): CycleFactSemanticsResult {
  const record = input as Record<string, unknown>;
  for (const field of hiddenDateRangeFields) {
    if (record[field] !== undefined) {
      return failure(
        "HIDDEN_DATE_RANGE",
        "Cycle facts cannot contain hidden date ranges"
      );
    }
  }

  if (input.startCertainty === undefined) {
    return failure(
      "MISSING_START_CERTAINTY",
      "Cycle facts require explicit start certainty"
    );
  }
  if (!isCycleFactCertainty(input.startCertainty)) {
    return failure("INVALID_START_CERTAINTY", "Start certainty is invalid");
  }
  if (
    input.endCertainty !== undefined &&
    !isCycleFactCertainty(input.endCertainty)
  ) {
    return failure("INVALID_END_CERTAINTY", "End certainty is invalid");
  }

  if (
    input.legacyReason !== undefined &&
    !isLegacyCycleFactReason(input.legacyReason)
  ) {
    return failure("INVALID_LEGACY_REASON", "Legacy reason is invalid");
  }

  const hasLegacyUnknown =
    input.startCertainty === "legacy_unknown" ||
    input.endCertainty === "legacy_unknown";
  if (hasLegacyUnknown && input.legacyReason === undefined) {
    return failure(
      "LEGACY_REASON_REQUIRED",
      "Legacy-unknown cycle facts require a reason"
    );
  }
  if (!hasLegacyUnknown && input.legacyReason !== undefined) {
    return failure(
      "LEGACY_REASON_UNEXPECTED",
      "Legacy reason is only valid for legacy-unknown cycle facts"
    );
  }

  if (!isValidVersion(input.authorityVersion)) {
    return failure(
      "INVALID_AUTHORITY_VERSION",
      "Cycle facts require a nonnegative integer authority version"
    );
  }

  const tombstoneFields = [
    input.tombstoneByUserId,
    input.tombstoneAt,
    input.tombstoneAuthorityVersion,
  ];
  const presentTombstoneFields = tombstoneFields.filter(
    (value) => value !== undefined
  ).length;
  if (presentTombstoneFields !== 0 && presentTombstoneFields !== 3) {
    return failure(
      "INCOMPLETE_TOMBSTONE",
      "Tombstone actor, time and version must be provided together"
    );
  }
  if (presentTombstoneFields === 3) {
    if (
      typeof input.tombstoneByUserId !== "string" ||
      input.tombstoneByUserId.length === 0
    ) {
      return failure("INVALID_TOMBSTONE_ACTOR", "Tombstone actor is invalid");
    }
    if (
      typeof input.tombstoneAt !== "number" ||
      !Number.isFinite(input.tombstoneAt) ||
      input.tombstoneAt <= 0
    ) {
      return failure("INVALID_TOMBSTONE_TIME", "Tombstone time is invalid");
    }
    if (!isValidVersion(input.tombstoneAuthorityVersion)) {
      return failure(
        "INVALID_TOMBSTONE_VERSION",
        "Tombstone version is invalid"
      );
    }
  }

  return { valid: true };
}

export function assertCycleFactSemantics(
  input: CycleFactSemanticsInput
): asserts input is CycleFactSemanticsInput {
  const result = validateCycleFactSemantics(input);
  if (!result.valid) {
    throw new Error(`${result.code}: ${result.message}`);
  }
}
