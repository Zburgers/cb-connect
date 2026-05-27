import { v } from "convex/values";
import { query } from "../_generated/server";
import { getActiveCoupleSpace } from "../_helpers/coupleSpace";

export const listForCouple = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user, membership, partnerMembership } = await getActiveCoupleSpace(ctx);
    const limit = Math.min(Math.max(args.limit ?? 80, 1), 120);

    const messages = await ctx.db
      .query("coupleMessages")
      .withIndex("by_couple_created", (q) => q.eq("coupleId", membership.coupleId))
      .order("desc")
      .take(limit);

    const ordered = messages.reverse();
    const reactions = await ctx.db
      .query("coupleMessageReactions")
      .withIndex("by_couple", (q) => q.eq("coupleId", membership.coupleId))
      .collect();

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
        const messageReactions = reactions
          .filter((reaction) => reaction.messageId === message._id)
          .map((reaction) => ({
            _id: reaction._id,
            emoji: reaction.emoji,
            isMine: reaction.userId === user._id,
          }));

        return {
          _id: message._id,
          body: message.body,
          createdAt: message.createdAt,
          senderName,
          senderImageUrl: sender?.imageUrl ?? null,
          isMine,
          reactions: messageReactions,
        };
      })
    );
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
