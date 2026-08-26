type TestBackend = ReturnType<typeof import("convex-test")["convexTest"]>;

export async function seedUser(
  t: TestBackend,
  args: {
    clerkId: string;
    name: string;
    role: "primary" | "partner";
    fixtureRunId?: string;
  }
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: `${args.clerkId}@example.test`,
      name: args.name,
      role: args.role,
      ...(args.fixtureRunId === undefined
        ? {}
        : { fixtureRunId: args.fixtureRunId }),
      timeZone: "UTC",
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });
  });
}

export async function seedActiveCouple(
  t: TestBackend,
  options: {
    sharingPhase?: boolean;
    sharingPeriodWrite?: boolean;
    fixtureRunId?: string | null;
  } = {}
) {
  const fixtureRunId =
    options.fixtureRunId === null
      ? undefined
      : options.fixtureRunId ?? "unit-test-run";
  const primaryId = await seedUser(t, {
    clerkId: "primary-clerk",
    name: "Primary Person",
    role: "primary",
    ...(fixtureRunId === undefined ? {} : { fixtureRunId }),
  });
  const partnerId = await seedUser(t, {
    clerkId: "partner-clerk",
    name: "Partner Person",
    role: "partner",
    ...(fixtureRunId === undefined ? {} : { fixtureRunId }),
  });

  const coupleId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("couples", {
      createdAt: Date.now(),
      linkedAt: Date.now(),
      status: "active",
    });

    await ctx.db.insert("coupleMembers", {
      coupleId: id,
      userId: primaryId,
      role: "primary",
      sharingPain: false,
      sharingPhase: options.sharingPhase ?? true,
      sharingPeriodWrite: options.sharingPeriodWrite ?? false,
      joinedAt: Date.now(),
    });
    await ctx.db.insert("coupleMembers", {
      coupleId: id,
      userId: partnerId,
      role: "partner",
      sharingPain: false,
      sharingPhase: false,
      sharingPeriodWrite: false,
      joinedAt: Date.now(),
    });

    return id;
  });

  return {
    coupleId,
    primaryId,
    partnerId,
    asPrimary: t.withIdentity({ subject: "primary-clerk" }),
    asPartner: t.withIdentity({ subject: "partner-clerk" }),
  };
}
