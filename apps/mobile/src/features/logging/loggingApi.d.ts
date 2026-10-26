import type { FunctionReference } from "convex/server";
import type { CycleFactCertainty } from "@cb-connect/contracts";

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
type StartArgs = Readonly<{ startDate: string; startCertainty?: CycleFactCertainty }>;
type EndArgs = Readonly<{ endDate: string; endCertainty?: CycleFactCertainty; periodEventId?: string; expectedAuthorityVersion?: number }>;
type CorrectionArgs = Readonly<{ periodEventId: string; expectedAuthorityVersion: number; startDate: string; endDate?: string; endCertainty?: CycleFactCertainty }>;

export declare const loggingApi: {
  readonly history: {
    readonly getPeriodHistory: FunctionReference<"query", "public", Record<string, never>, readonly PeriodHistory[]>;
    readonly getPainHistory: FunctionReference<"query", "public", Readonly<{ startDate: string; endDate: string }>, readonly PainHistory[]>;
  };
  readonly periods: {
    readonly logPeriodStart: FunctionReference<"mutation", "public", StartArgs, Readonly<{ eventId: string }>>;
    readonly assistLogPeriodStart: FunctionReference<"mutation", "public", StartArgs, Readonly<{ eventId: string }>>;
    readonly logPeriodEnd: FunctionReference<"mutation", "public", EndArgs, Readonly<{ eventId: string }>>;
    readonly assistLogPeriodEnd: FunctionReference<"mutation", "public", EndArgs, Readonly<{ eventId: string }>>;
    readonly updatePeriodEvent: FunctionReference<"mutation", "public", CorrectionArgs, Readonly<{ success: true }>>;
    readonly correctAssistedPeriodEvent: FunctionReference<"mutation", "public", CorrectionArgs, Readonly<{ eventId: string }>>;
  };
  readonly painLog: {
    readonly createOrUpdatePainLog: FunctionReference<"mutation", "public", Readonly<{ date: string; painScore: number; tags: readonly ("cramps" | "headache" | "back" | "fatigue" | "other")[]; note?: string }>, Readonly<{ logId: string; created: boolean }>>;
  };
};
