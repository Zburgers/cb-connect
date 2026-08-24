import type { Doc, Id } from "../_generated/dataModel";
import type { CycleFactReadLabel } from "./cycleFactEligibility";

type PeriodAttribution = {
  createdByName: string;
  updatedByName: string;
  createdByViewer: boolean;
  updatedByViewer: boolean;
};

type PeriodHistoryFields = {
  _id: Id<"periodEvents">;
  startDate: string;
  endDate?: string;
  startCertainty?: "exact" | "approximate" | "legacy_unknown";
  endCertainty?: "exact" | "approximate" | "legacy_unknown";
  source: "self" | "partner_assist" | "system";
  confirmationStatus: "confirmed" | "unreviewed";
  certainty: CycleFactReadLabel;
  authorityVersion: number;
  legacyReason?:
    | "missing_provenance"
    | "inferred_end"
    | "duplicate"
    | "overlap"
    | "unprovable";
  createdByName: string;
  updatedByName: string;
  canCorrect: boolean;
};

/**
 * Fields intentionally shared by the primary and partner history screens.
 *
 * The event id is retained because the authorized partner end-write contract
 * is targeted and stale-safe. The authority version is retained for the same
 * reason. Attribution is viewer-relative so the partner never receives actor
 * or owner ids.
 */
export type SharedPeriodHistory = PeriodHistoryFields & PeriodAttribution;

export type PrimaryPeriodHistory = SharedPeriodHistory & {
  createdByUserId: Id<"users">;
  updatedByUserId: Id<"users">;
};

export type PartnerPeriodHistory = SharedPeriodHistory;

type EnrichedPeriod = Doc<"periodEvents"> &
  Partial<PeriodAttribution> & {
    source: PeriodHistoryFields["source"];
    confirmationStatus: PeriodHistoryFields["confirmationStatus"];
    certainty: CycleFactReadLabel;
    authorityVersion: number;
    canCorrect: boolean;
    createdByName: string;
    updatedByName: string;
  };

function projectPeriodHistory(
  period: EnrichedPeriod,
  viewerId: Id<"users">
): SharedPeriodHistory {
  const createdByUserId = period.createdByUserId ?? period.userId;
  const updatedByUserId = period.updatedByUserId ?? period.userId;

  return {
    _id: period._id,
    startDate: period.startDate,
    endDate: period.endDate,
    startCertainty: period.startCertainty,
    endCertainty: period.endCertainty,
    source: period.source,
    confirmationStatus: period.confirmationStatus,
    certainty: period.certainty,
    authorityVersion: period.authorityVersion,
    legacyReason: period.legacyReason,
    createdByName: period.createdByName,
    updatedByName: period.updatedByName,
    createdByViewer: createdByUserId === viewerId,
    updatedByViewer: updatedByUserId === viewerId,
    canCorrect: period.userId === viewerId,
  };
}

export function projectPrimaryPeriodHistory(
  period: EnrichedPeriod,
  viewerId: Id<"users">
): PrimaryPeriodHistory {
  const shared = projectPeriodHistory(period, viewerId);
  return {
    ...shared,
    createdByUserId: period.createdByUserId ?? period.userId,
    updatedByUserId: period.updatedByUserId ?? period.userId,
  };
}

export function projectPartnerPeriodHistory(
  period: EnrichedPeriod,
  viewerId: Id<"users">
): PartnerPeriodHistory {
  return projectPeriodHistory(period, viewerId);
}
