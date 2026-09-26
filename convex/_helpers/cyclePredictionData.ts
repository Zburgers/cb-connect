import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { toCalendarDateInTimeZone } from "./calendarDates";
import {
  deriveCycleIntervals,
  type CycleIntervalDerivation,
} from "./cycleIntervals";

const MAX_CYCLE_PREDICTION_EVENTS = 1_000;

export async function readCyclePredictionData(
  ctx: QueryCtx,
  userId: Id<"users">,
  knownUser?: Doc<"users">,
): Promise<{
  user: Doc<"users"> | null;
  periodEvents: Doc<"periodEvents">[];
  historyComplete: boolean;
  activeSegment: Doc<"cyclePredictionSegments"> | null;
  cycleIntervals: CycleIntervalDerivation;
}> {
  const cutoffAt = Date.now();
  const [queriedPeriods, activeSegment, user] = await Promise.all([
    // ponytail: 1,000 events covers about 76 years; switch to a maintained
    // interval summary before allowing longer histories.
    ctx.db
      .query("periodEvents")
      .withIndex("by_user_and_start", (q) => q.eq("userId", userId))
      .order("desc")
      .take(MAX_CYCLE_PREDICTION_EVENTS + 1),
    ctx.db
      .query("cyclePredictionSegments")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", userId).eq("status", "active"),
      )
      .unique(),
    knownUser ? Promise.resolve(knownUser) : ctx.db.get("users", userId),
  ]);
  const historyComplete = queriedPeriods.length <= MAX_CYCLE_PREDICTION_EVENTS;
  const periodEvents = queriedPeriods.slice(0, MAX_CYCLE_PREDICTION_EVENTS);
  const derivedIntervals = deriveCycleIntervals(periodEvents, {
    cutoffAt,
    cutoffDate: toCalendarDateInTimeZone(
      new Date(cutoffAt),
      user?.timeZone ?? "UTC",
    ),
    segments: activeSegment ? [activeSegment] : [],
  });
  const cycleIntervals: CycleIntervalDerivation = historyComplete
    ? derivedIntervals
    : {
        ...derivedIntervals,
        reasonCodes: [...new Set([
          ...derivedIntervals.reasonCodes,
          "LIMITED_HISTORY" as const,
        ])].sort(),
      };

  return {
    user,
    periodEvents,
    historyComplete,
    activeSegment,
    cycleIntervals,
  };
}
