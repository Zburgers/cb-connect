import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily check for period predictions at 9am UTC
crons.daily(
  "send period predictions",
  { hourUTC: 9, minuteUTC: 0 },
  internal.actions.notifications.sendDailyPredictions
);

// Daily auto-close of periods that exceeded configured period length (midnight UTC)
crons.daily(
  "auto end periods",
  { hourUTC: 0, minuteUTC: 0 },
  internal.mutations.periods.autoEndPeriods
);

export default crons;
