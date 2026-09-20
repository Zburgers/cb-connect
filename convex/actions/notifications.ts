"use node";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { getDailyPredictionNotificationMessage } from "../_helpers/notificationPrediction";

export const sendDailyPredictions = internalAction({
  handler: async (ctx) => {
    const allUsers = await ctx.runQuery(internal.queries.users.getAllPrimaryUsers);

    for (const user of allUsers) {
      try {
        if (!user.externalNotificationConsent) continue;

        const hasConsent = await ctx.runQuery(
          internal.queries.users.hasExternalNotificationConsent,
          { userId: user._id },
        );
        if (!hasConsent) continue;

        const predictionData = await ctx.runQuery(
          internal.queries.history.getPredictionInputsForUser,
          {
            userId: user._id,
          }
        );

        if (!predictionData) continue;

        const message = getDailyPredictionNotificationMessage(predictionData);
        if (!message) continue;

        const stillHasConsent = await ctx.runQuery(
          internal.queries.users.hasExternalNotificationConsent,
          { userId: user._id },
        );
        if (!stillHasConsent) continue;

        await ctx.runAction(internal.actions.discord.sendDiscordNotification, {
          userId: user._id,
          type: "period_prediction",
          message,
        });
      } catch (error) {
        console.error(`Error checking predictions for user ${user._id}:`, error);
      }
    }
  },
});
