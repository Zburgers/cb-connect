import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { toCalendarDateInTimeZone } from "./calendarDates";
import {
  deriveCycleIntervals,
  type CycleIntervalDerivation,
} from "./cycleIntervals";

export async function readCyclePredictionData(
  ctx: QueryCtx,
  userId: Id<"users">,
  knownUser?: Doc<"users">,
): Promise<{
  user: Doc<"users"> | null;
  periodEvents: Doc<"periodEvents">[];
  cycleIntervals: CycleIntervalDerivation;
}> {
  const cutoffAt = Date.now();
  const [allPeriods, activeSegment, user] = await Promise.all([
    // ponytail: lifetime reads grow with history; use a maintained interval
    // summary if per-user reads approach Convex limits.
    ctx.db
      .query("periodEvents")
      .withIndex("by_user_and_start", (q) => q.eq("userId", userId))
      .order("desc")
      .collect(),
    ctx.db
      .query("cyclePredictionSegments")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", userId).eq("status", "active"),
      )
      .unique(),
    knownUser ? Promise.resolve(knownUser) : ctx.db.get("users", userId),
  ]);

  return {
    user,
    periodEvents: allPeriods,
    cycleIntervals: deriveCycleIntervals(allPeriods, {
      cutoffAt,
      cutoffDate: toCalendarDateInTimeZone(
        new Date(cutoffAt),
        user?.timeZone ?? "UTC",
      ),
      segments: activeSegment ? [activeSegment] : [],
    }),
  };
}
