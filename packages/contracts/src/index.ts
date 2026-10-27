/** Version of the mobile-facing DTO boundary. */
export const MOBILE_CONTRACT_VERSION = 1 as const;

export const CYCLE_STATE_STATUS = [
  "recorded_period",
  "estimated",
  "late_or_uncertain",
  "insufficient_data",
  "prediction_paused",
] as const;
export type CycleStateStatus = (typeof CYCLE_STATE_STATUS)[number];

export type CyclePhase =
  | "menstruation"
  | "follicular"
  | "ovulation"
  | "luteal";

export type PredictionQualityState =
  | "high"
  | "moderate"
  | "low"
  | "timing_less_predictable"
  | "limited_evidence";

export type PredictionV2ReasonCode =
  | "ELEVATED_CALIBRATION_RISK"
  | "USER_CONFIGURED_BASELINE"
  | "PERSONALIZATION_NOT_APPROVED"
  | "LIMITED_HISTORY"
  | "INSUFFICIENT_CALIBRATION"
  | "SPARSE_HISTORY"
  | "RECENT_TIMING_VARIABLE"
  | "USER_PAUSED"
  | "NO_ELIGIBLE_FACT"
  | "INVALID_CONFIGURATION"
  | "APPROXIMATE_DATE"
  | "LEGACY_UNKNOWN"
  | "POSSIBLE_MISSING_LOG"
  | "CONTEXT_SEGMENT"
  | "RECENT_CORRECTION"
  | "PARTNER_ASSISTED"
  | "TOMBSTONED"
  | "AFTER_CUTOFF"
  | "INVALID_DATE"
  | "NON_POSITIVE_INTERVAL";

export type LegacyPredictionBoundsV1 = Readonly<{
  version: 1;
  source: "legacy_configured";
  expectedDate: string;
  earliestDate: string;
  latestDate: string;
  reason: "LEGACY_UNCALIBRATED_GRACE";
  basisCount: 1;
}>;

export type PredictionBoundsV2 = Readonly<{
  version: 2;
  source: "period_prediction_v2";
  status: "configured" | "personalized" | "limited_evidence";
  pointDate: string;
  earliestDate: string;
  latestDate: string;
  probabilityLabel: Readonly<{
    level: 80;
    calibrationStatus: "approved";
    calibrationVersion: string;
  }> | null;
  quality: PredictionQualityState;
  basisCount: number;
  estimatorId:
    | "configured_v1"
    | "all_mean_v1"
    | "all_median_v1"
    | "last3_mean_v1"
    | "last3_median_v1"
    | "recency_exp_h3_v1";
  estimatorVersion: number;
  calibrationVersion: string | null;
  reasonCodes: readonly PredictionV2ReasonCode[];
  snapshotId?: string;
}>;

type PrimaryRecordedPeriodState = Readonly<{
  version: 1;
  status: "recorded_period";
  phase: "menstruation";
  evidence: "RECORDED_EXACT";
  cycleDay: number;
  coveringEventId: string;
  reason: "CONFIRMED_EVENT_COVERS_TODAY";
}>;

type PartnerRecordedPeriodState = Omit<
  PrimaryRecordedPeriodState,
  "coveringEventId"
>;

type EstimatedState<Bounds> = Readonly<{
  version: 1;
  status: "estimated";
  phase: CyclePhase;
  evidence: "CALENDAR_ESTIMATE";
  cycleDay: number;
  bounds: Bounds;
  reason: "ELIGIBLE_FACT_WITHIN_LATEST_BOUND";
}>;

type LateState<Bounds> = Readonly<{
  version: 1;
  status: "late_or_uncertain";
  phase: null;
  evidence: "TIMING_UNCERTAINTY";
  cycleDay: null;
  bounds: Bounds;
  reason: "AFTER_LATEST_BOUND";
}>;

type InsufficientDataState = Readonly<{
  version: 1;
  status: "insufficient_data";
  phase: null;
  evidence: "UNAVAILABLE";
  cycleDay: null;
  reason:
    | "NO_ELIGIBLE_FACT"
    | "FUTURE_START"
    | "INVALID_BOUNDS"
    | "MISSING_TIMEZONE";
}>;

type PausedState = Readonly<{
  version: 1;
  status: "prediction_paused";
  phase: null;
  evidence: "USER_PAUSED";
  cycleDay: null;
  reason: "USER_PAUSED";
}>;

/** Primary's private event identity is kept out of the partner projection. */
export type PrimaryCycleStateV1 =
  | PrimaryRecordedPeriodState
  | EstimatedState<LegacyPredictionBoundsV1 | PredictionBoundsV2>
  | LateState<LegacyPredictionBoundsV1 | PredictionBoundsV2>
  | InsufficientDataState
  | PausedState;

