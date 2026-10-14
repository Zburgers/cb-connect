import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";
import type {
  CoupleChatMessageDTO,
  CycleCapabilities,
  CycleFactHistoryDTO,
  CycleStateV1,
  NotificationInboxPageDTO,
  NotificationPurpose,
  PartnerCycleStateV1,
  PartnerPredictionV2,
  PrimaryPredictionV2,
} from "@cb-connect/contracts";

type Assert<T extends true> = T;
type AssertFalse<T extends false> = T;
type IsAssignable<From, To> = [From] extends [To] ? true : false;
type Dashboard = FunctionReturnType<
  typeof api.queries.dashboard.getDashboardData
>;

type _capabilitiesMatchPublicQuery = Assert<
  IsAssignable<
    FunctionReturnType<typeof api.queries.capabilities.getCapabilities>,
    CycleCapabilities
  >
>;
type _cycleStateMatchesPublicQuery = Assert<
  IsAssignable<NonNullable<Dashboard["cycleStateV1"]>, CycleStateV1>
>;
type _primaryPredictionMatchesPublicQuery = Assert<
  IsAssignable<NonNullable<Dashboard["periodPredictionV2"]>, PrimaryPredictionV2>
>;
type _partnerPredictionMatchesPublicQuery = Assert<
  IsAssignable<NonNullable<Dashboard["partnerPredictionV2"]>, PartnerPredictionV2>
>;
type _historyMatchesPublicQuery = Assert<
  IsAssignable<
    NonNullable<
      FunctionReturnType<typeof api.queries.history.getTimelineHistory>[number]["period"]
    >,
    CycleFactHistoryDTO
  >
>;
type _chatMatchesPublicQuery = Assert<
  IsAssignable<
    FunctionReturnType<typeof api.queries.messages.listForCouple>,
    readonly CoupleChatMessageDTO[]
  >
>;
type _inboxMatchesPublicQuery = Assert<
  IsAssignable<
    FunctionReturnType<typeof api.queries.notifications.getMyInbox>,
    NotificationInboxPageDTO
  >
>;
type _purposeMatchesPublicQuery = Assert<
  IsAssignable<
    FunctionReturnType<typeof api.queries.notifications.getMyPreferences>[number]["purpose"],
    NotificationPurpose
  >
>;

type _partnerCycleHasNoPrimaryEventId = AssertFalse<
  "coveringEventId" extends keyof PartnerCycleStateV1 ? true : false
>;
type _partnerPredictionHasNoProbabilityLabel = AssertFalse<
  "probabilityLabel" extends keyof PartnerPredictionV2 ? true : false
>;
type _partnerPredictionHasNoSnapshotId = AssertFalse<
  "snapshotId" extends keyof PartnerPredictionV2 ? true : false
>;

declare const partnerPrediction: PartnerPredictionV2;
// @ts-expect-error Public projection DTOs are immutable to mobile consumers.
partnerPrediction.status = "paused";

export type ContractParityAssertions =
  | _capabilitiesMatchPublicQuery
  | _cycleStateMatchesPublicQuery
  | _primaryPredictionMatchesPublicQuery
  | _partnerPredictionMatchesPublicQuery
  | _historyMatchesPublicQuery
  | _chatMatchesPublicQuery
  | _inboxMatchesPublicQuery
  | _purposeMatchesPublicQuery
  | _partnerCycleHasNoPrimaryEventId
  | _partnerPredictionHasNoProbabilityLabel
  | _partnerPredictionHasNoSnapshotId;
