import type { api } from "../../convex/api";

export declare const loggingApi: {
  readonly history: Pick<typeof api["queries"]["history"], "getPeriodHistory" | "getPainHistory">;
  readonly periods: Pick<typeof api["mutations"]["periods"],
    | "logPeriodStart"
    | "assistLogPeriodStart"
    | "logPeriodEnd"
    | "assistLogPeriodEnd"
    | "updatePeriodEvent"
    | "correctAssistedPeriodEvent"
  >;
  readonly painLog: Pick<typeof api["mutations"]["painLog"], "createOrUpdatePainLog">;
};
