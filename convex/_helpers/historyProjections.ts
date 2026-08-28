import type { Doc, Id } from "../_generated/dataModel";
import type { CycleFactReadLabel } from "./cycleFactEligibility";

type PeriodAttribution = {
  createdByName: string;
  updatedByName: string;
  createdByViewer: boolean;
  updatedByViewer: boolean;
};

type PeriodHistoryPresentation = {
  startDate: string;
  endDate?: string;
  startCertainty?: "exact" | "approximate" | "legacy_unknown";
  endCertainty?: "exact" | "approximate" | "legacy_unknown";
  source: "self" | "partner_assist" | "system";
  confirmationStatus: "confirmed" | "unreviewed";
  certainty: CycleFactReadLabel;
  createdByName: string;
  updatedByName: string;
  canCorrect: boolean;
};

export type PartnerReadOnlyPeriodHistory = PeriodHistoryPresentation &
  PeriodAttribution & {
    _id?: Id<"periodEvents">;
    authorityVersion?: number;
  };

export type PartnerWritablePeriodHistory = PartnerReadOnlyPeriodHistory & {
  _id: Id<"periodEvents">;
  authorityVersion: number;
};

export type SharedPeriodHistory = PartnerWritablePeriodHistory;

export type PrimaryPeriodHistory = SharedPeriodHistory & {
  createdByUserId: Id<"users">;
  updatedByUserId: Id<"users">;
};

export type PartnerPeriodHistory = SharedPeriodHistory;

type EnrichedPeriod = Doc<"periodEvents"> &
  Partial<PeriodAttribution> & {
    source: PeriodHistoryPresentation["source"];
    confirmationStatus: PeriodHistoryPresentation["confirmationStatus"];
    certainty: CycleFactReadLabel;
    authorityVersion: number;
    canCorrect: boolean;
    createdByName: string;
    updatedByName: string;
  };

function projectPeriodHistory(
  period: EnrichedPeriod,
  viewerId: Id<"users">,
  includeWriteMetadata: boolean,
): PartnerReadOnlyPeriodHistory | PartnerWritablePeriodHistory {
  const createdByUserId = period.createdByUserId ?? period.userId;
  const updatedByUserId = period.updatedByUserId ?? period.userId;

  const presentation: PartnerReadOnlyPeriodHistory = {
    startDate: period.startDate,
    endDate: period.endDate,
    startCertainty: period.startCertainty,
    endCertainty: period.endCertainty,
    source: period.source,
    confirmationStatus: period.confirmationStatus,
    certainty: period.certainty,
    createdByName: period.createdByName,
    updatedByName: period.updatedByName,
    createdByViewer: createdByUserId === viewerId,
    updatedByViewer: updatedByUserId === viewerId,
    canCorrect: period.userId === viewerId,
  };

  return includeWriteMetadata
    ? { ...presentation, _id: period._id, authorityVersion: period.authorityVersion }
    : presentation;
}

export function projectPrimaryPeriodHistory(
  period: EnrichedPeriod,
  viewerId: Id<"users">
): PrimaryPeriodHistory {
  const shared = projectPeriodHistory(
    period,
    viewerId,
    true,
  ) as PartnerWritablePeriodHistory;
  return {
    ...shared,
    createdByUserId: period.createdByUserId ?? period.userId,
    updatedByUserId: period.updatedByUserId ?? period.userId,
  };
}

export function projectPartnerPeriodHistory(
  period: EnrichedPeriod,
  viewerId: Id<"users">,
  includeWriteMetadata = false,
): PartnerReadOnlyPeriodHistory | PartnerWritablePeriodHistory {
  return projectPeriodHistory(period, viewerId, includeWriteMetadata);
}
