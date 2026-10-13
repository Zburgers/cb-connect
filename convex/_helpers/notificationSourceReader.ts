import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { addCalendarDays } from "./cycleCalculations";
import {
  requireValidCalendarDate,
  resolveCalendarTimeZone,
  toCalendarDateInTimeZone,
} from "./calendarDates";
import {
  isCurrentNotificationScheduleFence,
  parseSourceAuthorityVersion,
} from "./notificationSourceAuthority";
import { readCurrentNotificationCycleState } from "./notificationCycleState";
import {
  assertValidNotificationEventWrite,
  type NotificationSourceIdentity,
} from "./notificationTypes";

type SourceReaderCtx = QueryCtx | MutationCtx;
type RelationshipIdentity = Extract<
  NotificationSourceIdentity,
  { relationshipMembershipId: Id<"coupleMembers"> }
>;

async function readActiveRelationship(
  ctx: SourceReaderCtx,
  identity: RelationshipIdentity,
) {
  const [couple, primaryRows, partnerRows, owner, recipient] = await Promise.all([
    ctx.db.get(identity.coupleId),
    ctx.db
      .query("coupleMembers")
      .withIndex("by_couple_and_role_and_revoked_at", (q) =>
        q.eq("coupleId", identity.coupleId).eq("role", "primary").eq("revokedAt", undefined),
      )
      .take(2),
    ctx.db
      .query("coupleMembers")
      .withIndex("by_couple_and_role_and_revoked_at", (q) =>
        q.eq("coupleId", identity.coupleId).eq("role", "partner").eq("revokedAt", undefined),
      )
      .take(2),
    ctx.db.get(identity.ownerUserId),
    ctx.db.get(identity.recipientUserId),
  ]);
  if (
    !couple ||
    couple.status !== "active" ||
    primaryRows.length !== 1 ||
    partnerRows.length !== 1 ||
    !owner ||
    !recipient
  ) {
    return null;
  }

  const primaryMembership = primaryRows[0];
  const partnerMembership = partnerRows[0];
  if (
    identity.relationshipMembershipId !== partnerMembership._id ||
    owner.role !== "primary" && owner.role !== "partner" ||
    recipient.role !== "primary" && recipient.role !== "partner" ||
    (owner.role === "primary" ? primaryMembership.userId : partnerMembership.userId) !==
      identity.ownerUserId ||
    (recipient.role === "primary" ? primaryMembership.userId : partnerMembership.userId) !==
      identity.recipientUserId
  ) {
    return null;
  }

  const ownerMembership = owner.role === "primary" ? primaryMembership : partnerMembership;
  const recipientMembership =
    recipient.role === "primary" ? primaryMembership : partnerMembership;
  return {
    couple,
    primaryMembership,
    partnerMembership,
    ownerMembership,
    recipientMembership,
  };
}

async function currentScheduledPrediction(
  ctx: SourceReaderCtx,
  identity: Extract<
    NotificationSourceIdentity,
    { eventType: "period_window_approaching.v1" }
  >,
): Promise<boolean> {
  const [current, scheduleState, preference] = await Promise.all([
    // This shared reducer only reads ctx.db; its current signature predates QueryCtx use.
    readCurrentNotificationCycleState(ctx as MutationCtx, identity.primaryId),
    ctx.db
      .query("notificationScheduleState")
      .withIndex("by_user_id", (q) => q.eq("userId", identity.primaryId))
      .unique(),
    ctx.db
      .query("notificationPreferences")
      .withIndex("by_user_and_purpose", (q) =>
        q.eq("userId", identity.primaryId).eq("purpose", "period_window_approaching"),
      )
      .unique(),
  ]);
  if (
    !current ||
    !scheduleState ||
    !preference ||
    current.state.status !== "estimated" ||
    current.state.bounds.version !== 2 ||
    current.state.bounds.source !== "period_prediction_v2" ||
    current.localDay !== identity.dueLocalDay ||
    identity.dueLocalDay !== addCalendarDays(current.state.bounds.pointDate, -3) ||
    current.latestEligibleStartEventId !== identity.latestEligibleStartEventId ||
    current.sourceAuthorityVersion !== identity.sourceAuthorityVersion ||
    scheduleState.sourceRevision !== current.sourceRevision ||
    scheduleState.sourceAuthorityVersion !== current.sourceAuthorityVersion ||
    parseSourceAuthorityVersion(identity.sourceAuthorityVersion) === null
  ) {
    return false;
  }
  return isCurrentNotificationScheduleFence(
    identity,
    scheduleState,
    preference,
  );
}

