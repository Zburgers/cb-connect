import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple, seedUser } from "../test.fixtures";

type TestBackend = ReturnType<typeof convexTest>;

beforeEach(() => {
  vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function setPrimaryTimeZone(t: TestBackend) {
  await t.run(async (ctx) => {
    const primary = (await ctx.db.query("users").take(10)).find(
      (user) => user.clerkId === "primary-clerk"
    );
    if (!primary) {
      throw new Error("Primary fixture user was not found");
    }
    await ctx.db.patch(primary._id, { timeZone: "UTC" });
  });
}

describe("partner-assisted period logging", () => {
  test("partner cannot use primary-only self logging or cycle settings", async () => {
    const t = convexTest(schema, modules);
    const { asPartner } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });

    await expect(
      asPartner.mutation(api.mutations.periods.logPeriodStart, {
        startDate: "2026-06-20",
      })
    ).rejects.toThrow("Only the primary user");
    await expect(
      asPartner.mutation(api.mutations.periods.logPeriodEnd, {
        endDate: "2026-06-24",
      })
    ).rejects.toThrow("Only the primary user");
    await expect(
      asPartner.mutation(api.mutations.periods.updateCycleSettings, {
        cycleLength: 30,
      })
    ).rejects.toThrow("Only the primary user");
  });

  test("partner cannot assist-log without an active couple", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, {
      clerkId: "partner-clerk",
      name: "Partner Person",
      role: "partner",
    });
    const asPartner = t.withIdentity({ subject: "partner-clerk" });

    await expect(
      asPartner.mutation(api.mutations.periods.assistLogPeriodStart, {
        startDate: "2026-06-20",
      })
    ).rejects.toThrow("active couple");
  });

  test.each([
    {
      sharingPhase: false,
      sharingPeriodWrite: false,
      error: "Period history is not shared",
    },
    {
      sharingPhase: true,
      sharingPeriodWrite: false,
      error: "Assisted period logging is not enabled",
    },
  ])(
    "partner cannot assist-log without required sharing permissions",
    async ({ sharingPhase, sharingPeriodWrite, error }) => {
      const t = convexTest(schema, modules);
      const { asPartner } = await seedActiveCouple(t, {
        sharingPhase,
        sharingPeriodWrite,
      });

      await expect(
        asPartner.mutation(api.mutations.periods.assistLogPeriodStart, {
          startDate: "2026-06-20",
        })
      ).rejects.toThrow(error);
    }
  );

  test("assisted start writes the primary cycle with partner attribution", async () => {
    const t = convexTest(schema, modules);
    const { asPartner, primaryId, partnerId } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });
    await setPrimaryTimeZone(t);

    const result = await asPartner.mutation(
      api.mutations.periods.assistLogPeriodStart,
      { startDate: "2026-06-20", startCertainty: "exact" }
    );

    const event = await t.run(async (ctx) => {
      return await ctx.db.get("periodEvents", result.eventId);
    });
    expect(event).toMatchObject({
      userId: primaryId,
      startDate: "2026-06-20",
      createdByUserId: partnerId,
      updatedByUserId: partnerId,
      source: "partner_assist",
      confirmationStatus: "confirmed",
      startCertainty: "exact",
      authorityVersion: 1,
    });

    const notification = await t.run(async (ctx) => {
      return await ctx.db.query("notificationLog").first();
    });
    expect(notification).toMatchObject({
      userId: primaryId,
      type: "partner_assisted_period_start",
      payload: {
        startDate: "2026-06-20",
        partnerName: "Partner Person",
      },
      status: "sent",
    });
  });

  test("assisted start rejects a second open period regardless of certainty", async () => {
    const t = convexTest(schema, modules);
    const { asPartner, primaryId } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });
    await setPrimaryTimeZone(t);
    await t.run(async (ctx) => {
      return await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-06-01",
        createdByUserId: primaryId,
        updatedByUserId: primaryId,
        source: "self",
        confirmationStatus: "confirmed",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await expect(
      asPartner.mutation(api.mutations.periods.assistLogPeriodStart, {
        startDate: "2026-06-20",
      })
    ).rejects.toThrow("OPEN_EVENT_EXISTS");
  });

  test("assisted start rejects an exact duplicate of an open fact", async () => {
    const t = convexTest(schema, modules);
    const { asPartner, primaryId } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });
    await setPrimaryTimeZone(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-06-20",
        startCertainty: "exact",
        authorityVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await expect(
      asPartner.mutation(api.mutations.periods.assistLogPeriodStart, {
        startDate: "2026-06-20",
      })
    ).rejects.toThrow("DUPLICATE_EXACT_START");
  });

  test("assisted end updates the primary user's open period", async () => {
    const t = convexTest(schema, modules);
    const { asPartner, primaryId, partnerId } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });
    await setPrimaryTimeZone(t);
    const eventId = await t.run(async (ctx) => {
      return await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-06-20",
        createdByUserId: partnerId,
        updatedByUserId: partnerId,
        source: "partner_assist",
        confirmationStatus: "confirmed",
        startCertainty: "exact",
        authorityVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await asPartner.mutation(api.mutations.periods.assistLogPeriodEnd, {
      periodEventId: eventId,
      endDate: "2026-06-24",
      endCertainty: "approximate",
      expectedAuthorityVersion: 1,
    });

    const event = await t.run(async (ctx) => {
      return await ctx.db.get("periodEvents", eventId);
    });
    expect(event).toMatchObject({
      endDate: "2026-06-24",
      source: "partner_assist",
      updatedByUserId: partnerId,
      endCertainty: "approximate",
      authorityVersion: 2,
    });
  });

  test("assisted end can close a primary-started event", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner, primaryId } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });
    await setPrimaryTimeZone(t);
    const result = await asPrimary.mutation(api.mutations.periods.logPeriodStart, {
      startDate: "2026-06-20",
      startCertainty: "exact",
      timeZone: "UTC",
    });

    await expect(
      asPartner.mutation(api.mutations.periods.assistLogPeriodEnd, {
        periodEventId: result.eventId,
        endDate: "2026-06-24",
        expectedAuthorityVersion: 1,
      })
    ).resolves.toMatchObject({ eventId: result.eventId });

    expect(
      await t.run(async (ctx) => ctx.db.get("periodEvents", result.eventId))
    ).toMatchObject({ userId: primaryId, endDate: "2026-06-24" });
  });

  test("assisted start rejects when the primary timezone is missing", async () => {
    const t = convexTest(schema, modules);
    const { asPartner, primaryId } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(primaryId, { timeZone: undefined });
    });

    await expect(
      asPartner.mutation(api.mutations.periods.assistLogPeriodStart, {
        startDate: "2026-06-20",
      })
    ).rejects.toThrow("Time zone is required for an identified user");
  });

  test("assisted approximate starts are accepted immediately", async () => {
    const t = convexTest(schema, modules);
    const { asPartner } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });
    await setPrimaryTimeZone(t);

    const result = await asPartner.mutation(
      api.mutations.periods.assistLogPeriodStart,
      { startDate: "2026-06-20", startCertainty: "approximate" }
    );
    const event = await t.run(async (ctx) => {
      return await ctx.db.get("periodEvents", result.eventId);
    });

    expect(event).toMatchObject({
      startCertainty: "approximate",
      authorityVersion: 1,
    });
  });

  test("assisted end rejects a stale authority version", async () => {
    const t = convexTest(schema, modules);
    const { asPartner, primaryId, partnerId } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });
    await setPrimaryTimeZone(t);
    const eventId = await t.run(async (ctx) => {
      return await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-06-20",
        createdByUserId: partnerId,
        updatedByUserId: partnerId,
        source: "partner_assist",
        confirmationStatus: "confirmed",
        startCertainty: "exact",
        authorityVersion: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await expect(
      asPartner.mutation(api.mutations.periods.assistLogPeriodEnd, {
        periodEventId: eventId,
        endDate: "2026-06-24",
        expectedAuthorityVersion: 1,
      })
    ).rejects.toThrow("STALE_AUTHORITY_VERSION");

    expect(
      await t.run(async (ctx) => await ctx.db.get("periodEvents", eventId))
    ).toMatchObject({ authorityVersion: 2 });
  });

  test("primary correction prevents a partner overwrite", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner, primaryId, partnerId } =
      await seedActiveCouple(t, {
        sharingPhase: true,
        sharingPeriodWrite: true,
      });
    await setPrimaryTimeZone(t);
    const eventId = await t.run(async (ctx) => {
      return await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-06-20",
        createdByUserId: partnerId,
        updatedByUserId: partnerId,
        source: "partner_assist",
        confirmationStatus: "confirmed",
        startCertainty: "exact",
        authorityVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await asPrimary.mutation(api.mutations.periods.updatePeriodEvent, {
      periodEventId: eventId,
      startDate: "2026-06-21",
      startCertainty: "exact",
      timeZone: "UTC",
      expectedAuthorityVersion: 1,
    });

    await expect(
      asPartner.mutation(api.mutations.periods.assistLogPeriodEnd, {
        periodEventId: eventId,
        endDate: "2026-06-24",
        expectedAuthorityVersion: 2,
      })
    ).rejects.toThrow("PRIMARY_AUTHORITY_REQUIRED");
  });

  test("revoked couples cannot accept partner assistance", async () => {
    const t = convexTest(schema, modules);
    const { asPartner, coupleId } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });
    await setPrimaryTimeZone(t);
    await t.run(async (ctx) => {
      await ctx.db.patch(coupleId, { status: "revoked" });
    });

    await expect(
      asPartner.mutation(api.mutations.periods.assistLogPeriodStart, {
        startDate: "2026-06-20",
      })
    ).rejects.toThrow("active couple");
  });

  test("primary self logging keeps self attribution", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);

    const result = await asPrimary.mutation(api.mutations.periods.logPeriodStart, {
      startDate: "2026-06-20",
      timeZone: "UTC",
    });
    const event = await t.run(async (ctx) => {
      return await ctx.db.get("periodEvents", result.eventId);
    });

    expect(event).toMatchObject({
      userId: primaryId,
      createdByUserId: primaryId,
      updatedByUserId: primaryId,
      source: "self",
      confirmationStatus: "confirmed",
    });
  });
});

