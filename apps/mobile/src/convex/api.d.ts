import type { FunctionReference } from "convex/server";
import type { CycleFactCertainty, MobileAccessContextDTO } from "@cb-connect/contracts";

type PeriodHistory = Readonly<{
  _id?: string;
  authorityVersion?: number;
  startDate: string;
  endDate?: string;
  certainty: string;
  source: "self" | "partner_assist" | "system";
  confirmationStatus: "confirmed" | "unreviewed";
  createdByName: string;
  canCorrect: boolean;
}>;
type PainHistory = Readonly<{
  _id: string;
  date: string;
  painScore: number;
  tags: readonly ("cramps" | "headache" | "back" | "fatigue" | "other")[];
}>;
type PeriodStartArgs = Readonly<{ startDate: string; startCertainty?: CycleFactCertainty; timeZone?: string }>;
type PeriodEndArgs = Readonly<{ endDate: string; endCertainty?: CycleFactCertainty; periodEventId?: string; expectedAuthorityVersion?: number; timeZone?: string }>;
type PeriodCorrectionArgs = Readonly<{ periodEventId: string; expectedAuthorityVersion: number; startDate: string; endDate?: string; endCertainty?: CycleFactCertainty; promoteStartCertainty?: boolean; promoteEndCertainty?: boolean; timeZone?: string }>;

export declare const api: {
  readonly queries: {
    readonly history: {
      readonly getPeriodHistory: FunctionReference<"query", "public", Record<string, never>, readonly PeriodHistory[]>;
      readonly getPainHistory: FunctionReference<"query", "public", Readonly<{ startDate: string; endDate: string }>, readonly PainHistory[]>;
    };
    readonly mobileAccess: {
      readonly getGuardState: FunctionReference<
        "query",
        "public",
        Record<string, never>,
        MobileAccessContextDTO
      >;
    };
  };
  readonly mutations: {
    readonly periods: {
      readonly logPeriodStart: FunctionReference<"mutation", "public", PeriodStartArgs, Readonly<{ eventId: string }>>;
      readonly assistLogPeriodStart: FunctionReference<"mutation", "public", PeriodStartArgs, Readonly<{ eventId: string }>>;
      readonly logPeriodEnd: FunctionReference<"mutation", "public", PeriodEndArgs, Readonly<{ eventId: string }>>;
      readonly assistLogPeriodEnd: FunctionReference<"mutation", "public", PeriodEndArgs, Readonly<{ eventId: string }>>;
      readonly updatePeriodEvent: FunctionReference<"mutation", "public", PeriodCorrectionArgs, Readonly<{ success: true }>>;
      readonly correctAssistedPeriodEvent: FunctionReference<"mutation", "public", PeriodCorrectionArgs, Readonly<{ eventId: string }>>;
    };
    readonly painLog: {
      readonly createOrUpdatePainLog: FunctionReference<"mutation", "public", Readonly<{ date: string; painScore: number; tags: readonly ("cramps" | "headache" | "back" | "fatigue" | "other")[]; note?: string; timeZone?: string }>, Readonly<{ logId: string; created: boolean }>>;
    };
  };
};