async function isCurrentRelationshipSource(
  ctx: SourceReaderCtx,
  event: Doc<"notificationEvents">,
  identity: RelationshipIdentity,
): Promise<boolean> {
  const relationship = await readActiveRelationship(ctx, identity);
  if (!relationship) return false;

  switch (identity.eventType) {
    case "partner_linked.v1": {
      return (
        identity.sourceId === relationship.partnerMembership._id &&
        identity.ownerUserId === relationship.partnerMembership.userId &&
        (identity.recipientUserId === relationship.partnerMembership.userId ||
          identity.recipientUserId === relationship.primaryMembership.userId)
      );
    }
    case "partner_message.v1": {
      const message = await ctx.db.get(identity.sourceId);
      return (
        message !== null &&
        message.coupleId === identity.coupleId &&
        message.senderId === identity.ownerUserId &&
        message.relationshipMembershipId === relationship.partnerMembership._id &&
        identity.ownerUserId !== identity.recipientUserId &&
        relationship.ownerMembership._id !== relationship.recipientMembership._id &&
        relationship.recipientMembership.userId !== identity.ownerUserId &&
        message.clearedAt === undefined &&
        (relationship.couple.chatClearedAt === undefined ||
          message.createdAt > relationship.couple.chatClearedAt) &&
        event.sourceAuthorityVersion ===
          `relationship-membership:${relationship.partnerMembership._id}`
      );
    }
    case "partner_nudge.v1": {
      const nudge = await ctx.db.get(identity.sourceId);
      return (
        nudge !== null &&
        nudge.coupleId === identity.coupleId &&
        nudge.relationshipMembershipId === relationship.partnerMembership._id &&
        nudge.senderId === identity.ownerUserId &&
        nudge.receiverId === identity.recipientUserId &&
        nudge.seenAt === undefined &&
        identity.ownerUserId !== identity.recipientUserId &&
        event.sourceAuthorityVersion ===
          `relationship-membership:${relationship.partnerMembership._id}`
      );
    }
    case "partner_chat_cleared.v1":
      return (
        identity.sourceId === relationship.couple._id &&
        identity.ownerUserId !== identity.recipientUserId &&
        relationship.ownerMembership._id !== relationship.recipientMembership._id &&
        relationship.couple.chatClearedAt === identity.clearOperationVersion &&
        relationship.couple.chatClearedBy === identity.ownerUserId &&
        event.sourceAuthorityVersion === `chat-clear:${identity.clearOperationVersion}`
      );
    case "connected_since_updated.v1":
      return (
        identity.sourceId === relationship.couple._id &&
        identity.ownerUserId !== identity.recipientUserId &&
        relationship.ownerMembership._id !== relationship.recipientMembership._id &&
        relationship.couple.connectedSinceUpdatedAt === identity.settingVersion &&
        relationship.couple.connectedSinceUpdatedBy === identity.ownerUserId &&
        event.sourceAuthorityVersion ===
          `connected-since-setting:${identity.settingVersion}`
      );
    default:
      return false;
  }
}

/** Current read-time authority shared by inbox reads and the in-app projector. */
export async function isNotificationSourceCurrent(
  ctx: QueryCtx | MutationCtx,
  event: Doc<"notificationEvents">,
): Promise<boolean> {
  try {
    if (!event.sourceIdentity) return false;
    const { _id: _eventId, _creationTime: _creationTime, createdAt: _createdAt, ...envelope } = event;
    assertValidNotificationEventWrite(ctx, envelope);

    const identity = event.sourceIdentity;
    switch (identity.eventType) {
      case "assisted_period_start.v1":
      case "assisted_period_end.v1": {
        const [period, primary] = await Promise.all([
          ctx.db.get(identity.sourceId),
          ctx.db.get(identity.primaryId),
        ]);
        return (
          !!period &&
          !!primary &&
          primary.role === "primary" &&
          period.userId === identity.primaryId &&
          period.source === "partner_assist" &&
          period.confirmationStatus === "confirmed" &&
          period.tombstoneAt === undefined &&
          period.authorityVersion === identity.authorityVersion &&
          (period.startCertainty === "exact" || period.startCertainty === "approximate") &&
          (identity.eventType !== "assisted_period_end.v1" ||
            (period.endDate !== undefined &&
              (period.endCertainty === "exact" || period.endCertainty === "approximate")))
        );
      }
      case "period_window_approaching.v1":
        return await currentScheduledPrediction(ctx, identity);
      case "late_status.v1":
        // D-011 keeps Late projection and read exposure disabled.
        return false;
      case "pain_check_in.v1": {
        const [request, painLog, primary] = await Promise.all([
          ctx.db.get(identity.requestId),
          ctx.db.get(identity.painLogId),
          ctx.db.get(identity.primaryId),
        ]);
        if (
          !request ||
          !painLog ||
          !primary ||
          primary.role !== "primary" ||
          request.state !== "active" ||
          request.ownerUserId !== identity.primaryId ||
          request.painLogId !== identity.painLogId ||
          request.requestVersion !== identity.requestVersion ||
          request.selectedLocalDay !== identity.selectedLocalDay ||
          painLog.userId !== identity.primaryId ||
          painLog.date !== identity.selectedLocalDay
        ) {
          return false;
        }
        requireValidCalendarDate(identity.selectedLocalDay, "Pain reminder local day");
        const timeZone = resolveCalendarTimeZone(primary.timeZone);
        const today = toCalendarDateInTimeZone(new Date(), timeZone);
        return identity.selectedLocalDay >= today;
      }
      case "partner_linked.v1":
      case "partner_message.v1":
      case "partner_nudge.v1":
      case "partner_chat_cleared.v1":
      case "connected_since_updated.v1":
        return await isCurrentRelationshipSource(ctx, event, identity);
      default:
        return false;
    }
  } catch {
    return false;
  }
}
