import type { FunctionReference } from "convex/server";
import type {
  MobileAccessContextDTO,
  NotificationInboxItemDTO,
  NotificationPurpose,
} from "@cb-connect/contracts";

type InboxPaginationArgs = {
  paginationOpts: {
    numItems: number;
    cursor: string | null;
    endCursor?: string | null;
    id?: string | null;
  };
};
type NotificationPreferences = ReadonlyArray<{
  purpose: NotificationPurpose;
  inAppEnabled: boolean;
  localReminderTime?: string;
}>;
type UserProfile = {
  _id: string;
  role?: "primary" | "partner";
  preferredName?: string;
  timeZone?: string;
} | null;
type CoupleStatus = {
  isLinked: boolean;
  sharingSettings?: { pain: boolean; phase: boolean; periodWrite: boolean };
};
type InboxPage = {
  page: NotificationInboxItemDTO[];
  continueCursor: string;
  isDone: boolean;
  pageStatus?: "SplitRequired";
  splitCursor?: string;
};

export declare const api: {
  readonly queries: {
    readonly mobileAccess: {
      readonly getGuardState: FunctionReference<
        "query",
        "public",
        Record<string, never>,
        MobileAccessContextDTO
      >;
    };
    readonly notifications: {
      readonly getMyInbox: FunctionReference<
        "query",
        "public",
        InboxPaginationArgs,
        InboxPage
      >;
      readonly getMyPreferences: FunctionReference<
        "query",
        "public",
        Record<string, never>,
        NotificationPreferences
      >;
    };
    readonly users: {
      readonly getMe: FunctionReference<
        "query",
        "public",
        Record<string, never>,
        UserProfile
      >;
    };
    readonly couples: {
      readonly getCoupleStatus: FunctionReference<
        "query",
        "public",
        Record<string, never>,
        CoupleStatus
      >;
    };
    readonly history: {
      readonly getCycleSettings: FunctionReference<
        "query",
        "public",
        Record<string, never>,
        { cycleLength: number; periodLength: number; predictionPaused: boolean }
      >;
      readonly getPredictionSegmentOptions: FunctionReference<
        "query",
        "public",
        Record<string, never>,
        { activeStartDate: string | null; eligibleStartDates: readonly string[] } | null
      >;
    };
  };
  readonly mutations: {
    readonly notifications: {
      readonly markMyInboxItemRead: FunctionReference<
        "mutation",
        "public",
        { itemId: string },
        null
      >;
      readonly dismissMyInboxItem: FunctionReference<
        "mutation",
        "public",
        { itemId: string },
        null
      >;
      readonly setMyPreference: FunctionReference<
        "mutation",
        "public",
        { purpose: NotificationPurpose; inAppEnabled: boolean; localReminderTime?: string | null },
        { purpose: NotificationPurpose; inAppEnabled: boolean; localReminderTime?: string }
      >;
    };
    readonly users: {
      readonly updateUserTimeZone: FunctionReference<
        "mutation",
        "public",
        { timeZone: string },
        string
      >;
      readonly updateUserPreferences: FunctionReference<
        "mutation",
        "public",
        { preferredName?: string },
        string
      >;
    };
    readonly periods: {
      readonly updateCycleSettings: FunctionReference<
        "mutation",
        "public",
        { predictionPaused?: boolean },
        null
      >;
    };
    readonly cycleContext: {
      readonly createPredictionSegment: FunctionReference<
        "mutation",
        "public",
        { startDate: string },
        { segmentId: string }
      >;
    };
    readonly couples: {
      readonly updateSharingSettings: FunctionReference<
        "mutation",
        "public",
        { sharingPain?: boolean; sharingPhase?: boolean; sharingPeriodWrite?: boolean },
        { success: true }
      >;
    };
  };
};
