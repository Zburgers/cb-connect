import type { FunctionReference } from "convex/server";
import type { MobileAccessContextDTO } from "@cb-connect/contracts";
type BackendApi = typeof import("../../../../convex/_generated/api.js").api;

export declare const api: {
  readonly queries: {
    readonly history: {
      readonly getPeriodHistory: typeof import("../../../../convex/_generated/api.js").api.queries.history.getPeriodHistory;
      readonly getPainHistory: typeof import("../../../../convex/_generated/api.js").api.queries.history.getPainHistory;
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
    readonly periods: Pick<BackendApi["mutations"]["periods"], "logPeriodStart" | "logPeriodEnd" | "assistLogPeriodStart" | "assistLogPeriodEnd" | "correctAssistedPeriodEvent" | "updatePeriodEvent">;
    readonly painLog: Pick<BackendApi["mutations"]["painLog"], "createOrUpdatePainLog">;
  };
};
