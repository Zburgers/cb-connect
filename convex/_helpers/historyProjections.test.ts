import { describe, expect, test } from "vitest";

import type { Id } from "../_generated/dataModel";
import {
  projectPartnerPeriodHistory,
  projectPrimaryPeriodHistory,
} from "./historyProjections";

const primaryId = "primary-user" as Id<"users">;
const partnerId = "partner-user" as Id<"users">;
const eventId = "period-event" as Id<"periodEvents">;

const enrichedPeriod = {
  _id: eventId,
  _creationTime: 123,
  userId: primaryId,
  startDate: "2026-06-20",
  endDate: "2026-06-24",
  createdByUserId: partnerId,
  updatedByUserId: primaryId,
  source: "partner_assist" as const,
  confirmationStatus: "confirmed" as const,
  startCertainty: "approximate" as const,
  endCertainty: "exact" as const,
  legacyReason: undefined,
  authorityVersion: 2,
  primaryCorrectionVersion: 2,
  tombstoneByUserId: undefined,
  tombstoneAt: undefined,
  tombstoneAuthorityVersion: undefined,
  createdAt: 123,
  updatedAt: 456,
  certainty: "approximate" as const,
  createdByName: "Partner Person",
  updatedByName: "Primary Person",
  canCorrect: true,
};

describe("role-specific period history projections", () => {
  test("partner projection preserves shared history and targeted write fields", () => {
    const result = projectPartnerPeriodHistory(enrichedPeriod, partnerId);

    expect(result).toMatchObject({
      _id: eventId,
      startDate: "2026-06-20",
      endDate: "2026-06-24",
      source: "partner_assist",
      certainty: "approximate",
      authorityVersion: 2,
      createdByName: "Partner Person",
      updatedByName: "Primary Person",
      createdByViewer: true,
      updatedByViewer: false,
      canCorrect: false,
    });
    expect(result).not.toHaveProperty("createdByUserId");
    expect(result).not.toHaveProperty("updatedByUserId");
    expect(result).not.toHaveProperty("userId");
    expect(result).not.toHaveProperty("_creationTime");
    expect(result).not.toHaveProperty("createdAt");
    expect(result).not.toHaveProperty("updatedAt");
    expect(result).not.toHaveProperty("primaryCorrectionVersion");
    expect(result).not.toHaveProperty("tombstoneByUserId");
    expect(result).not.toHaveProperty("tombstoneAt");
    expect(result).not.toHaveProperty("tombstoneAuthorityVersion");
  });

  test("primary projection keeps correction metadata but not storage metadata", () => {
    const result = projectPrimaryPeriodHistory(enrichedPeriod, primaryId);

    expect(result).toMatchObject({
      _id: eventId,
      createdByUserId: partnerId,
      updatedByUserId: primaryId,
      authorityVersion: 2,
      createdByViewer: false,
      updatedByViewer: true,
      canCorrect: true,
    });
    expect(result).not.toHaveProperty("userId");
    expect(result).not.toHaveProperty("createdAt");
    expect(result).not.toHaveProperty("updatedAt");
    expect(result).not.toHaveProperty("tombstoneByUserId");
  });
});
