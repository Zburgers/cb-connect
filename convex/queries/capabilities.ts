import { v } from "convex/values";

import { query } from "../_generated/server";
import { getCurrentUserOrNull } from "../_helpers/auth";
import { isCycleFactsV1Enabled } from "../_helpers/cycleFactsFlag";
import { isCycleStateV1Enabled } from "../_helpers/cycleStateFlag";
import {
  isPartnerPredictionV2Enabled,
  isPeriodPredictionV2Enabled,
} from "../_helpers/periodPredictionFlag";

export const getCapabilities = query({
  args: {},
  returns: v.object({
    cycleFactsV1: v.boolean(),
    cycleStateV1: v.boolean(),
    periodPredictionV2: v.boolean(),
    partnerPredictionV2: v.boolean(),
  }),
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      throw new Error("Authentication required");
    }
    return {
      cycleFactsV1: isCycleFactsV1Enabled(),
      cycleStateV1: isCycleStateV1Enabled(),
      periodPredictionV2: isPeriodPredictionV2Enabled(),
      partnerPredictionV2: isPartnerPredictionV2Enabled(),
    };
  },
});
