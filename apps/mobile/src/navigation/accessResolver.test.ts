import { describe, expect, it } from "vitest";
import { accessStatusRedirect, canRenderPartnerRoute, resolveAccessState, type AccessStateInputs } from "./accessResolver";

const ready: AccessStateInputs = {
  auth: "authenticated",
  online: true,
  user: { role: "primary" },
  couple: { isLinked: true, role: "primary" },
  backendCurrent: true,
};

describe("resolveAccessState", () => {
  it.each([
    ["Clerk pending", { auth: "pending" }, "auth_pending"],
    ["signed out", { auth: "signed_out" }, "unauthenticated"],
    ["Convex pending", { auth: "convex_pending" }, "auth_pending"],
    ["expired or rejected auth", { auth: "rejected" }, "auth_rejected"],
    ["offline", { online: false }, "offline"],
    ["stale post-reconnect data", { backendCurrent: false }, "backend_pending"],
    ["user query loading", { user: undefined }, "backend_pending"],
    ["couple query loading", { couple: undefined }, "backend_pending"],
    ["missing user", { user: null }, "onboarding_incomplete"],
    ["role absent", { user: { role: null } }, "onboarding_incomplete"],
    ["unlinked or revoked relationship", { couple: { isLinked: false, role: null } }, "unlinked"],
    ["missing relationship role", { couple: { isLinked: true, role: null } }, "role_mismatch"],
    ["inconsistent backend roles", { couple: { isLinked: true, role: "partner" } }, "role_mismatch"],
  ] as const)("blocks protected access for %s", (_label, patch, state) => {
    const result = resolveAccessState({ ...ready, ...patch } as AccessStateInputs);
    expect(result).toMatchObject({ state, canRenderProtectedContent: false });
    expect(result.role).toBeUndefined();
  });

  it.each(["primary", "partner"] as const)("allows only backend-confirmed %s access", (role) => {
    const result = resolveAccessState({
      ...ready,
      user: { role },
      couple: { isLinked: true, role },
    });
    expect(result).toEqual({ state: role, canRenderProtectedContent: true, role });
    expect(canRenderPartnerRoute(result)).toBe(true);
  });

  it("routes role-incomplete accounts to onboarding and role-complete unlinked accounts to pairing", () => {
    const onboarding = resolveAccessState({ ...ready, user: null });
    const unlinked = resolveAccessState({ ...ready, user: { role: "partner" }, couple: { isLinked: false, role: null } });
    const offline = resolveAccessState({ ...ready, online: false, user: { role: "partner" }, couple: { isLinked: false, role: null } });

    expect(accessStatusRedirect(onboarding.state)).toBe("/onboarding");
    expect(accessStatusRedirect(unlinked.state)).toBe("/(app)/partner");
    expect(canRenderPartnerRoute(unlinked)).toBe(true);
    expect(canRenderPartnerRoute(offline)).toBe(false);
    expect(accessStatusRedirect(offline.state)).toBeNull();
    expect(canRenderPartnerRoute(onboarding)).toBe(false);
  });
});