describe("period corrections", () => {
  test("partner cannot update or delete the primary user's period event", async () => {
    const t = convexTest(schema, modules);
    const { asPartner, primaryId } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });
    const eventId = await t.run(async (ctx) => {
      return await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-06-20",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await expect(
      asPartner.mutation(api.mutations.periods.updatePeriodEvent, {
        periodEventId: eventId,
        startDate: "2026-06-19",
      })
    ).rejects.toThrow("Only the primary user");
    await expect(
      asPartner.mutation(api.mutations.periods.deletePeriodEvent, {
        periodEventId: eventId,
      })
    ).rejects.toThrow("Only the primary user");
  });

  test("primary can correct and delete an assisted event", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId, partnerId } = await seedActiveCouple(t);
    const eventId = await t.run(async (ctx) => {
      return await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-06-20",
        createdByUserId: partnerId,
        updatedByUserId: partnerId,
        source: "partner_assist",
        confirmationStatus: "confirmed",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await asPrimary.mutation(api.mutations.periods.updatePeriodEvent, {
      periodEventId: eventId,
      startDate: "2026-06-19",
      endDate: "2026-06-23",
      endCertainty: "approximate",
      timeZone: "UTC",
      expectedAuthorityVersion: 0,
    });

    const corrected = await t.run(async (ctx) => {
      return await ctx.db.get("periodEvents", eventId);
    });
    expect(corrected).toMatchObject({
      startDate: "2026-06-19",
      endDate: "2026-06-23",
      source: "partner_assist",
      updatedByUserId: primaryId,
      confirmationStatus: "confirmed",
    });

    await asPrimary.mutation(api.mutations.periods.deletePeriodEvent, {
      periodEventId: eventId,
      expectedAuthorityVersion: 1,
    });
    expect(
      await t.run(async (ctx) => await ctx.db.get("periodEvents", eventId))
    ).toMatchObject({
      tombstoneByUserId: primaryId,
      tombstoneAuthorityVersion: 2,
    });
  });
});

