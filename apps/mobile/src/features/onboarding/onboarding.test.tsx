import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  getDeviceTimeZone,
  isMobileRole,
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
    expect(screen).toContain("<ScrollView");
    expect(screen).toContain("<SafeAreaView");
    expect(screen).toContain("allowFontScaling");
    expect(screen).toContain("useColorScheme");
    expect(screen).toContain('accessibilityRole="button"');
    expect(screen).toMatch(/accessibilityState=\{\{\s*disabled:\s*saving/);
    expect(screen).toContain('accessibilityRole="alert"');
    expect(screen).not.toMatch(/\bheight:\s*\d/);
    expect(route).toContain("<AuthGate>");
  });
});
