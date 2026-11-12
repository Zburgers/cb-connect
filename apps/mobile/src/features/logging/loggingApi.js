import { api } from "../../convex/api";

export const loggingApi = {
  history: {
    getPeriodHistory: api.queries.history.getPeriodHistory,
    getPainHistory: api.queries.history.getPainHistory,
    getTimelineHistory: api.queries.history.getTimelineHistory,
  },
  periods: {
    logPeriodStart: api.mutations.periods.logPeriodStart,
    assistLogPeriodStart: api.mutations.periods.assistLogPeriodStart,
    logPeriodEnd: api.mutations.periods.logPeriodEnd,
    assistLogPeriodEnd: api.mutations.periods.assistLogPeriodEnd,
    updatePeriodEvent: api.mutations.periods.updatePeriodEvent,
    correctAssistedPeriodEvent: api.mutations.periods.correctAssistedPeriodEvent,
    deletePeriodEvent: api.mutations.periods.deletePeriodEvent,
  },
  painLog: {
    createOrUpdatePainLog: api.mutations.painLog.createOrUpdatePainLog,
  },
};