describe("primary cycle fact writes", () => {
  test("enabled period end requires an explicit target event and authority version", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary } = await seedActiveCouple(t);
    await asPrimary.mutation(api.mutations.periods.logPeriodStart, {
      startDate: "2026-07-01",
      startCertainty: "exact",
      timeZone: "UTC",
    });

    await expect(
      asPrimary.mutation(api.mutations.periods.logPeriodEnd, {
        endDate: "2026-07-05",
        endCertainty: "exact",
        timeZone: "UTC",
      })
    ).rejects.toThrow("TARGET_EVENT_REQUIRED");
  });

  test("writes an exact start with explicit certainty and authority", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);

    const result = await asPrimary.mutation(
      api.mutations.periods.logPeriodStart,
      {
        startDate: "2026-07-01",
        startCertainty: "exact",
        timeZone: "UTC",
      }
    );
    const event = await t.run(async (ctx) => {
      return await ctx.db.get("periodEvents", result.eventId);
    });

    expect(event).toMatchObject({
      userId: primaryId,
      startCertainty: "exact",
      authorityVersion: 1,
    });
  });

  test("writes an approximate start without promoting it to exact evidence", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary } = await seedActiveCouple(t);

    const result = await asPrimary.mutation(
      api.mutations.periods.logPeriodStart,
      {
        startDate: "2026-07-01",
        startCertainty: "approximate",
        timeZone: "UTC",
      }
    );
    const event = await t.run(async (ctx) => {
      return await ctx.db.get("periodEvents", result.eventId);
    });

    expect(event).toMatchObject({
      startCertainty: "approximate",
      authorityVersion: 1,
    });
  });

  test("preserves approximate correction unless exactness is explicitly confirmed", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary } = await seedActiveCouple(t);
    const result = await asPrimary.mutation(api.mutations.periods.logPeriodStart, {
      startDate: "2026-07-01",
      startCertainty: "approximate",
      timeZone: "UTC",
    });

    await asPrimary.mutation(api.mutations.periods.updatePeriodEvent, {
      periodEventId: result.eventId,
      startDate: "2026-07-02",
      endDate: "2026-07-05",
      endCertainty: "approximate",
      timeZone: "UTC",
      expectedAuthorityVersion: 1,
    });
    expect(
      await t.run(async (ctx) => ctx.db.get("periodEvents", result.eventId))
    ).toMatchObject({
      startCertainty: "approximate",
      endCertainty: "approximate",
      authorityVersion: 2,
    });

    await asPrimary.mutation(api.mutations.periods.updatePeriodEvent, {
      periodEventId: result.eventId,
      startDate: "2026-07-02",
      endDate: "2026-07-05",
      timeZone: "UTC",
      promoteStartCertainty: true,
      promoteEndCertainty: true,
      expectedAuthorityVersion: 2,
    });
    expect(
      await t.run(async (ctx) => ctx.db.get("periodEvents", result.eventId))
    ).toMatchObject({
      startCertainty: "exact",
      endCertainty: "exact",
      authorityVersion: 3,
    });
  });

  test("rejects an exact start that overlaps an existing exact open fact", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary } = await seedActiveCouple(t);

    await asPrimary.mutation(api.mutations.periods.logPeriodStart, {
      startDate: "2026-07-01",
      startCertainty: "exact",
      timeZone: "UTC",
    });

    await expect(
      asPrimary.mutation(api.mutations.periods.logPeriodStart, {
        startDate: "2026-07-03",
        startCertainty: "exact",
        timeZone: "UTC",
      })
    ).rejects.toThrow("EXACT_INTERVAL_OVERLAP");
  });

  test("rejects a stale primary correction", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary } = await seedActiveCouple(t);
    const result = await asPrimary.mutation(
      api.mutations.periods.logPeriodStart,
      {
        startDate: "2026-07-01",
        startCertainty: "exact",
        timeZone: "UTC",
      }
    );

    await expect(
      asPrimary.mutation(api.mutations.periods.updatePeriodEvent, {
        periodEventId: result.eventId,
        startDate: "2026-07-02",
        startCertainty: "exact",
        timeZone: "UTC",
        expectedAuthorityVersion: 0,
      })
    ).rejects.toThrow("STALE_AUTHORITY_VERSION");
  });

  test("records an explicit end and advances authority", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary } = await seedActiveCouple(t);
    const result = await asPrimary.mutation(
      api.mutations.periods.logPeriodStart,
      {
        startDate: "2026-07-01",
        startCertainty: "exact",
        timeZone: "UTC",
      }
    );

    await asPrimary.mutation(api.mutations.periods.logPeriodEnd, {
      periodEventId: result.eventId,
      endDate: "2026-07-05",
      endCertainty: "exact",
      expectedAuthorityVersion: 1,
      timeZone: "UTC",
    });

    const event = await t.run(async (ctx) => {
      return await ctx.db.get("periodEvents", result.eventId);
    });
    expect(event).toMatchObject({
      endDate: "2026-07-05",
      endCertainty: "exact",
      authorityVersion: 2,
    });
  });

  test("rejects a second approximate open start", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary } = await seedActiveCouple(t);
    await asPrimary.mutation(api.mutations.periods.logPeriodStart, {
      startDate: "2026-07-01",
      startCertainty: "exact",
      timeZone: "UTC",
    });

    await expect(
      asPrimary.mutation(api.mutations.periods.logPeriodStart, {
        startDate: "2026-07-03",
        startCertainty: "approximate",
        timeZone: "UTC",
      })
    ).rejects.toThrow("OPEN_EVENT_EXISTS");
  });

  test("targets one row when multiple legacy open rows exist", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    const [firstId] = await t.run(async (ctx) => {
      const firstId = await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-06-01",
        startCertainty: "legacy_unknown",
        legacyReason: "missing_provenance",
        authorityVersion: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-06-05",
        startCertainty: "legacy_unknown",
        legacyReason: "missing_provenance",
        authorityVersion: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return [firstId];
    });

    await expect(asPrimary.mutation(api.mutations.periods.logPeriodEnd, {
      periodEventId: firstId,
      endDate: "2026-06-06",
      endCertainty: "approximate",
      expectedAuthorityVersion: 0,
      timeZone: "UTC",
    })).resolves.toMatchObject({ eventId: firstId });
  });

  test("tombstones a primary event without deleting its row", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    const result = await asPrimary.mutation(
      api.mutations.periods.logPeriodStart,
      {
        startDate: "2026-07-01",
        startCertainty: "exact",
        timeZone: "UTC",
      }
    );

    await asPrimary.mutation(api.mutations.periods.deletePeriodEvent, {
      periodEventId: result.eventId,
      expectedAuthorityVersion: 1,
    });

    const event = await t.run(async (ctx) => {
      return await ctx.db.get("periodEvents", result.eventId);
    });
    expect(event).toMatchObject({
      startDate: "2026-07-01",
      tombstoneByUserId: primaryId,
      tombstoneAuthorityVersion: 2,
    });
  });

  test("keeps physical deletion only in the flag-off compatibility branch", async () => {
    const fs = await import("node:fs/promises");
    const source = await fs.readFile(
      new URL("./periods.ts", import.meta.url),
      "utf8"
    );
    expect(source).toContain('ctx.db.delete("periodEvents"');
    expect(source).toContain("if (!isCycleFactsV1Enabled())");
    expect(source).toContain("tombstoneByUserId");
  });
});

