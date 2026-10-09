import { cronJobs, makeFunctionReference } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Recover missed local reminder wakeups from the indexed pending queue.
crons.interval(
  "reconcile local notification due work",
  { minutes: 1 },
  makeFunctionReference<"mutation">(
    "internal/notificationScheduler:reconcileDueWork",
  ),
);

// Recover missed in-app delivery wakes through bounded state and deadline pages.
crons.interval(
  "reconcile in-app delivery work",
  { minutes: 1 },
  makeFunctionReference<"mutation">(
    "internal/notificationReconciler:reconcile",
  ),
  { state: "pending", cursor: null, deadlineCursor: null },
);

// Legacy compatibility path only; the mutation is a no-op while Gate 1 is enabled.
crons.daily(
  "auto end periods",
  { hourUTC: 0, minuteUTC: 0 },
  internal.mutations.periods.autoEndPeriods
);

export default crons;
