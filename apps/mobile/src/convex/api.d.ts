import type { FunctionReference, PaginationOptions, PaginationResult } from "convex/server";
import type { CycleState } from "../../../../convex/_helpers/cycleState";
import type { PartnerCycleProjection } from "../../../../convex/_helpers/partnerCycleProjection";
import type {
  CycleCapabilities,
  CycleFactCertainty,
  MobileAccessContextDTO,
  NotificationInboxItemDTO,
  NotificationPurpose,
  PartnerPredictionV2,
  PrimaryPredictionV2,
} from "@cb-connect/contracts";

type InboxPaginationArgs = { paginationOpts: PaginationOptions };
type InboxPage = PaginationResult<NotificationInboxItemDTO>;
type PeriodMutationCertainty = "exact" | "approximate";
type CycleFactReadLabel = "exact" | "approximate" | "legacy_unknown";
type CycleDashboardData = {
  hasData: boolean;
  isPartnerView: boolean;
  message?: string;
  cycleStateV1: CycleState | PartnerCycleProjection | null;
  cycleStateV1Exposed: boolean;
  periodPredictionV2?: PrimaryPredictionV2;
  partnerPredictionV2?: PartnerPredictionV2;
  partnerPredictionV2Exposed: boolean;
  partnerPredictionV2CanEnsureSnapshot: boolean;
  cycleInfo?: {
    phase: "menstruation" | "follicular" | "ovulation" | "luteal";
    cycleDay: number;
    daysUntilNextPeriod: number;
    predictedNextPeriodStart: string;
    predictedNextPeriodEnd: string;
    phaseDescription: string;
  } | null;
  nutritionTipsPhase: "menstruation" | "follicular" | "ovulation" | "luteal" | null;
  painData?: {
    score: number;
    severity: "none" | "mild" | "moderate" | "severe";
    tags?: readonly ("cramps" | "headache" | "back" | "fatigue" | "other")[];
    note?: string;
  } | null;
  painTip?: {
    _id: string;
    _creationTime: number;
    phase: "menstruation" | "follicular" | "ovulation" | "luteal";
    painSeverity: "none" | "mild" | "moderate" | "severe";
    title: string;
    suggestions: string[];
    safetyNote: string;
    isActive: boolean;
    priority: number;
  } | null;
  nutritionTips?: readonly {
    _id: string;
    _creationTime: number;
    phase: "menstruation" | "follicular" | "ovulation" | "luteal";
    foodItem: string;
    reasoning: string;
    isActive: boolean;
    priority: number;
  }[];
};
type PeriodHistory = Readonly<{
  _id?: string;
  authorityVersion?: number;
  startDate: string;
  endDate?: string;
  startCertainty?: CycleFactCertainty;
  endCertainty?: CycleFactCertainty;
  certainty: CycleFactReadLabel;
  source: "self" | "partner_assist" | "system";
  confirmationStatus: "confirmed" | "unreviewed";
  createdByName: string;
  updatedByName: string;
  createdByViewer: boolean;
  updatedByViewer: boolean;
  canCorrect: boolean;
  predictionSegmentStartDate?: string;
  createdByUserId?: string;
  updatedByUserId?: string;
}>;
type PainHistory = Readonly<{
  _id: string;
  _creationTime: number;
  userId: string;
  date: string;
  painScore: number;
  tags: readonly ("cramps" | "headache" | "back" | "fatigue" | "other")[];
  note?: string;
  createdAt: number;
  updatedAt: number;
}>;
type PeriodStartArgs = Readonly<{
  startDate: string;
  timeZone?: string;
  startCertainty?: PeriodMutationCertainty;
}>;
type AssistedPeriodStartArgs = Readonly<{ startDate: string; startCertainty?: PeriodMutationCertainty }>;
type PeriodEndArgs = Readonly<{
  endDate: string;
  timeZone?: string;
  endCertainty?: PeriodMutationCertainty;
  periodEventId?: string;
  expectedAuthorityVersion?: number;
}>;
type AssistedPeriodEndArgs = Readonly<{
  endDate: string;
  endCertainty?: PeriodMutationCertainty;
  periodEventId?: string;
  expectedAuthorityVersion?: number;
}>;
type PeriodCorrectionArgs = Readonly<{
  periodEventId: string;
  expectedAuthorityVersion?: number;
  startDate: string;
  endDate?: string;
  timeZone?: string;
  startCertainty?: PeriodMutationCertainty;
  endCertainty?: PeriodMutationCertainty;
  promoteStartCertainty?: boolean;
  promoteEndCertainty?: boolean;
}>;
type AssistedPeriodCorrectionArgs = Readonly<{
  periodEventId: string;
  expectedAuthorityVersion: number;
  startDate: string;
  endDate?: string;
  endCertainty?: PeriodMutationCertainty;
  promoteStartCertainty?: boolean;
  promoteEndCertainty?: boolean;
}>;
type MobileMessage = {
  _id: string;
  body: string;
  createdAt: number;
  senderName: string;
  senderImageUrl: string | null;
  isMine: boolean;
  deliveredAt: number | null;
  readAt: number | null;
  reactions: { emoji: string; count: number; isMine: boolean }[];
};
type CoupleStatus = {
  isLinked: boolean;
  status?: "pending" | "active" | "revoked";
  role?: "primary" | "partner";
  linkedAt?: number | null;
  connectedSinceDate?: string | null;
  anniversary?: { months: number; label: string; headline: string; body: string } | null;
  relationshipGeneration?: string | null;
  sharingSettings?: { pain: boolean; phase: boolean; periodWrite: boolean } | null;
  partner?: {
    name?: string;
    accountName?: string | null;
    displayName?: string | null;
    nickname?: string | null;
    email?: string;
    imageUrl?: string | null;
  } | null;
  activePairingCode?: { code: string; expiresAt: number } | null;
};

