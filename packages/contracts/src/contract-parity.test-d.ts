import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
import type {
  PartnerCycleProjection,
  PartnerPredictionV2Projection,
} from "../../../convex/_helpers/partnerCycleProjection";
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
} from "./index";

type Assert<T extends true> = T;
type AssertFalse<T extends false> = T;
type IsAssignable<From, To> = [From] extends [To] ? true : false;
type KeysOfUnion<T> = T extends unknown ? keyof T : never;
type Dashboard = FunctionReturnType<
  typeof api.queries.dashboard.getDashboardData
>;

type _capabilities = Assert<IsAssignable<
  FunctionReturnType<typeof api.queries.capabilities.getCapabilities>,
  CycleCapabilities
>>;
type _cycleState = Assert<IsAssignable<
  NonNullable<Dashboard["cycleStateV1"]>,
  CycleStateV1
>>;
type _partnerCycleStateServerToMobile = Assert<IsAssignable<
  PartnerCycleProjection,
  PartnerCycleStateV1
>>;
type _partnerCycleStateMobileToServer = Assert<IsAssignable<
  PartnerCycleStateV1,
  PartnerCycleProjection
>>;
type _partnerCycleStateKeysServerToMobile = Assert<IsAssignable<
  KeysOfUnion<PartnerCycleProjection>,
  KeysOfUnion<PartnerCycleStateV1>
>>;
type _partnerCycleStateKeysMobileToServer = Assert<IsAssignable<
  KeysOfUnion<PartnerCycleStateV1>,
  KeysOfUnion<PartnerCycleProjection>
>>;
type _primaryPrediction = Assert<IsAssignable<
  NonNullable<Dashboard["periodPredictionV2"]>,
  PrimaryPredictionV2
>>;
type _partnerPrediction = Assert<IsAssignable<
  NonNullable<Dashboard["partnerPredictionV2"]>,
  PartnerPredictionV2
>>;
type _partnerPredictionServerToMobile = Assert<IsAssignable<
  PartnerPredictionV2Projection,
  PartnerPredictionV2
>>;
type _partnerPredictionMobileToServer = Assert<IsAssignable<
  PartnerPredictionV2,
  PartnerPredictionV2Projection
>>;
type _partnerPredictionKeysServerToMobile = Assert<IsAssignable<
  KeysOfUnion<PartnerPredictionV2Projection>,
  KeysOfUnion<PartnerPredictionV2>
>>;
type _partnerPredictionKeysMobileToServer = Assert<IsAssignable<
  KeysOfUnion<PartnerPredictionV2>,
  KeysOfUnion<PartnerPredictionV2Projection>
>>;
type _history = Assert<IsAssignable<
  NonNullable<
    FunctionReturnType<typeof api.queries.history.getTimelineHistory>[number]["period"]
  >,
  CycleFactHistoryDTO
>>;
type _chat = Assert<IsAssignable<
  FunctionReturnType<typeof api.queries.messages.listForCouple>,
  readonly CoupleChatMessageDTO[]
>>;
type _inbox = Assert<IsAssignable<
  FunctionReturnType<typeof api.queries.notifications.getMyInbox>,
  NotificationInboxPageDTO
>>;
type _purpose = Assert<IsAssignable<
  FunctionReturnType<typeof api.queries.notifications.getMyPreferences>[number]["purpose"],
  NotificationPurpose
>>;

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
