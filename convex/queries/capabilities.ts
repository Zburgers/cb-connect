import { v } from "convex/values";

import { query } from "../_generated/server";
import { getCurrentUserOrNull } from "../_helpers/auth";
import { isCycleFactsV1Enabled } from "../_helpers/cycleFactsFlag";

export const getCapabilities = query({
  args: {},
  returns: v.object({ cycleFactsV1: v.boolean() }),
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      throw new Error("Authentication required");
    }
    return { cycleFactsV1: isCycleFactsV1Enabled() };
  },
});
