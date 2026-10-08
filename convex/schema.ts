import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  notificationEventPersistedEnvelopeValidator,
} from "./_helpers/notificationTypes";
import {
  notificationDeliveryAttemptRecordValidator,
  notificationDeliveryRecordValidator,
  notificationInboxItemRecordValidator,
} from "./_helpers/notificationDelivery";

export const notificationPurposeValues = [
  "assisted_period_start",
  "assisted_period_end",
  "period_window_approaching",
  "late_status",
  "pain_check_in",
  "partner_linked",
  "partner_message",
  "partner_nudge",
  "partner_chat_cleared",
  "connected_since_updated",
] as const;

export const notificationPurposeValidator = v.union(
  v.literal("assisted_period_start"),
  v.literal("assisted_period_end"),
  v.literal("period_window_approaching"),
  v.literal("late_status"),
  v.literal("pain_check_in"),
  v.literal("partner_linked"),
  v.literal("partner_message"),
  v.literal("partner_nudge"),
  v.literal("partner_chat_cleared"),
  v.literal("connected_since_updated"),
);

export const notificationPreferenceValidator = v.object({
  userId: v.id("users"),
  purpose: notificationPurposeValidator,
  inAppEnabled: v.boolean(),
  localReminderTime: v.optional(v.string()),
  reminderWindowVersion: v.number(),
  updatedAt: v.number(),
});

