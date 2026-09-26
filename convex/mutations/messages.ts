import { v } from "convex/values";
import { mutation } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getActiveCoupleSpace } from "../_helpers/coupleSpace";

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
    const { user, couple, membership, partnerMembership, relationshipMembershipId } =
      await getActiveCoupleSpace(ctx);
    const body = sanitizeMessage(args.body);
    const now = Math.max(Date.now(), (couple.chatClearedAt ?? 0) + 1);

    const recipientState = await ctx.db
      .query("coupleChatStates")
      .withIndex("by_couple_and_user", (q) =>
        q.eq("coupleId", membership.coupleId).eq("userId", partnerMembership.userId)
      )
      .first();
    const sequenceBase = recipientState?.lastMessageSequence ?? recipientState?.unreadCount ?? 0;
    const legacySequenceBase =
      recipientState?.legacySequenceBase ??
      (recipientState?.lastMessageSequence === undefined ? sequenceBase : 0);
    const legacyUnreadCount =
      recipientState?.legacyUnreadCount ??
      (recipientState?.lastMessageSequence === undefined ? recipientState?.unreadCount ?? 0 : 0);
    const sequence = sequenceBase + 1;
    const messageId = await ctx.db.insert("coupleMessages", {
      coupleId: membership.coupleId,
      relationshipMembershipId,
      senderId: user._id,
      body,
      createdAt: now,
      recipientSequence: sequence,
    });
    if (recipientState) {
      await ctx.db.patch(recipientState._id, {
        lastMessageSequence: sequence,
        legacySequenceBase,
        legacyUnreadCount,
        unreadCount:
          legacyUnreadCount +
          Math.max(0, sequence - Math.max(recipientState.lastReadSequence ?? 0, legacySequenceBase)),
      });
    } else {
      await ctx.db.insert("coupleChatStates", {
        coupleId: membership.coupleId,
        userId: partnerMembership.userId,
        unreadCount: 1,
        lastMessageSequence: sequence,
        lastReadSequence: 0,
        legacySequenceBase: 0,
        legacyUnreadCount: 0,
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
    const { user, couple, membership, relationshipStartedAt, relationshipMembershipId } =
      await getActiveCoupleSpace(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    assertCurrentRelationshipMessage(
      message,
      membership.coupleId,
      relationshipMembershipId,
      relationshipStartedAt,
      couple.chatClearedAt,
    );
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

export const markReadThrough = mutation({
  args: { messageId: v.id("coupleMessages") },
  handler: async (ctx, args) => {
    const { user, couple, membership, relationshipStartedAt, relationshipMembershipId } =
      await getActiveCoupleSpace(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    assertCurrentRelationshipMessage(
      message,
      membership.coupleId,
      relationshipMembershipId,
      relationshipStartedAt,
      couple.chatClearedAt,
    );
    if (message.senderId === user._id) throw new Error("Cannot acknowledge your own message");
    const now = Date.now();
    const latestLegacyUnread = message.recipientSequence === undefined
      ? await ctx.db
          .query("coupleMessages")
          .withIndex("by_couple_sender_sequence_read_created", (q) =>
            q
              .eq("coupleId", message.coupleId)
              .eq("senderId", message.senderId)
              .eq("recipientSequence", undefined)
              .eq("readAt", undefined)
              .eq("clearedAt", undefined)
          )
          .order("desc")
          .first()
      : null;
    if (!message.deliveredAt || !message.readAt) {
      await ctx.db.patch(message._id, {
        deliveredAt: message.deliveredAt ?? now,
        readAt: message.readAt ?? now,
      });
    }
    const state = await ctx.db
      .query("coupleChatStates")
      .withIndex("by_couple_and_user", (q) => q.eq("coupleId", message.coupleId).eq("userId", user._id))
      .first();
    if (message.recipientSequence === undefined) {
      if (state) {
        const isLatestLegacyUnread = latestLegacyUnread?._id === message._id;
        const legacySequenceBase =
          state.legacySequenceBase ??
          (state.lastMessageSequence === undefined ? state.unreadCount : 0);
        const legacyUnreadCount =
          state.legacyUnreadCount ??
          (state.lastMessageSequence === undefined ? state.unreadCount : 0);
        const canDecrementLegacyUnread =
          state.lastMessageSequence === undefined ||
          (state.lastReadSequence ?? 0) < legacySequenceBase;
        const nextLegacyUnreadCount = canDecrementLegacyUnread
          ? isLatestLegacyUnread
            ? 0
            : Math.max(0, legacyUnreadCount - (message.readAt === undefined ? 1 : 0))
          : 0;
        const sequenceUnread = Math.max(
          0,
          (state.lastMessageSequence ?? 0) -
            Math.max(state.lastReadSequence ?? 0, legacySequenceBase),
        );
        await ctx.db.patch(state._id, {
          legacyUnreadCount: nextLegacyUnreadCount,
          legacyReadThroughAt: isLatestLegacyUnread
            ? Math.max(state.legacyReadThroughAt ?? 0, message.createdAt)
            : state.legacyReadThroughAt,
          unreadCount:
            state.lastMessageSequence === undefined
              ? nextLegacyUnreadCount
              : nextLegacyUnreadCount + sequenceUnread,
          lastReadAt: Math.max(state.lastReadAt ?? 0, message.createdAt),
          lastDeliveredAt: Math.max(state.lastDeliveredAt ?? 0, message.createdAt),
        });
      }
    } else if (state) {
      const lastReadSequence = state.lastReadSequence ?? 0;
      if (message.recipientSequence > lastReadSequence) {
        const legacySequenceBase = state.legacySequenceBase ?? 0;
        await ctx.db.patch(state._id, {
          lastReadSequence: message.recipientSequence,
          legacySequenceBase,
          legacyUnreadCount: 0,
          unreadCount: Math.max(
            0,
            (state.lastMessageSequence ?? message.recipientSequence) -
              Math.max(message.recipientSequence, legacySequenceBase),
          ),
          lastReadAt: Math.max(state.lastReadAt ?? 0, message.createdAt),
          lastDeliveredAt: Math.max(state.lastDeliveredAt ?? 0, message.createdAt),
        });
      }
    } else {
      await ctx.db.insert("coupleChatStates", {
        coupleId: message.coupleId,
        userId: user._id,
        unreadCount: 0,
        lastReadAt: message.createdAt,
        lastDeliveredAt: message.createdAt,
        lastMessageSequence: message.recipientSequence,
        lastReadSequence: message.recipientSequence,
        legacySequenceBase: 0,
        legacyUnreadCount: 0,
      });
    }
    return { readAt: message.readAt ?? now };
  },
});

export const markRead = markReadThrough;

export const react = mutation({
  args: {
    messageId: v.id("coupleMessages"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, couple, membership, relationshipStartedAt, relationshipMembershipId } =
      await getActiveCoupleSpace(ctx);
    if (!ALLOWED_REACTIONS.has(args.emoji)) {
      throw new Error("Unsupported reaction");
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }
    assertCurrentRelationshipMessage(
      message,
      membership.coupleId,
      relationshipMembershipId,
      relationshipStartedAt,
      couple.chatClearedAt,
    );

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
    const { user, couple, membership, partnerMembership } =
      await getActiveCoupleSpace(ctx);
    const now = Math.max(Date.now(), (couple.chatClearedAt ?? 0) + 1);
    await ctx.db.patch(couple._id, { chatClearedAt: now });
    const states = await Promise.all(
      [user._id, partnerMembership.userId].map((userId) =>
        ctx.db
          .query("coupleChatStates")
          .withIndex("by_couple_and_user", (q) =>
            q.eq("coupleId", membership.coupleId).eq("userId", userId)
          )
          .unique()
      )
    );
    for (const state of states) {
      if (state) {
        await ctx.db.patch(state._id, {
          unreadCount: 0,
          lastReadSequence: state.lastMessageSequence ?? state.lastReadSequence,
          legacyUnreadCount: 0,
          legacyReadThroughAt: now,
          lastReadAt: now,
        });
      }
    }

    await ctx.db.insert("notificationLog", {
      userId: partnerMembership.userId,
      type: "partner_chat_cleared",
      payload: {
        clearedBy: user.preferredName || user.name,
      },
      sentAt: now,
      status: "sent",
    });

    return { clearedAt: now };
  },
});

function assertCurrentRelationshipMessage(
  message: {
    coupleId: Id<"couples">;
    createdAt: number;
    clearedAt?: number;
    relationshipMembershipId?: Id<"coupleMembers">;
  },
  coupleId: Id<"couples">,
  relationshipMembershipId: Id<"coupleMembers">,
  relationshipStartedAt: number,
  chatClearedAt?: number,
) {
  if (
    message.coupleId !== coupleId ||
    message.clearedAt !== undefined ||
    (chatClearedAt !== undefined && message.createdAt <= chatClearedAt) ||
    (message.relationshipMembershipId !== relationshipMembershipId &&
      !(
        message.relationshipMembershipId === undefined &&
        message.createdAt > relationshipStartedAt
      ))
  ) {
    throw new Error("Message not found");
  }
}