describe("derived period endings", () => {
  test("flag-off writes retain legacy auto-close and physical-delete behavior", async () => {
    vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "false");
    const t = convexTest(schema, modules);
    const { asPrimary } = await seedActiveCouple(t);

    const first = await asPrimary.mutation(api.mutations.periods.logPeriodStart, {
      startDate: "2026-06-01",
      timeZone: "UTC",
    });
    const second = await asPrimary.mutation(api.mutations.periods.logPeriodStart, {
      startDate: "2026-06-20",
      timeZone: "UTC",
    });

    expect(
      await t.run(async (ctx) => ctx.db.get("periodEvents", first.eventId))
    ).toMatchObject({ endDate: "2026-06-19" });
    expect(
      await t.run(async (ctx) => ctx.db.get("periodEvents", first.eventId))
    ).not.toHaveProperty("startCertainty");

    await asPrimary.mutation(api.mutations.periods.deletePeriodEvent, {
      periodEventId: second.eventId,
    });
    expect(
      await t.run(async (ctx) => ctx.db.get("periodEvents", second.eventId))
    ).toBeNull();
  });

  test("a later primary start does not patch an observed end", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    const existingId = await t.run(async (ctx) => {
      return await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-06-01",
        endDate: "2026-06-05",
        createdByUserId: primaryId,
        updatedByUserId: primaryId,
        source: "self",
        confirmationStatus: "confirmed",
        startCertainty: "exact",
        endCertainty: "exact",
        authorityVersion: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await asPrimary.mutation(api.mutations.periods.logPeriodStart, {
      startDate: "2026-06-20",
      startCertainty: "exact",
      timeZone: "UTC",
    });

    expect(
      await t.run(async (ctx) => await ctx.db.get("periodEvents", existingId))
    ).toMatchObject({
      startDate: "2026-06-01",
      endDate: "2026-06-05",
      endCertainty: "exact",
      authorityVersion: 2,
    });
  });

  test("retains a flag-gated compatibility path for inferred period endings", async () => {
    const fs = await import("node:fs/promises");
    const periodsSource = await fs.readFile(
      new URL("./periods.ts", import.meta.url),
      "utf8"
    );
    const cronsSource = await fs.readFile(
      new URL("../crons.ts", import.meta.url),
      "utf8"
    );

    expect(periodsSource).toContain("autoEndPeriods");
    expect(periodsSource).toContain("isCycleFactsV1Enabled");
    expect(cronsSource).toContain("auto end periods");
    expect(cronsSource).toContain("autoEndPeriods");
  });
});