export const notificationScheduleStateValidator = v.object({
  userId: v.id("users"),
  sourceRevision: v.number(),
  sourceAuthorityVersion: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const notificationControlValidator = v.object({
  scope: v.union(v.literal("global"), v.literal("channel"), v.literal("purpose")),
  key: v.string(),
  version: v.number(),
  operatorReference: v.string(),
  updatedAt: v.number(),
});

export const notificationDueWorkValidator = v.object({
  ownerUserId: v.id("users"),
  kind: v.union(
    v.literal("delivery"),
    v.literal("prediction_window"),
    v.literal("late_boundary"),
    v.literal("source_reconcile"),
    v.literal("pain_reminder"),
  ),
  state: v.union(
    v.literal("pending"),
    v.literal("claimed"),
    v.literal("completed"),
    v.literal("cancelled"),
  ),
  dueAt: v.number(),
  generation: v.number(),
  sourceAuthorityVersion: v.optional(v.string()),
  reminderWindowVersion: v.optional(v.number()),
  eventId: v.optional(v.id("notificationEvents")),
  deliveryId: v.optional(v.id("notificationDeliveries")),
  painReminderRequestId: v.optional(v.id("painReminderRequests")),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const painReminderRequestValidator = v.object({
  ownerUserId: v.id("users"),
  painLogId: v.id("painLogs"),
  selectedLocalDay: v.string(),
  requestVersion: v.number(),
  state: v.union(v.literal("active"), v.literal("cancelled")),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const {
  providerMessageId: _providerMessageId,
  ...inAppDeliveryFields
} = notificationDeliveryRecordValidator.fields;
const {
  result: _attemptResult,
  ...inAppAttemptFields
} = notificationDeliveryAttemptRecordValidator.fields;

export const notificationInAppDeliveryValidator = v.object({
  ...inAppDeliveryFields,
  channel: v.literal("in_app"),
  state: v.union(
    v.literal("pending"),
    v.literal("processing"),
    v.literal("retry_wait"),
    v.literal("failed_permanent"),
    v.literal("delivered"),
    v.literal("expired"),
    v.literal("suppressed"),
    v.literal("cancelled"),
  ),
  providerOutcome: v.literal("none"),
});

export const notificationInAppAttemptValidator = v.object({
  ...inAppAttemptFields,
  result: v.object({ kind: v.literal("in_app_persisted") }),
});

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
    currentUserId: v.optional(v.id("users")),
    userCursor: v.optional(v.string()),
    globalComplete: v.optional(v.boolean()),
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
    attestedDeployment: v.optional(v.string()),
    attestedEnvironment: v.optional(
      v.union(v.literal("dev"), v.literal("preview"), v.literal("staging"))
    ),
    cursor: v.optional(v.string()),
    currentUserId: v.optional(v.id("users")),
    userCursor: v.optional(v.string()),
    globalComplete: v.optional(v.boolean()),
    isComplete: v.boolean(),
    pageSize: v.number(),
    processedCount: v.number(),
    annotatedCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_run_id", ["runId"]),

  cycleFactScanUsers: defineTable({
    runType: v.union(v.literal("audit"), v.literal("migration")),
    runId: v.string(),
    userId: v.id("users"),
    status: v.union(v.literal("pending"), v.literal("done")),
  })
    .index("by_run_and_user", ["runType", "runId", "userId"])
    .index("by_run_and_status", ["runType", "runId", "status"]),

  cycleFactScanRows: defineTable({
    runType: v.union(v.literal("audit"), v.literal("migration")),
    runId: v.string(),
    periodEventId: v.id("periodEvents"),
    userId: v.id("users"),
    startDate: v.string(),
    scanEndDate: v.string(),
    active: v.boolean(),
    endDate: v.optional(v.string()),
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
    source: v.optional(
      v.union(
        v.literal("self"),
        v.literal("partner_assist"),
        v.literal("system")
      )
    ),
    classificationReason: v.optional(
      v.union(
        v.literal("missing_provenance"),
        v.literal("inferred_end"),
        v.literal("duplicate"),
        v.literal("overlap"),
        v.literal("unprovable")
      )
    ),
  })
    .index("by_run_and_event", ["runType", "runId", "periodEventId"])
    .index("by_run_user_start", [
      "runType",
      "runId",
      "userId",
      "startDate",
      "active",
    ])
    .index("by_run_user_end", [
      "runType",
      "runId",
      "userId",
      "active",
      "scanEndDate",
    ]),

  couples: defineTable({
    createdAt: v.number(),
    chatClearedAt: v.optional(v.number()),
    chatClearedBy: v.optional(v.id("users")),
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
    revokedAt: v.optional(v.number()),
  })
    .index("by_couple", ["coupleId"])
    .index("by_user", ["userId"])
    .index("by_couple_and_role", ["coupleId", "role"])
    .index("by_user_and_revoked_at", ["userId", "revokedAt"])
    .index("by_couple_and_role_and_revoked_at", ["coupleId", "role", "revokedAt"]),

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
    .index("by_couple_and_status", ["coupleId", "status"])
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
    .index("by_user_and_success_and_attempted_at", ["userId", "success", "attemptedAt"])
    .index("by_entered_code", ["enteredCode"])
    .index("by_entered_code_and_attempted_at", ["enteredCode", "attemptedAt"])
    .index("by_entered_code_and_success_and_attempted_at", ["enteredCode", "success", "attemptedAt"]),

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
    primaryCorrectionVersion: v.optional(v.number()),
    partnerCorrectionVersion: v.optional(v.number()),
    tombstoneByUserId: v.optional(v.id("users")),
    tombstoneAt: v.optional(v.number()),
    tombstoneAuthorityVersion: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_start", ["userId", "startDate"])
    .index("by_user_and_end", ["userId", "endDate"])
    .index("by_user_and_start_and_tombstone", ["userId", "startDate", "tombstoneAt"])
    .index("by_user_and_tombstone_and_end", ["userId", "tombstoneAt", "endDate"])
    .index("by_user_and_tombstone_and_end_and_start", ["userId", "tombstoneAt", "endDate", "startDate"]),

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
    predictionPaused: v.optional(v.boolean()),
    predictionPausedAt: v.optional(v.number()),
    lastUpdatedAt: v.number(),
  }).index("by_user", ["userId"]),

  cyclePredictionSegments: defineTable({
    userId: v.id("users"),
    startDate: v.string(),
    status: v.union(v.literal("active"), v.literal("superseded")),
    supersedesSegmentId: v.optional(v.id("cyclePredictionSegments")),
    createdAt: v.number(),
    supersededAt: v.optional(v.number()),
  })
    .index("by_user_and_status", ["userId", "status"])
    .index("by_user_and_created_at", ["userId", "createdAt"]),

  predictionSnapshots: defineTable({
    userId: v.id("users"),
    generatedAt: v.number(),
    inputCutoffAt: v.number(),
    inputCutoffDate: v.string(),
    status: v.union(
      v.literal("configured"),
      v.literal("personalized"),
      v.literal("limited_evidence")
    ),
    estimatorId: v.string(),
    estimatorVersion: v.number(),
    intervalMethodVersion: v.string(),
    calibrationVersion: v.union(v.string(), v.null()),
    pointDate: v.string(),
    earliestDate: v.string(),
    latestDate: v.string(),
    probabilityLabel: v.union(
      v.null(),
      v.object({
        level: v.literal(80),
        calibrationStatus: v.literal("approved"),
        calibrationVersion: v.string(),
      })
    ),
    quality: v.union(
      v.literal("high"),
      v.literal("moderate"),
      v.literal("low"),
      v.literal("timing_less_predictable"),
      v.literal("limited_evidence")
    ),
    qualityScoreV1: v.optional(v.number()),
    basisCount: v.number(),
    reasonCodes: v.array(
      v.union(
        v.literal("ELEVATED_CALIBRATION_RISK"),
        v.literal("USER_CONFIGURED_BASELINE"),
        v.literal("PERSONALIZATION_NOT_APPROVED"),
        v.literal("INSUFFICIENT_CALIBRATION"),
        v.literal("RECENT_TIMING_VARIABLE"),
        v.literal("SPARSE_HISTORY"),
        v.literal("LIMITED_HISTORY"),
        v.literal("USER_PAUSED"),
        v.literal("NO_ELIGIBLE_FACT"),
        v.literal("INVALID_CONFIGURATION"),
        v.literal("APPROXIMATE_DATE"),
        v.literal("LEGACY_UNKNOWN"),
        v.literal("POSSIBLE_MISSING_LOG"),
        v.literal("CONTEXT_SEGMENT"),
        v.literal("RECENT_CORRECTION"),
        v.literal("PARTNER_ASSISTED"),
        v.literal("TOMBSTONED"),
        v.literal("AFTER_CUTOFF"),
        v.literal("INVALID_DATE"),
        v.literal("NON_POSITIVE_INTERVAL")
      )
    ),
    displayStatus: v.union(v.literal("shadow"), v.literal("visible")),
    predictionSegmentId: v.union(
      v.id("cyclePredictionSegments"),
      v.literal("default_all_history_v1")
    ),
    featureVersion: v.string(),
    contractVersion: v.number(),
  })
    .index("by_user_and_generated_at", ["userId", "generatedAt"])
    .index("by_user_and_input_cutoff_at", ["userId", "inputCutoffAt"]),

  predictionSnapshotAssessments: defineTable(
    v.union(
      v.object({
        snapshotId: v.id("predictionSnapshots"),
        type: v.literal("outcome"),
        observedEligibleStartDate: v.string(),
        signedErrorDays: v.number(),
        absoluteErrorDays: v.number(),
        insideWindow: v.boolean(),
        sourcePeriodEventId: v.id("periodEvents"),
        sourceAuthorityVersion: v.optional(v.number()),
        reason: v.union(
          v.literal("eligible_outcome"),
          v.literal("outcome_reinstated")
        ),
        recordedAt: v.number(),
      }),
      v.object({
        snapshotId: v.id("predictionSnapshots"),
        type: v.literal("superseded"),
        sourcePeriodEventId: v.id("periodEvents"),
        sourceAuthorityVersion: v.optional(v.number()),
        reason: v.union(
          v.literal("primary_correction"),
          v.literal("partner_correction"),
          v.literal("earlier_eligible_start_discovered")
        ),
        recordedAt: v.number(),
      })
    )
  )
    .index("by_snapshot_and_type", ["snapshotId", "type"])
    .index("by_source_period_event_and_type", [
      "sourcePeriodEventId",
      "type",
    ])
    .index("by_snapshot_source_event_and_type", [
      "snapshotId",
      "sourcePeriodEventId",
      "type",
    ]),

  predictionSnapshotOutcomeCandidates: defineTable({
    snapshotId: v.id("predictionSnapshots"),
    sourcePeriodEventId: v.id("periodEvents"),
    observedEligibleStartDate: v.string(),
    sourceAuthorityVersion: v.optional(v.number()),
    status: v.union(v.literal("eligible"), v.literal("superseded")),
    recordedAt: v.number(),
  })
    .index("by_snapshot_and_status_and_observed_date", [
      "snapshotId",
      "status",
      "observedEligibleStartDate",
    ])
    .index("by_snapshot_and_source_event", ["snapshotId", "sourcePeriodEventId"])
    .index("by_source_event", ["sourcePeriodEventId"]),

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

  notificationEvents: defineTable(
    v.object({
      ...notificationEventPersistedEnvelopeValidator.fields,
      createdAt: v.number(),
    }),
  )
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_source_reference_and_authority", [
      "sourceReference",
      "sourceAuthorityVersion",
    ])
    .index("by_recipient_and_created_at", ["recipientUserId", "createdAt"]),

  notificationInboxItems: defineTable(notificationInboxItemRecordValidator)
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_event_id", ["eventId"])
    .index("by_recipient_and_created_at", ["recipientUserId", "createdAt"])
    .index("by_recipient_state_and_created_at", [
      "recipientUserId",
      "state",
      "createdAt",
    ]),

  notificationDeliveries: defineTable(notificationInAppDeliveryValidator)
    .index("by_logical_key", ["logicalKey"])
    .index("by_event_id", ["eventId"])
    .index("by_recipient_and_state", ["recipientUserId", "state"])
    .index("by_state_and_expires_at", ["state", "expiresAt"])
    .index("by_state_and_next_attempt_at", ["state", "nextAttemptAt"])
    .index("by_state_and_lease_until", ["state", "leaseUntil"])
    .index("by_state_and_next_receipt_check_at", ["state", "nextReceiptCheckAt"])
    .index("by_state_and_review_at", ["state", "reviewAt"]),

  notificationDeliveryAttempts: defineTable(notificationInAppAttemptValidator)
    .index("by_delivery_and_ordinal", ["deliveryId", "attemptOrdinal"])
    .index("by_delivery_and_generation", ["deliveryId", "claimGeneration"]),

  notificationDueWork: defineTable(notificationDueWorkValidator)
    .index("by_state_and_due_at", ["state", "dueAt"])
    .index("by_kind_and_state_and_due_at", ["kind", "state", "dueAt"])
    .index("by_owner_and_state_and_due_at", ["ownerUserId", "state", "dueAt"])
    .index(
      "by_owner_and_kind_and_state_and_due_at_and_generation_and_source_authority_version_and_reminder_window_version",
      [
        "ownerUserId",
        "kind",
        "state",
        "dueAt",
        "generation",
        "sourceAuthorityVersion",
        "reminderWindowVersion",
      ],
    )
    .index("by_delivery_id", ["deliveryId"])
    .index("by_request_id", ["painReminderRequestId"]),

  notificationPreferences: defineTable(notificationPreferenceValidator)
    .index("by_user_and_purpose", ["userId", "purpose"])
    .index("by_user", ["userId"]),

  notificationScheduleState: defineTable(notificationScheduleStateValidator)
    .index("by_user_id", ["userId"]),

  notificationControls: defineTable(notificationControlValidator)
    .index("by_scope_and_key", ["scope", "key"])
    .index("by_updated_at", ["updatedAt"]),

  painReminderRequests: defineTable(painReminderRequestValidator)
    .index("by_owner_and_state", ["ownerUserId", "state"])
    .index("by_pain_log_and_version", ["painLogId", "requestVersion"]),

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
    relationshipMembershipId: v.optional(v.id("coupleMembers")),
    senderId: v.id("users"),
    receiverId: v.id("users"),
    emoji: v.string(),
    message: v.string(),
    createdAt: v.number(),
    seenAt: v.optional(v.number()),
  })
    .index("by_receiver_created", ["receiverId", "createdAt"])
    .index("by_couple_receiver_created", ["coupleId", "receiverId", "createdAt"])
    .index("by_relationship_receiver_created", [
      "coupleId",
      "relationshipMembershipId",
      "receiverId",
      "createdAt",
    ])
    .index("by_couple_created", ["coupleId", "createdAt"]),

  coupleMessages: defineTable({
    coupleId: v.id("couples"),
    relationshipMembershipId: v.optional(v.id("coupleMembers")),
    clearedAt: v.optional(v.number()),
    senderId: v.id("users"),
    body: v.string(),
    createdAt: v.number(),
    editedAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    readAt: v.optional(v.number()),
    recipientSequence: v.optional(v.number()),
  })
    .index("by_relationship_created", ["coupleId", "relationshipMembershipId", "createdAt"])
    .index("by_couple_sender_sequence_read_created", [
      "coupleId",
      "senderId",
      "recipientSequence",
      "readAt",
      "clearedAt",
      "createdAt",
    ])
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
    lastMessageSequence: v.optional(v.number()),
    lastReadSequence: v.optional(v.number()),
    legacySequenceBase: v.optional(v.number()),
    legacyUnreadCount: v.optional(v.number()),
    legacyReadThroughAt: v.optional(v.number()),
  })
    .index("by_couple_and_user", ["coupleId", "userId"])
    .index("by_user_and_couple", ["userId", "coupleId"]),
});
