import { query } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrNull } from "../_helpers/auth";

export const getMe = query({
  handler: async (ctx) => {
    return await getCurrentUserOrNull(ctx);
  },
});

export const getAllPrimaryUsers = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "primary"))
      .collect();
  },
});
