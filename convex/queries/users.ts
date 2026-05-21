import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrNull } from "../_helpers/auth";

export const getMe = query({
  handler: async (ctx) => {
    return await getCurrentUserOrNull(ctx);
  },
});

export const getAllPrimaryUsers = internalQuery({
  handler: async (ctx) => {
    const users = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "primary"))
      .collect();

    return users.map((user) => ({
      _id: user._id,
      name: user.name,
      externalNotificationConsent: user.externalNotificationConsent ?? false,
    }));
  },
});

export const getMyNotificationLog = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      return [];
    }

    const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);
    const logs = await ctx.db
      .query("notificationLog")
      .withIndex("by_user_and_sent_at", (q) =>
        q.eq("userId", user._id)
      )
      .order("desc")
      .take(limit);

    return logs.map((entry) => ({
      _id: entry._id,
      type: entry.type,
      sentAt: entry.sentAt,
      status: entry.status,
      errorMessage: entry.errorMessage,
      payloadPreview: summarizeNotificationPayload(entry.payload),
    }));
  },
});

function summarizeNotificationPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return { kind: typeof payload };
  }

  const record = payload as Record<string, unknown>;
  const message = record.message;
  return {
    kind: "object",
    keys: Object.keys(record),
    message: typeof message === "string" ? message : undefined,
  };
}
