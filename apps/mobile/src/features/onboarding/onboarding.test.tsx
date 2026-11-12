import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  getDeviceDate,
  getDeviceTimeZone,
  getCertaintyChoiceStyle,
  getCycleSetupFailureMessage,
  hasInitialPeriod,
  isMobileRole,
  saveInitialCycleSetup,
  saveOnboardingRole,
} from "./onboardingModel";

describe("mobile onboarding role setup", () => {
  it("treats an unset backend user as eligible after the query resolves", () => {
    expect(isMobileRole(undefined)).toBe(false);
    expect(isMobileRole(null)).toBe(false);
    expect(isMobileRole("primary")).toBe(true);
    expect(isMobileRole("partner")).toBe(true);
  });

  it.each(["primary", "partner"] as const)(
    "saves %s only after backend receipts",
    async (role) => {
      const calls: string[] = [];
      const saved = await saveOnboardingRole({
        role,
        currentRole: undefined,
        timeZone: "Asia/Kolkata",
        ensureUser: async () => {
          calls.push("ensure");
        },
        updateTimeZone: async ({ timeZone }) => {
          calls.push(`timezone:${timeZone}`);
        },
        updateRole: async ({ role: nextRole }) => {
          calls.push(`role:${nextRole}`);
        },
      });
      expect(saved).toBe(role);
      expect(calls).toEqual([
        "ensure",
        "timezone:Asia/Kolkata",
        `role:${role}`,
      ]);
    },
  );

  it("allows idempotent retries for the already-confirmed role", async () => {
    const updateRole = vi.fn(async () => undefined);
    const dependencies = {
      role: "partner",
      currentRole: "partner",
      timeZone: "Europe/London",
      ensureUser: vi.fn(async () => undefined),
      updateTimeZone: vi.fn(async () => undefined),
      updateRole,
    };
    await saveOnboardingRole(dependencies);
    await saveOnboardingRole(dependencies);
    expect(updateRole).toHaveBeenCalledTimes(2);
  });

  it("rejects role changes and invalid roles before writing", async () => {
    const ensureUser = vi.fn(async () => undefined);
    await expect(
      saveOnboardingRole({
        role: "partner",
        currentRole: "primary",
        timeZone: "UTC",
        ensureUser,
        updateTimeZone: async () => undefined,
        updateRole: async () => undefined,
      }),
    ).rejects.toThrow("Role selection is unavailable");
    await expect(
      saveOnboardingRole({
        role: "admin",
        currentRole: undefined,
        timeZone: "UTC",
        ensureUser,
        updateTimeZone: async () => undefined,
        updateRole: async () => undefined,
      }),
    ).rejects.toThrow("Role selection is unavailable");
    expect(ensureUser).not.toHaveBeenCalled();
  });

  it("requires the device IANA time zone and does not fall back to UTC", async () => {
    const ensureUser = vi.fn(async () => undefined);
    await expect(
      saveOnboardingRole({
        role: "primary",
        currentRole: undefined,
        timeZone: null,
        ensureUser,
        updateTimeZone: async () => undefined,
        updateRole: async () => undefined,
      }),
    ).rejects.toThrow("A device time zone is required");
    expect(ensureUser).not.toHaveBeenCalled();

    const timeZone = getDeviceTimeZone();
    expect(timeZone).toBeTruthy();
    expect(
      () => new Intl.DateTimeFormat("en", { timeZone: timeZone! }),
    ).not.toThrow();
  });

  it("keeps the onboarding screen scalable, themed, and operable with assistive technology", () => {
    const screen = readFileSync(
      new URL("./OnboardingScreen.tsx", import.meta.url),
      "utf8",
    );
    const route = readFileSync(
      new URL("../../app/onboarding.tsx", import.meta.url),
      "utf8",
    );
    const appEntry = readFileSync(
      new URL("../../app/(app)/_layout.tsx", import.meta.url),
      "utf8",
    );
    expect(screen).toContain("<ScrollView");
    expect(screen).toContain("<SafeAreaView");
    expect(screen).toContain("allowFontScaling");
    expect(screen).toContain("useColorScheme");
    expect(screen).toContain('accessibilityRole="button"');
    expect(screen).toMatch(/accessibilityState=\{\{\s*disabled:\s*saving/);
    expect(screen).toContain('accessibilityRole="alert"');
    expect(screen).toContain("getCertaintyChoiceStyle(certainty === value, palette)");
    expect(screen).not.toMatch(/\bheight:\s*\d/);
    expect(route).toContain("<AuthGate>");
    expect(appEntry).toContain("resolvePrimaryCycleSetupRoute");
    expect(appEntry).toContain('access.role === "primary" ? {} : "skip"');
    expect(appEntry).toContain('<Redirect href="/onboarding" />');
    expect(screen).toContain("useConvexConnectionState");
    expect(screen).toContain("isOnline: () => onlineRef.current");
    expect(screen).toContain("Offline. Reconnect before saving your cycle setup.");
    expect(screen).toContain("saving || !startDate || !online");
  });
});

describe("mobile initial cycle setup", () => {
  const base = {
    startDate: "2026-11-10",
    startCertainty: "approximate" as const,
    cycleLength: 28,
    periodLength: 5,
    timeZone: "Asia/Kolkata",
    existingPeriods: [] as { startDate: string; certainty?: string }[],
  };

  it("routes an existing primary period to completion and a period-free primary to setup", () => {
    expect(hasInitialPeriod(undefined)).toBe(false);
    expect(hasInitialPeriod([])).toBe(false);
    expect(hasInitialPeriod([{ startDate: "2026-11-10" }])).toBe(true);
  });

  it("uses the device timezone for the current calendar date", () => {
    expect(getDeviceDate("Asia/Kolkata")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("writes settings before creating a period receipt", async () => {
    const calls: string[] = [];
    await saveInitialCycleSetup({
      ...base,
      isOnline: () => true,
      logPeriodStart: async (args) => {
        calls.push(`period:${args.startDate}:${args.startCertainty}:${args.timeZone}`);
      },
      updateCycleSettings: async (args) => {
        calls.push(`settings:${args.cycleLength}:${args.periodLength}`);
      },
      onSettingsSaved: () => calls.push("settings-receipt"),
    });
    expect(calls).toEqual([
      "settings:28:5",
      "settings-receipt",
      "period:2026-11-10:approximate:Asia/Kolkata",
    ]);
  });

  it("keeps setup retryable if the period write fails after settings are saved", async () => {
    let settingsSaved = false;
    const logPeriodStart = vi.fn(async () => {
      if (logPeriodStart.mock.calls.length === 1) throw new Error("offline");
    });
    const updateCycleSettings = vi.fn(async () => undefined);
    await expect(
      saveInitialCycleSetup({
        ...base,
        isOnline: () => true,
        logPeriodStart,
        updateCycleSettings,
        onSettingsSaved: () => {
          settingsSaved = true;
        },
      }),
    ).rejects.toThrow("offline");

    await saveInitialCycleSetup({
      ...base,
      isOnline: () => true,
      existingPeriods: [],
      logPeriodStart,
      updateCycleSettings,
      onSettingsSaved: () => {
        settingsSaved = true;
      },
    });
    expect(logPeriodStart).toHaveBeenCalledTimes(2);
    expect(updateCycleSettings).toHaveBeenCalledTimes(2);
    expect(settingsSaved).toBe(true);
  });

  it("shows a visible selected state for date certainty", () => {
    const palette = { accent: "red", border: "gray", glass: "white", highlight: "pink" };
    expect(getCertaintyChoiceStyle(true, palette)).toEqual({
      backgroundColor: "pink",
      borderColor: "red",
      borderWidth: 2,
    });
    expect(getCertaintyChoiceStyle(false, palette)).toEqual({
      backgroundColor: "white",
      borderColor: "gray",
      borderWidth: 1,
    });
  });

  it("reports the known write receipts after a failed setup attempt", () => {
    expect(getCycleSetupFailureMessage(true, true)).toBe(
      "Your cycle settings are saved. We couldn’t confirm that your period start date was saved. Retry to finish setup.",
    );
    expect(getCycleSetupFailureMessage(true, false)).toBe(
      "Your cycle settings are saved. The period start wasn’t submitted because the app is offline. Reconnect to finish setup.",
    );
    expect(getCycleSetupFailureMessage(false, false)).toBe(
      "The app is offline, so setup changes couldn’t be confirmed. Reconnect and retry.",
    );
    expect(getCycleSetupFailureMessage(false, true)).toBe(
      "We couldn’t confirm which setup changes were saved. Check your connection and retry.",
    );
  });

  it("does not create a period if saving cycle settings fails", async () => {
    const logPeriodStart = vi.fn(async () => undefined);
    const updateCycleSettings = vi.fn(async () => {
      throw new Error("offline");
    });
    await expect(
      saveInitialCycleSetup({ ...base, isOnline: () => true, logPeriodStart, updateCycleSettings }),
    ).rejects.toThrow("offline");
    expect(logPeriodStart).not.toHaveBeenCalled();
  });

  it("rejects an offline submission before either mutation is called", async () => {
    const logPeriodStart = vi.fn(async () => undefined);
    const updateCycleSettings = vi.fn(async () => undefined);
    await expect(
      saveInitialCycleSetup({
        ...base,
        isOnline: () => false,
        logPeriodStart,
        updateCycleSettings,
      }),
    ).rejects.toThrow("offline");
    expect(updateCycleSettings).not.toHaveBeenCalled();
    expect(logPeriodStart).not.toHaveBeenCalled();
  });

  it("preserves the settings receipt and skips period logging when connection drops between writes", async () => {
    let online = true;
    let settingsSaved = false;
    const logPeriodStart = vi.fn(async () => undefined);
    const updateCycleSettings = vi.fn(async () => undefined);
    await expect(
      saveInitialCycleSetup({
        ...base,
        isOnline: () => online,
        logPeriodStart,
        updateCycleSettings,
        onSettingsSaved: () => {
          settingsSaved = true;
          online = false;
        },
      }),
    ).rejects.toThrow("offline");
    expect(settingsSaved).toBe(true);
    expect(updateCycleSettings).toHaveBeenCalledOnce();
    expect(logPeriodStart).not.toHaveBeenCalled();
  });

  it("skips the period write when the selected event is already present", async () => {
    const logPeriodStart = vi.fn(async () => undefined);
    const updateCycleSettings = vi.fn(async () => undefined);
    await saveInitialCycleSetup({
      ...base,
      isOnline: () => true,
      existingPeriods: [{ startDate: base.startDate }],
      logPeriodStart,
      updateCycleSettings,
    });
    expect(logPeriodStart).not.toHaveBeenCalled();
    expect(updateCycleSettings).toHaveBeenCalledOnce();
  });

  it("rejects missing timezone, dates, and out-of-range settings before writing", async () => {
    const logPeriodStart = vi.fn(async () => undefined);
    const updateCycleSettings = vi.fn(async () => undefined);
    for (const invalid of [
      { ...base, startDate: "" },
      { ...base, timeZone: null },
      { ...base, cycleLength: 20 },
      { ...base, cycleLength: 41 },
      { ...base, periodLength: 1 },
      { ...base, periodLength: 9 },
    ]) {
      await expect(
        saveInitialCycleSetup({ ...invalid, isOnline: () => true, logPeriodStart, updateCycleSettings }),
      ).rejects.toThrow();
    }
    expect(logPeriodStart).not.toHaveBeenCalled();
    expect(updateCycleSettings).not.toHaveBeenCalled();
  });
});
