import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";

export const sendDiscordNotification = action({
  args: {
    userId: v.id("users"),
    type: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (!webhookUrl) {
      console.log("Discord webhook URL not configured, skipping notification");
      await ctx.runMutation(api.mutations.misc.logNotification, {
        userId: args.userId,
        type: args.type,
        payload: { message: args.message },
        status: "failed",
        errorMessage: "Discord webhook URL not configured",
      });
      return;
    }

    const colorMap: Record<string, number> = {
      high_pain_logged: 0xff0000,
      partner_linked: 0x00ff00,
      period_prediction: 0x0099ff,
      period_started: 0xff69b4,
    };

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [
            {
              title: `CB Connect - ${args.type.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}`,
              description: args.message,
              color: colorMap[args.type] ?? 0x808080,
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Discord webhook failed: ${response.status}`);
      }

      await ctx.runMutation(api.mutations.misc.logNotification, {
        userId: args.userId,
        type: args.type,
        payload: { message: args.message },
        status: "sent",
      });
    } catch (error: any) {
      console.error("Discord notification error:", error);
      await ctx.runMutation(api.mutations.misc.logNotification, {
        userId: args.userId,
        type: args.type,
        payload: { message: args.message },
        status: "failed",
        errorMessage: error.message,
      });
    }
  },
});
