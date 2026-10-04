"use node";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";

export const sendDiscordNotification = internalAction({
  args: {
    userId: v.id("users"),
    type: v.string(),
    message: v.string(),
  },
  // Keep this validated action so previously scheduled jobs fail closed.
  // Gate 4 never reactivates the deployment-wide Discord webhook on rollback.
  handler: async () => null,
});
