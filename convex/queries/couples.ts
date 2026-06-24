import { query } from "../_generated/server";
import { getCurrentUserOrNull } from "../_helpers/auth";

export const getCoupleStatus = query({
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      return { isLinked: false, partner: null, activePairingCode: null };
    }

    const membership = await ctx.db
      .query("coupleMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!membership) {
      return { isLinked: false };
    }

    const couple = await ctx.db.get(membership.coupleId);
    if (!couple || couple.status === "revoked") {
      return { isLinked: false };
    }

    const partnerMembership = await ctx.db
      .query("coupleMembers")
      .withIndex("by_couple", (q) => q.eq("coupleId", membership.coupleId))
      .filter((q) => q.neq(q.field("userId"), user._id))
      .first();

    let partnerInfo = null;
    let sharingMembership = membership;
    if (partnerMembership) {
      const partnerUser = await ctx.db.get(partnerMembership.userId);
      const partnerPreferredName = getDisplayFallback(partnerUser);
      const displayName = membership.partnerNickname || partnerPreferredName;
      partnerInfo = {
        name: partnerPreferredName,
        accountName: partnerUser?.name ?? null,
        displayName,
        nickname: membership.partnerNickname ?? null,
        email: partnerUser?.email,
        imageUrl: partnerUser?.imageUrl ?? null,
      };
    }

    if (membership.role === "partner") {
      const primaryMembership = await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role", (q) =>
          q.eq("coupleId", membership.coupleId).eq("role", "primary")
        )
        .first();

      if (primaryMembership) {
        sharingMembership = primaryMembership;
      }
    }

    // Get active pairing code if pending
    let activePairingCode = null;
    if (couple.status === "pending") {
      const code = await ctx.db
        .query("pairingCodes")
        .withIndex("by_couple", (q) => q.eq("coupleId", membership.coupleId))
        .filter((q) => q.eq(q.field("status"), "active"))
        .first();
      if (code && code.expiresAt > Date.now()) {
        activePairingCode = { code: code.code, expiresAt: code.expiresAt };
      }
    }

    return {
      isLinked: couple.status === "active",
      status: couple.status,
      role: membership.role,
      linkedAt: couple.linkedAt ?? null,
      connectedSinceDate: couple.connectedSinceDate ?? null,
      anniversary: getAnniversaryMoment(couple.connectedSinceDate ?? null),
      sharingSettings: {
        pain: sharingMembership.sharingPain,
        phase: sharingMembership.sharingPhase,
        periodWrite: sharingMembership.sharingPeriodWrite ?? false,
      },
      partner: partnerInfo,
      activePairingCode,
    };
  },
});

function getAnniversaryMoment(connectedSinceDate: string | null) {
  if (!connectedSinceDate) {
    return null;
  }

  const start = parseDateParts(connectedSinceDate);
  const today = parseDateParts(new Date().toISOString().slice(0, 10));
  if (!start || !today) {
    return null;
  }

  const monthDelta = (today.year - start.year) * 12 + (today.month - start.month);
  if (monthDelta <= 0 || today.day !== start.day) {
    return null;
  }

  const years = Math.floor(monthDelta / 12);
  const months = monthDelta % 12;
  const label =
    years > 0 && months > 0
      ? `${years} ${years === 1 ? "year" : "years"} ${months} ${months === 1 ? "month" : "months"}`
      : years > 0
        ? `${years} ${years === 1 ? "year" : "years"}`
        : `${months} ${months === 1 ? "month" : "months"}`;

  return {
    months: monthDelta,
    label,
    headline: `Happy ${label}`,
    body: "Let them know you are thinking of them today.",
  };
}

function parseDateParts(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

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
