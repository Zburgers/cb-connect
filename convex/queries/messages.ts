import { v } from "convex/values";
import { query } from "../_generated/server";
import { getActiveCoupleSpace } from "../_helpers/coupleSpace";

export const listForCouple = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const {
      user,
      membership,
      partnerMembership,
      couple,
      relationshipStartedAt,
      relationshipMembershipId,
    } =
      await getActiveCoupleSpace(ctx);
    const limit = Math.min(Math.max(args.limit ?? 80, 1), 120);

    const [epochMessages, legacyMessages] = await Promise.all([
      ctx.db
        .query("coupleMessages")
        .withIndex("by_relationship_created", (q) =>
          q
            .eq("coupleId", membership.coupleId)
            .eq("relationshipMembershipId", relationshipMembershipId)
            .gt("createdAt", couple.chatClearedAt ?? 0)
        )
        .filter((q) => q.eq(q.field("clearedAt"), undefined))
        .order("desc")
        .take(limit),
      ctx.db
        .query("coupleMessages")
        .withIndex("by_couple_created", (q) =>
          q
            .eq("coupleId", membership.coupleId)
            .gt("createdAt", Math.max(relationshipStartedAt, couple.chatClearedAt ?? 0))
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("relationshipMembershipId"), undefined),
          )
        )
        .order("desc")
        .take(limit),
    ]);
    const messages = [...epochMessages, ...legacyMessages]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);

    const ordered = messages.reverse();
    return await Promise.all(
      ordered.map(async (message) => {
        const sender = await ctx.db.get(message.senderId);
        const isMine = message.senderId === user._id;
        const isPartner = message.senderId === partnerMembership.userId;
        const senderPreferredName = getDisplayFallback(sender);
        const senderName = isMine
          ? "You"
          : isPartner
            ? membership.partnerNickname || senderPreferredName
            : senderPreferredName;
        const reactions = await ctx.db
          .query("coupleMessageReactions")
          .withIndex("by_message", (q) => q.eq("messageId", message._id))
          .take(20);
        const grouped = new Map<string, { emoji: string; count: number; isMine: boolean }>();
        for (const reaction of reactions) {
          const current = grouped.get(reaction.emoji);
          if (current) {
            current.count += 1;
            current.isMine ||= reaction.userId === user._id;
          } else {
            grouped.set(reaction.emoji, {
              emoji: reaction.emoji,
              count: 1,
              isMine: reaction.userId === user._id,
            });
          }
        }

        return {
          _id: message._id,
          body: message.body,
          createdAt: message.createdAt,
          senderName,
          senderImageUrl: sender?.imageUrl ?? null,
          isMine,
          deliveredAt: message.deliveredAt ?? null,
          readAt: message.readAt ?? null,
          reactions: [...grouped.values()],
        };
      })
    );
  },
});

export const unreadSummary = query({
  args: {},
  handler: async (ctx) => {
    const { membership, user } = await getActiveCoupleSpace(ctx);
    const state = await ctx.db
      .query("coupleChatStates")
      .withIndex("by_couple_and_user", (q) =>
        q.eq("coupleId", membership.coupleId).eq("userId", user._id)
      )
      .first();
    return { unreadCount: state?.unreadCount ?? 0 };
  },
});

function getDisplayFallback(
  user:
    | {
        preferredName?: string;
        name?: string;
        partnerType?: "boyfriend" | "girlfriend" | "spouse" | "partner" | "other";
      }
    | null
    | undefined
) {
  if (user?.preferredName) return user.preferredName;
  if (user?.name && user.name !== "User") return user.name;
  if (user?.partnerType) return relationshipTermLabel(user.partnerType);
  return "Partner";
}

function relationshipTermLabel(term: "boyfriend" | "girlfriend" | "spouse" | "partner" | "other") {
  const labels = {
    boyfriend: "Boyfriend",
    girlfriend: "Girlfriend",
    spouse: "Spouse",
    partner: "Partner",
    other: "Partner",
  };
  return labels[term];
}
