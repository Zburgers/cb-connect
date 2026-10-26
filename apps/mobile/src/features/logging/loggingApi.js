import { api } from "../../convex/api";

export const loggingApi = {
  history: {
    getPeriodHistory: api.queries.history.getPeriodHistory,
    getPainHistory: api.queries.history.getPainHistory,
  },
  periods: {
    logPeriodStart: api.mutations.periods.logPeriodStart,
    assistLogPeriodStart: api.mutations.periods.assistLogPeriodStart,
    logPeriodEnd: api.mutations.periods.logPeriodEnd,
    assistLogPeriodEnd: api.mutations.periods.assistLogPeriodEnd,
    updatePeriodEvent: api.mutations.periods.updatePeriodEvent,
    correctAssistedPeriodEvent: api.mutations.periods.correctAssistedPeriodEvent,
  },
  painLog: {
    createOrUpdatePainLog: api.mutations.painLog.createOrUpdatePainLog,
  },
};
