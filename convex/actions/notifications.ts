"use node";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

export const sendDailyPredictions = internalAction({
  handler: async (ctx) => {
    const allUsers = await ctx.runQuery(internal.queries.users.getAllPrimaryUsers);

    for (const user of allUsers) {
      try {
        const predictionData = await ctx.runQuery(
          internal.queries.history.getPredictionInputsForUser,
          {
            userId: user._id,
          }
        );

        if (
          !user.externalNotificationConsent ||
          !predictionData ||
          predictionData.cycleInfo.daysUntilNextPeriod !== 3
        ) {
          continue;
        }

        await ctx.runAction(internal.actions.discord.sendDiscordNotification, {
          userId: user._id,
          type: "period_prediction",
          message: `Your period is predicted to start in 3 days (${predictionData.cycleInfo.predictedNextPeriodStart}).`,
        });
      } catch (error) {
        console.error(`Error checking predictions for user ${user._id}:`, error);
      }
    }
  },
});
