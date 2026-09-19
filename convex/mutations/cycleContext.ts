import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { mutation, type MutationCtx } from "../_generated/server";
import { getCurrentUser } from "../_helpers/auth";
import {
  requirePastOrTodayCalendarDate,
  resolveCalendarTimeZone,
} from "../_helpers/calendarDates";
import { isStartAnchorEligible } from "../_helpers/cycleFactEligibility";
import { isPeriodPredictionV2Enabled } from "../_helpers/periodPredictionFlag";

async function requireEligibleSegmentStart(
  ctx: MutationCtx,
  userId: Id<"users">,
  startDate: string,
) {
  const matchingEvents = ctx.db
    .query("periodEvents")
    .withIndex("by_user_and_start", (q) =>
      q.eq("userId", userId).eq("startDate", startDate),
    );

  for await (const event of matchingEvents) {
    if (isStartAnchorEligible(event)) return;
  }

  throw new Error("PREDICTION_SEGMENT_START_NOT_ELIGIBLE");
}

export const createPredictionSegment = mutation({
  args: { startDate: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (user.role !== "primary") {
      throw new Error("Only the primary user can update cycle data");
    }
    if (!isPeriodPredictionV2Enabled()) {
      throw new Error("PERIOD_PREDICTION_V2_DISABLED");
    }

    const timeZone = resolveCalendarTimeZone(user.timeZone);
    requirePastOrTodayCalendarDate(
      args.startDate,
      "Prediction baseline start date",
      timeZone,
    );
    await requireEligibleSegmentStart(ctx, user._id, args.startDate);

    const active = await ctx.db
      .query("cyclePredictionSegments")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", user._id).eq("status", "active"),
      )
      .unique();
    const now = Date.now();

    if (active) {
      await ctx.db.patch(active._id, {
        status: "superseded",
        supersededAt: now,
      });
    }

    const segmentId = await ctx.db.insert("cyclePredictionSegments", {
      userId: user._id,
      startDate: args.startDate,
      status: "active",
      ...(active ? { supersedesSegmentId: active._id } : {}),
      createdAt: now,
    });

    return { segmentId };
  },
});