export type PartnerCycleStateV1 =
  | PartnerRecordedPeriodState
  | EstimatedState<LegacyPredictionBoundsV1>
  | LateState<LegacyPredictionBoundsV1>
  | InsufficientDataState
  | PausedState;

export type CycleStateV1 = PrimaryCycleStateV1 | PartnerCycleStateV1;

type InactivePeriodPredictionV2 = Readonly<{
  version: 2;
  source: "period_prediction_v2";
  status: "paused" | "unavailable";
  pointDate: null;
  earliestDate: null;
  latestDate: null;
  probabilityLabel: null;
  quality: "limited_evidence";
  basisCount: number;
  estimatorId: "configured_v1";
  estimatorVersion: 1;
  calibrationVersion: null;
  reasonCodes: readonly PredictionV2ReasonCode[];
}>;

export type PrimaryPredictionV2 =
  | PredictionBoundsV2
  | InactivePeriodPredictionV2;

/** Partner prediction intentionally omits primary calibration and probability details. */
export type PartnerPredictionV2 = Readonly<{
  version: 2;
  status: "estimated" | "paused" | "unavailable";
  timingStatus: CycleStateStatus;
  pointDate: string | null;
  earliestDate: string | null;
  latestDate: string | null;
  quality: PredictionQualityState;
  basisBand: "limited" | "broader";
}>;

export type CycleCapabilities = Readonly<{
  cycleFactsV1: boolean;
  cycleStateV1: boolean;
  periodPredictionV2: boolean;
  partnerPredictionV2: boolean;
}>;

export type MobileGuardRole = "primary" | "partner";
export type MobileAccessContextDTO =
  | Readonly<{ user: null; couple: null }>
  | Readonly<{
      user: Readonly<{ role: MobileGuardRole | null }>;
      couple: Readonly<{ isLinked: boolean; role: MobileGuardRole | null }>;
    }>;

export type CalendarDate = string;
export type IanaTimeZone = string;
export type CycleFactCertainty = "exact" | "approximate" | "legacy_unknown";
export type CycleFactProvenance = "self" | "partner_assist" | "system";
export type CycleFactAuthority = Readonly<{
  authorityVersion?: number;
  canCorrect: boolean;
}>;

export type CycleFactHistoryDTO = Readonly<{
  id?: string;
  startDate: CalendarDate;
  endDate?: CalendarDate;
  startCertainty?: CycleFactCertainty;
  endCertainty?: CycleFactCertainty;
  source: CycleFactProvenance;
  confirmationStatus: "confirmed" | "unreviewed";
  certainty: CycleFactCertainty;
  createdByName: string;
  updatedByName: string;
  createdByViewer: boolean;
  updatedByViewer: boolean;
}> & CycleFactAuthority;

export type CoupleChatMessageDTO = Readonly<{
  _id: string;
  body: string;
  createdAt: number;
  senderName: string;
  senderImageUrl: string | null;
  isMine: boolean;
  deliveredAt: number | null;
  readAt: number | null;
  reactions: readonly Readonly<{
    emoji: string;
    count: number;
    isMine: boolean;
  }>[];
}>;
export const MAX_COUPLE_CHAT_MESSAGES = 120;

export type NotificationPurpose =
  | "assisted_period_start"
  | "assisted_period_end"
  | "period_window_approaching"
  | "late_status"
  | "pain_check_in"
  | "partner_linked"
  | "partner_message"
  | "partner_nudge"
  | "partner_chat_cleared"
  | "connected_since_updated";

export type NotificationEventType =
  | "assisted_period_start.v1"
  | "assisted_period_end.v1"
  | "period_window_approaching.v1"
  | "late_status.v1"
  | "pain_check_in.v1"
  | "partner_linked.v1"
  | "partner_message.v1"
  | "partner_nudge.v1"
  | "partner_chat_cleared.v1"
  | "connected_since_updated.v1";

export type NotificationTemplateRoute =
  | "periods"
  | "messages"
  | "pain"
  | "settings";

export type NotificationInboxItemDTO = Readonly<{
  itemId: string;
  eventType: NotificationEventType;
  templateVersion: string;
  route?: NotificationTemplateRoute;
  state: "current";
  createdAt: number;
  readAt?: number;
}>;

export type NotificationInboxPageDTO = Readonly<{
  page: readonly NotificationInboxItemDTO[];
  continueCursor: string;
  isDone: boolean;
  pageStatus?: "SplitRequired";
  splitCursor?: string;
}>;

/** The mobile client only checks date-only syntax; the server validates calendar dates. */
export function isLocalDateInput(value: string): value is CalendarDate {
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value);
}
