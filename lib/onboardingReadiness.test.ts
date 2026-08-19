import { describe, expect, test } from "vitest";

import { canSelectOnboardingRole } from "./onboardingReadiness";

describe("onboarding readiness", () => {
  test.each([
    { isLoading: true, isAuthenticated: false },
    { isLoading: true, isAuthenticated: true },
    { isLoading: false, isAuthenticated: false },
  ])("blocks role selection until Convex auth is ready: %o", (state) => {
    expect(canSelectOnboardingRole(state)).toBe(false);
  });

  test("allows role selection after Convex authentication is ready", () => {
    expect(
      canSelectOnboardingRole({ isLoading: false, isAuthenticated: true }),
    ).toBe(true);
  });
});
