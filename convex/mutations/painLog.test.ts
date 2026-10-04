import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api } from "../_generated/api";
import { addCalendarDays } from "../_helpers/cycleCalculations";
import { toCalendarDateInTimeZone } from "../_helpers/calendarDates";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";

function validPainLog() {
  return { painScore: 4, tags: ["cramps"] as ("cramps")[] };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("pain log date boundaries", () => {
  test("accepts today and valid past dates", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary } = await seedActiveCouple(t);
    const today = toCalendarDateInTimeZone(new Date(), "UTC");

    await expect(
      asPrimary.mutation(api.mutations.painLog.createOrUpdatePainLog, {
        date: today,
        ...validPainLog(),
      })
    ).resolves.toMatchObject({ created: true });

    await expect(
      asPrimary.mutation(api.mutations.painLog.createOrUpdatePainLog, {
        date: addCalendarDays(today, -1),
        ...validPainLog(),
      })
    ).resolves.toMatchObject({ created: true });
  });

  test.each(["not-a-date", "2026-99-99", "07/16/2026"]) (
    "rejects malformed date %s",
    async (date) => {
      const t = convexTest(schema, modules);
      const { asPrimary } = await seedActiveCouple(t);

      await expect(
        asPrimary.mutation(api.mutations.painLog.createOrUpdatePainLog, {
          date,
          ...validPainLog(),
        })
      ).rejects.toThrow("Pain log date must be a valid date");
    }
  );

  test("rejects future dates at the mutation boundary", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary } = await seedActiveCouple(t);

    await expect(
      asPrimary.mutation(api.mutations.painLog.createOrUpdatePainLog, {
        date: addCalendarDays(toCalendarDateInTimeZone(new Date(), "UTC"), 1),
        ...validPainLog(),
      })
    ).rejects.toThrow("Pain log date cannot be in the future");
  });
});

test("high pain create and update cannot POST or write a legacy log with a stale webhook", async () => {
  vi.stubEnv("DISCORD_WEBHOOK_URL", "https://discord.example.test/webhook");
  const fetchStub = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
  vi.stubGlobal("fetch", fetchStub);

  const t = convexTest(schema, modules);
  const { asPrimary, primaryId } = await seedActiveCouple(t);
  await t.run(async (ctx) => {
    await ctx.db.patch(primaryId, { externalNotificationConsent: true });
  });
  const date = toCalendarDateInTimeZone(new Date(), "UTC");

  vi.useFakeTimers();
  try {
    await asPrimary.mutation(api.mutations.painLog.createOrUpdatePainLog, {
      date,
      painScore: 8,
      tags: ["cramps"],
    });
    await asPrimary.mutation(api.mutations.painLog.createOrUpdatePainLog, {
      date,
      painScore: 9,
      tags: ["headache"],
    });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  } finally {
    vi.useRealTimers();
  }

  expect(fetchStub).not.toHaveBeenCalled();
  await expect(
    t.run(async (ctx) => ctx.db.query("notificationLog").collect()),
  ).resolves.toEqual([]);
});
