"use node";
import { action, internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";

export const sendDailyPredictions = internalAction({
  handler: async (ctx) => {
    const allUsers = await ctx.runQuery(api.queries.users.getAllPrimaryUsers);

    for (const user of allUsers) {
      try {
        // Get their cycle settings
        const cycleSettings = await ctx.runQuery(api.queries.history.getCycleSettings);
        // Note: getCycleSettings uses auth, so for crons we need a different approach
        // For now, just log. We can enhance later.
        console.log(`Would check predictions for user ${user._id}`);
      } catch (error) {
        console.error(`Error checking predictions for user ${user._id}:`, error);
      }
    }
  },
});
