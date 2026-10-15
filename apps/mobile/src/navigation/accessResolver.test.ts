import { describe, expect, it } from "vitest";
import { resolveAccessState, type AccessStateInputs } from "./accessResolver";

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
  });
});
