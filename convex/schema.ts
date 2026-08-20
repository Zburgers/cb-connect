import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    preferredName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    role: v.optional(v.union(v.literal("primary"), v.literal("partner"))),
    createdAt: v.number(),
    lastActiveAt: v.number(),
    gender: v.optional(v.union(v.literal("male"), v.literal("female"), v.literal("other"), v.literal("prefer_not_to_say"))),
    partnerType: v.optional(v.union(v.literal("boyfriend"), v.literal("girlfriend"), v.literal("spouse"), v.literal("partner"), v.literal("other"))),
    externalNotificationConsent: v.optional(v.boolean()),
    timeZone: v.optional(v.string()),
    fixtureRunId: v.optional(v.string()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_fixture_run_id_and_clerk_id", ["fixtureRunId", "clerkId"]),

  // This marker deliberately outlives the synthetic users so a failed test
  // run can be recovered even if Clerk or a partial cleanup removed them first.
  fixtureRuns: defineTable({
    runId: v.string(),
    primaryClerkId: v.string(),
    partnerClerkId: v.string(),
    // Created as soon as the primary Clerk session exists, before either
    // account is allowed to visit the application and create fixture data.
    // The couple is attached only after the synthetic accounts are linked.
    coupleId: v.optional(v.id("couples")),
    createdAt: v.number(),
    cleanedAt: v.optional(v.number()),
  }).index("by_run_id", ["runId"]),

  cycleDataAuditRuns: defineTable({
    runId: v.string(),
    cursor: v.optional(v.string()),
    isComplete: v.boolean(),
    pageSize: v.number(),
    processedCount: v.number(),
    missingProvenance: v.number(),
    inferredEnd: v.number(),
    duplicate: v.number(),
    overlap: v.number(),
    unprovable: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_run_id", ["runId"]),

  cycleFactsMigrationRuns: defineTable({
    runId: v.string(),
    mode: v.union(v.literal("dry_run"), v.literal("annotate")),
    targetDeployment: v.optional(v.string()),
    cursor: v.optional(v.string()),
    isComplete: v.boolean(),
    pageSize: v.number(),
    processedCount: v.number(),
    annotatedCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_run_id", ["runId"]),

  couples: defineTable({
    createdAt: v.number(),
    linkedAt: v.optional(v.number()),
    connectedSinceDate: v.optional(v.string()),
    connectedSinceUpdatedAt: v.optional(v.number()),
    connectedSinceUpdatedBy: v.optional(v.id("users")),
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("revoked")
    ),
  }),

  coupleMembers: defineTable({
    coupleId: v.id("couples"),
    userId: v.id("users"),
    role: v.union(v.literal("primary"), v.literal("partner")),
    sharingPain: v.boolean(),
    sharingPhase: v.boolean(),
    sharingPeriodWrite: v.optional(v.boolean()),
    partnerNickname: v.optional(v.string()),
    joinedAt: v.number(),
  })
    .index("by_couple", ["coupleId"])
    .index("by_user", ["userId"])
    .index("by_couple_and_role", ["coupleId", "role"]),

  pairingCodes: defineTable({
    code: v.string(),
    coupleId: v.id("couples"),
    createdBy: v.id("users"),
    expiresAt: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("used"),
      v.literal("expired")
    ),
    usedBy: v.optional(v.id("users")),
    usedAt: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_couple", ["coupleId"])
    .index("by_status_and_expiry", ["status", "expiresAt"]),

  pairingCodeAttempts: defineTable({
    userId: v.id("users"),
    enteredCode: v.string(),
    attemptedAt: v.number(),
    success: v.boolean(),
    failureReason: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_attempted_at", ["userId", "attemptedAt"])
    .index("by_entered_code", ["enteredCode"])
    .index("by_entered_code_and_attempted_at", ["enteredCode", "attemptedAt"]),

  periodEvents: defineTable({
    userId: v.id("users"),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    createdByUserId: v.optional(v.id("users")),
    updatedByUserId: v.optional(v.id("users")),
    source: v.optional(
      v.union(
        v.literal("self"),
        v.literal("partner_assist"),
        v.literal("system")
      )
    ),
    confirmationStatus: v.optional(
      v.union(v.literal("confirmed"), v.literal("unreviewed"))
    ),
    startCertainty: v.optional(
      v.union(
        v.literal("exact"),
        v.literal("approximate"),
        v.literal("legacy_unknown")
      )
    ),
    endCertainty: v.optional(
      v.union(
        v.literal("exact"),
        v.literal("approximate"),
        v.literal("legacy_unknown")
      )
    ),
    legacyReason: v.optional(
      v.union(
        v.literal("missing_provenance"),
        v.literal("inferred_end"),
        v.literal("duplicate"),
        v.literal("overlap"),
        v.literal("unprovable")
      )
    ),
    authorityVersion: v.optional(v.number()),
    tombstoneByUserId: v.optional(v.id("users")),
    tombstoneAt: v.optional(v.number()),
    tombstoneAuthorityVersion: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_start", ["userId", "startDate"]),

  painLogs: defineTable({
    userId: v.id("users"),
    date: v.string(),
    painScore: v.number(),
    tags: v.array(
      v.union(
        v.literal("cramps"),
        v.literal("headache"),
        v.literal("back"),
        v.literal("fatigue"),
        v.literal("other")
      )
    ),
    note: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_date", ["userId", "date"]),

  cycleSettings: defineTable({
    userId: v.id("users"),
    cycleLength: v.number(),
    periodLength: v.number(),
    lastUpdatedAt: v.number(),
  }).index("by_user", ["userId"]),

  painTips: defineTable({
    phase: v.union(
      v.literal("menstruation"),
      v.literal("follicular"),
      v.literal("ovulation"),
      v.literal("luteal")
    ),
    painSeverity: v.union(
      v.literal("none"),
      v.literal("mild"),
      v.literal("moderate"),
      v.literal("severe")
    ),
    title: v.string(),
    suggestions: v.array(v.string()),
    safetyNote: v.string(),
    isActive: v.boolean(),
    priority: v.number(),
  }).index("by_phase_and_severity", ["phase", "painSeverity", "isActive"]),

  nutritionTips: defineTable({
    phase: v.union(
      v.literal("menstruation"),
      v.literal("follicular"),
      v.literal("ovulation"),
      v.literal("luteal")
    ),
    foodItem: v.string(),
    reasoning: v.string(),
    isActive: v.boolean(),
    priority: v.number(),
  }).index("by_phase", ["phase", "isActive"]),

  hiddenNutrition: defineTable({
    userId: v.id("users"),
    nutritionTipId: v.id("nutritionTips"),
    hiddenUntil: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_tip", ["userId", "nutritionTipId"]),

  notificationLog: defineTable({
    userId: v.id("users"),
    type: v.string(),
    payload: v.any(),
    sentAt: v.number(),
    status: v.union(v.literal("sent"), v.literal("failed")),
    errorMessage: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_sent_at", ["userId", "sentAt"])
    .index("by_sent_at", ["sentAt"]),

  // Presence records track when each user last sent a heartbeat within their couple.
  presence: defineTable({
    coupleId: v.id("couples"),
    userId: v.id("users"),
    lastSeen: v.number(),
  })
    .index("by_couple_user", ["coupleId", "userId"])
    .index("by_couple", ["coupleId"]),

  nudges: defineTable({
    coupleId: v.id("couples"),
    senderId: v.id("users"),
    receiverId: v.id("users"),
    emoji: v.string(),
    message: v.string(),
    createdAt: v.number(),
    seenAt: v.optional(v.number()),
  })
    .index("by_receiver_created", ["receiverId", "createdAt"])
    .index("by_couple_created", ["coupleId", "createdAt"]),

  coupleMessages: defineTable({
    coupleId: v.id("couples"),
    senderId: v.id("users"),
    body: v.string(),
    createdAt: v.number(),
    editedAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    readAt: v.optional(v.number()),
  })
    .index("by_couple_created", ["coupleId", "createdAt"])
    .index("by_sender_created", ["senderId", "createdAt"]),

  coupleMessageReactions: defineTable({
    coupleId: v.id("couples"),
    messageId: v.id("coupleMessages"),
    userId: v.id("users"),
    emoji: v.string(),
    createdAt: v.number(),
  })
    .index("by_couple", ["coupleId"])
    .index("by_message", ["messageId"])
    .index("by_message_and_user", ["messageId", "userId"]),

  coupleChatStates: defineTable({
    coupleId: v.id("couples"),
    userId: v.id("users"),
    unreadCount: v.number(),
    lastReadAt: v.optional(v.number()),
    lastDeliveredAt: v.optional(v.number()),
  })
    .index("by_couple_and_user", ["coupleId", "userId"])
    .index("by_user_and_couple", ["userId", "coupleId"]),
});
