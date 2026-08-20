import {
  requireValidCalendarDate,
} from "./calendarDates";
import {
  validateCycleFactSemantics,
  type CycleFactSemanticsErrorCode,
  type CycleFactSemanticsInput,
} from "./cycleFactSemantics";

export type PeriodEventActorRole = "primary" | "partner";
export type PartnerAccess = "active" | "revoked";

export type PeriodEventCandidate = CycleFactSemanticsInput & {
  startDate: string;
  endDate?: string;
  authorityVersion: number;
  actorRole: PeriodEventActorRole;
  partnerAccess?: PartnerAccess;
  targetEventId?: string;
  expectedAuthorityVersion?: number;
};

export type PeriodEventProjection = CycleFactSemanticsInput & {
  id: string;
  startDate: string;
  endDate?: string;
  lastWriterRole?: PeriodEventActorRole;
};

export type PeriodEventInvariantErrorCode =
  | CycleFactSemanticsErrorCode
  | "INVALID_ACTOR_ROLE"
  | "PARTNER_ACCESS_REVOKED"
  | "INVALID_START_DATE"
  | "INVALID_END_DATE"
  | "END_BEFORE_START"
  | "TARGET_EVENT_NOT_FOUND"
  | "AUTHORITY_VERSION_REQUIRED"
  | "STALE_AUTHORITY_VERSION"
  | "PRIMARY_AUTHORITY_REQUIRED"
  | "DUPLICATE_EXACT_START"
  | "EXACT_INTERVAL_OVERLAP";

export type PeriodEventInvariantResult =
  | { allowed: true }
  | {
      allowed: false;
      code: PeriodEventInvariantErrorCode;
      message: string;
    };

function failure(
  code: PeriodEventInvariantErrorCode,
  message: string
): PeriodEventInvariantResult {
  return { allowed: false, code, message };
}

function isExactEvidence(
  event: Pick<PeriodEventCandidate, "startDate" | "endDate" | "startCertainty" | "endCertainty">
): boolean {
  return (
    event.startCertainty === "exact" &&
    (event.endDate === undefined || event.endCertainty === "exact")
  );
}

function intervalsOverlap(
  left: Pick<PeriodEventProjection, "startDate" | "endDate">,
  right: Pick<PeriodEventCandidate, "startDate" | "endDate">
): boolean {
  const lastDate = "9999-12-31";
  const leftEnd = left.endDate ?? lastDate;
  const rightEnd = right.endDate ?? lastDate;
  return left.startDate <= rightEnd && right.startDate <= leftEnd;
}

function validateCalendarDates(
  candidate: PeriodEventCandidate
): PeriodEventInvariantResult | null {
  try {
    requireValidCalendarDate(candidate.startDate, "Start date");
  } catch {
    return failure("INVALID_START_DATE", "Start date must be a valid date");
  }
  if (candidate.endDate !== undefined) {
    try {
      requireValidCalendarDate(candidate.endDate, "End date");
    } catch {
      return failure("INVALID_END_DATE", "End date must be a valid date");
    }
    if (candidate.endDate < candidate.startDate) {
      return failure("END_BEFORE_START", "End date cannot be before start date");
    }
  }
  return null;
}

export function evaluatePeriodEventInvariants(
  candidate: PeriodEventCandidate,
  existingEvents: PeriodEventProjection[]
): PeriodEventInvariantResult {
  if (candidate.actorRole !== "primary" && candidate.actorRole !== "partner") {
    return failure("INVALID_ACTOR_ROLE", "Period event actor role is invalid");
  }
  if (candidate.actorRole === "partner" && candidate.partnerAccess === "revoked") {
    return failure(
      "PARTNER_ACCESS_REVOKED",
      "Revoked partners cannot write period facts"
    );
  }

  const semantics = validateCycleFactSemantics(candidate);
  if (!semantics.valid) {
    return failure(semantics.code, semantics.message);
  }

  const calendarError = validateCalendarDates(candidate);
  if (calendarError) {
    return calendarError;
  }

  const target = candidate.targetEventId
    ? existingEvents.find((event) => event.id === candidate.targetEventId)
    : undefined;
  if (candidate.targetEventId && !target) {
    return failure("TARGET_EVENT_NOT_FOUND", "Target period event was not found");
  }
  if (target) {
    if (candidate.expectedAuthorityVersion === undefined) {
      return failure(
        "AUTHORITY_VERSION_REQUIRED",
        "Updates require an expected authority version"
      );
    }
    if (
      candidate.expectedAuthorityVersion !== (target.authorityVersion ?? 0)
    ) {
      return failure(
        "STALE_AUTHORITY_VERSION",
        "Period event authority version is stale"
      );
    }
    if (
      candidate.actorRole === "partner" &&
      target.lastWriterRole === "primary"
    ) {
      return failure(
        "PRIMARY_AUTHORITY_REQUIRED",
        "Primary-authored period facts cannot be overwritten by a partner"
      );
    }
  }

  if (!isExactEvidence(candidate)) {
    return { allowed: true };
  }

  for (const existing of existingEvents) {
    if (existing.id === candidate.targetEventId || !isExactEvidence(existing)) {
      continue;
    }
    if (existing.startDate === candidate.startDate) {
      return failure(
        "DUPLICATE_EXACT_START",
        "An exact period fact already uses this start date"
      );
    }
    if (intervalsOverlap(existing, candidate)) {
      return failure(
        "EXACT_INTERVAL_OVERLAP",
        "Exact period facts cannot overlap"
      );
    }
  }

  return { allowed: true };
}