export declare const api: {
  readonly queries: {
    readonly dashboard: {
      readonly getDashboardData: FunctionReference<"query", "public", { todayDate?: string }, CycleDashboardData>;
    };
    readonly capabilities: {
      readonly getCapabilities: FunctionReference<"query", "public", Record<string, never>, CycleCapabilities>;
    };
    readonly mobileAccess: {
      readonly getGuardState: FunctionReference<"query", "public", Record<string, never>, MobileAccessContextDTO>;
    };
    readonly notifications: {
      readonly getMyInboxAvailability: FunctionReference<"query", "public", Record<string, never>, boolean>;
      readonly getMyInbox: FunctionReference<"query", "public", InboxPaginationArgs, InboxPage>;
      readonly getMyPreferences: FunctionReference<"query", "public", Record<string, never>, ReadonlyArray<{
        purpose: NotificationPurpose;
        inAppEnabled: boolean;
        localReminderTime?: string;
      }>>;
    };
    readonly messages: {
      readonly listPageForMobile: FunctionReference<"query", "public", {
        paginationOpts: PaginationOptions;
        relationshipGeneration: string;
      }, PaginationResult<MobileMessage>>;
    };
    readonly nudges: {
      readonly latestReceived: FunctionReference<"query", "public", Record<string, never>, {
        _id: string; emoji: string; message: string; createdAt: number; senderName: string;
      } | null>;
    };
    readonly presence: {
      readonly getPartnerPresence: FunctionReference<"query", "public", Record<string, never>, {
        isPresent: boolean; lastSeen: number; expiresAt: number;
      } | null>;
    };
    readonly users: {
      readonly getMe: FunctionReference<"query", "public", Record<string, never>, {
        _id: string;
        role?: "primary" | "partner";
        preferredName?: string;
        timeZone?: string;
      } | null>;
    };
    readonly couples: {
      readonly getCoupleStatus: FunctionReference<"query", "public", Record<string, never>, CoupleStatus>;
    };
    readonly history: {
      readonly getCycleSettings: FunctionReference<"query", "public", Record<string, never>, {
        cycleLength: number; periodLength: number; predictionPaused: boolean;
      }>;
      readonly getPredictionSegmentOptions: FunctionReference<"query", "public", Record<string, never>, {
        activeStartDate: string | null; eligibleStartDates: readonly string[];
      } | null>;
      readonly getPeriodHistory: FunctionReference<"query", "public", Record<string, never>, readonly PeriodHistory[]>;
      readonly getPainHistory: FunctionReference<"query", "public", { startDate: string; endDate: string }, readonly PainHistory[]>;
    };
  };
  readonly mutations: {
    readonly predictionSnapshots: {
      readonly ensureForViewer: FunctionReference<"mutation", "public", Record<string, never>, null>;
    };
    readonly notifications: {
      readonly markMyInboxItemRead: FunctionReference<"mutation", "public", { itemId: string }, null>;
      readonly dismissMyInboxItem: FunctionReference<"mutation", "public", { itemId: string }, null>;
      readonly setMyPreference: FunctionReference<"mutation", "public", {
        purpose: NotificationPurpose; inAppEnabled: boolean; localReminderTime?: string | null;
      }, { purpose: NotificationPurpose; inAppEnabled: boolean; localReminderTime?: string }>;
    };
    readonly users: {
      readonly ensureUser: FunctionReference<"mutation", "public", Record<string, never>, string>;
      readonly updateUserRole: FunctionReference<"mutation", "public", { role: "primary" | "partner" }, string>;
      readonly updateUserTimeZone: FunctionReference<"mutation", "public", { timeZone: string }, string>;
      readonly updateUserPreferences: FunctionReference<"mutation", "public", { preferredName?: string }, string>;
    };
    readonly periods: {
      readonly updateCycleSettings: FunctionReference<"mutation", "public", { predictionPaused?: boolean }, null>;
      readonly logPeriodStart: FunctionReference<"mutation", "public", PeriodStartArgs, { eventId: string }>;
      readonly assistLogPeriodStart: FunctionReference<"mutation", "public", AssistedPeriodStartArgs, { eventId: string }>;
      readonly logPeriodEnd: FunctionReference<"mutation", "public", PeriodEndArgs, { eventId: string }>;
      readonly assistLogPeriodEnd: FunctionReference<"mutation", "public", AssistedPeriodEndArgs, { eventId: string }>;
      readonly updatePeriodEvent: FunctionReference<"mutation", "public", PeriodCorrectionArgs, { success: true }>;
      readonly correctAssistedPeriodEvent: FunctionReference<"mutation", "public", AssistedPeriodCorrectionArgs, { eventId: string }>;
    };
    readonly cycleContext: {
      readonly createPredictionSegment: FunctionReference<"mutation", "public", { startDate: string }, { segmentId: string }>;
    };
    readonly couples: {
      readonly generatePairingCode: FunctionReference<"action", "public", Record<string, never>, { code: string; expiresAt: number }>;
      readonly linkPartnerWithCode: FunctionReference<"mutation", "public", { code: string },
        { success: true; coupleId: string } | { success: false; error: string }>;
      readonly revokePartnerAccess: FunctionReference<"mutation", "public", Record<string, never>, { success: true }>;
      readonly updateSharingSettings: FunctionReference<"mutation", "public", {
        sharingPain?: boolean; sharingPhase?: boolean; sharingPeriodWrite?: boolean;
      }, { success: true }>;
    };
    readonly messages: {
      readonly send: FunctionReference<"mutation", "public", { body: string }, string>;
      readonly markDelivered: FunctionReference<"mutation", "public", { messageId: string }, { deliveredAt: number }>;
      readonly markReadThrough: FunctionReference<"mutation", "public", { messageId: string }, { readAt: number }>;
      readonly react: FunctionReference<"mutation", "public", { messageId: string; emoji: string },
        { removed: true } | { updated: true } | { created: true }>;
    };
    readonly nudges: {
      readonly send: FunctionReference<"mutation", "public", { emoji: string }, string>;
      readonly markSeen: FunctionReference<"mutation", "public", { nudgeId: string }, null>;
    };
    readonly presence: {
      readonly heartbeat: FunctionReference<"mutation", "public", Record<string, never>, null>;
      readonly goOffline: FunctionReference<"mutation", "public", Record<string, never>, null>;
    };
    readonly painLog: {
      readonly createOrUpdatePainLog: FunctionReference<"mutation", "public", {
        date: string;
        painScore: number;
        tags: readonly ("cramps" | "headache" | "back" | "fatigue" | "other")[];
        note?: string;
        timeZone?: string;
      }, { logId: string; created: boolean }>;
    };
  };
};
