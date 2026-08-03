import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getActiveCoupleSpace, assertCoupleMember } from "../_helpers/coupleSpace";

const MAX_MESSAGE_LENGTH = 500;
const ALLOWED_REACTIONS = new Set(["💗", "✨", "🫶", "😂", "🥺", "🌙"]);

function sanitizeMessage(body: string) {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (!normalized) {
    throw new Error("Message cannot be empty");
  }
  if (normalized.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message must be ${MAX_MESSAGE_LENGTH} characters or fewer`);
  }
  return normalized;
}

export const send = mutation({
  args: {
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, membership, partnerMembership } = await getActiveCoupleSpace(ctx);
    const body = sanitizeMessage(args.body);
    const now = Date.now();

    const messageId = await ctx.db.insert("coupleMessages", {
      coupleId: membership.coupleId,
      senderId: user._id,
      body,
      createdAt: now,
    });

    const recipientState = await ctx.db
      .query("coupleChatStates")
      .withIndex("by_couple_and_user", (q) =>
        q.eq("coupleId", membership.coupleId).eq("userId", partnerMembership.userId)
      )
      .first();
    if (recipientState) {
      await ctx.db.patch(recipientState._id, { unreadCount: recipientState.unreadCount + 1 });
    } else {
      await ctx.db.insert("coupleChatStates", {
        coupleId: membership.coupleId,
        userId: partnerMembership.userId,
        unreadCount: 1,
      });
    }

    await ctx.db.insert("notificationLog", {
      userId: partnerMembership.userId,
      type: "partner_message",
      payload: {
        messageId,
        senderName: user.preferredName || user.name,
        preview: body.slice(0, 96),
      },
      sentAt: now,
      status: "sent",
    });

    return messageId;
  },
});

export const markDelivered = mutation({
  args: { messageId: v.id("coupleMessages") },
  handler: async (ctx, args) => {
    const { user } = await getActiveCoupleSpace(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    await assertCoupleMember(ctx, message.coupleId, user._id);
    if (message.senderId === user._id) throw new Error("Cannot acknowledge your own message");
    const now = Date.now();
    if (!message.deliveredAt || message.deliveredAt < now) {
      await ctx.db.patch(message._id, { deliveredAt: message.deliveredAt ?? now });
    }
    const state = await ctx.db
      .query("coupleChatStates")
      .withIndex("by_couple_and_user", (q) => q.eq("coupleId", message.coupleId).eq("userId", user._id))
      .first();
    if (state && (!state.lastDeliveredAt || state.lastDeliveredAt < message.createdAt)) {
      await ctx.db.patch(state._id, { lastDeliveredAt: message.createdAt });
    }
    return { deliveredAt: message.deliveredAt ?? now };
  },
});

export const markRead = mutation({
  args: { messageId: v.id("coupleMessages") },
  handler: async (ctx, args) => {
    const { user } = await getActiveCoupleSpace(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    await assertCoupleMember(ctx, message.coupleId, user._id);
    if (message.senderId === user._id) throw new Error("Cannot acknowledge your own message");
    const now = Date.now();
    if (!message.deliveredAt || message.deliveredAt < now) {
      await ctx.db.patch(message._id, { deliveredAt: message.deliveredAt ?? now });
    }
    if (!message.readAt || message.readAt < now) {
      await ctx.db.patch(message._id, { readAt: message.readAt ?? now });
    }
    const state = await ctx.db
      .query("coupleChatStates")
      .withIndex("by_couple_and_user", (q) => q.eq("coupleId", message.coupleId).eq("userId", user._id))
      .first();
    if (state) {
      await ctx.db.patch(state._id, {
        unreadCount: 0,
        lastReadAt: Math.max(state.lastReadAt ?? 0, message.createdAt),
        lastDeliveredAt: Math.max(state.lastDeliveredAt ?? 0, message.createdAt),
      });
    } else {
      await ctx.db.insert("coupleChatStates", {
        coupleId: message.coupleId,
        userId: user._id,
        unreadCount: 0,
        lastReadAt: message.createdAt,
        lastDeliveredAt: message.createdAt,
      });
    }
    return { readAt: message.readAt ?? now };
  },
});

export const react = mutation({
  args: {
    messageId: v.id("coupleMessages"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await getActiveCoupleSpace(ctx);
    if (!ALLOWED_REACTIONS.has(args.emoji)) {
      throw new Error("Unsupported reaction");
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }
    await assertCoupleMember(ctx, message.coupleId, user._id);

    const existing = await ctx.db
      .query("coupleMessageReactions")
      .withIndex("by_message_and_user", (q) =>
        q.eq("messageId", args.messageId).eq("userId", user._id)
      )
      .first();

    if (existing?.emoji === args.emoji) {
      await ctx.db.delete(existing._id);
      return { removed: true };
    }

    if (existing) {
      await ctx.db.patch(existing._id, { emoji: args.emoji, createdAt: Date.now() });
      return { updated: true };
    }

    await ctx.db.insert("coupleMessageReactions", {
      coupleId: message.coupleId,
      messageId: args.messageId,
      userId: user._id,
      emoji: args.emoji,
      createdAt: Date.now(),
    });

    return { created: true };
  },
});

export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    const { user, membership, partnerMembership } = await getActiveCoupleSpace(ctx);
    const messages = await ctx.db
      .query("coupleMessages")
      .withIndex("by_couple_created", (q) => q.eq("coupleId", membership.coupleId))
      .collect();
    const reactions = await ctx.db
      .query("coupleMessageReactions")
      .withIndex("by_couple", (q) => q.eq("coupleId", membership.coupleId))
      .collect();

    for (const reaction of reactions) {
      await ctx.db.delete(reaction._id);
    }
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
    const states = await ctx.db
      .query("coupleChatStates")
      .withIndex("by_couple_and_user", (q) => q.eq("coupleId", membership.coupleId))
      .collect();
    for (const state of states) {
      await ctx.db.patch(state._id, { unreadCount: 0, lastReadAt: Date.now() });
    }

    await ctx.db.insert("notificationLog", {
      userId: partnerMembership.userId,
      type: "partner_chat_cleared",
      payload: {
        clearedBy: user.preferredName || user.name,
      },
      sentAt: Date.now(),
      status: "sent",
    });

    return { deletedMessages: messages.length };
  },
});
