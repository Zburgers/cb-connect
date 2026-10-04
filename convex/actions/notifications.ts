"use node";
import { internalAction } from "../_generated/server";

export const sendDailyPredictions = internalAction({
  // Keep the cron entry point for compatibility; queued ticks cannot dispatch
  // legacy external health notifications after the Gate 4 cutover.
  handler: async () => null,
});
