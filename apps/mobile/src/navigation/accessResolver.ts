import type { MobileAccessContextDTO, MobileGuardRole } from "@cb-connect/contracts";

export interface AccessStateInputs {
  /** AuthGate lifecycle; backend queries are never trusted before Convex auth. */
  auth: "pending" | "signed_out" | "convex_pending" | "rejected" | "authenticated";
  online: boolean;
  user: MobileAccessContextDTO["user"] | undefined;
  couple: MobileAccessContextDTO["couple"] | undefined;
  /** False while loading, disconnected, or waiting for post-reconnect refresh. */
  backendCurrent: boolean;
}

export type AccessState =
  | "auth_pending"
  | "unauthenticated"
  | "auth_rejected"
  | "offline"
  | "backend_pending"
  | "onboarding_incomplete"
  | "unlinked"
  | "unlinked_primary"
  | "role_mismatch"
  | "primary"
  | "partner";

export interface AccessResolution {
  state: AccessState;
  canRenderProtectedContent: boolean;
  role?: MobileGuardRole;
}

export function canRenderPartnerRoute(access: AccessResolution): boolean {
  return access.canRenderProtectedContent || access.state === "unlinked";
}

/** Chat is a relationship-only destination, unlike private primary tracking. */
export function canRenderChatRoute(access: AccessResolution): boolean {
  return access.canRenderProtectedContent &&
    (access.state === "primary" || access.state === "partner");
}

export function accessStatusRedirect(state: AccessState): "/onboarding" | "/(app)/partner" | null {
  if (state === "onboarding_incomplete") return "/onboarding";
  if (state === "unlinked") return "/(app)/partner";
  return null;
}

export function resolvePrimaryCycleSetupRoute(
  role: MobileGuardRole | undefined,
  periodHistory: readonly unknown[] | undefined,
): "pending" | "onboarding" | "app" {
  if (role !== "primary") return "app";
  if (periodHistory === undefined) return "pending";
  return periodHistory.length === 0 ? "onboarding" : "app";
}

/** Resolve route access using only authenticated, current Convex query results. */
export function resolveAccessState(inputs: AccessStateInputs): AccessResolution {
  if (inputs.auth === "pending" || inputs.auth === "convex_pending") {
    return { state: "auth_pending", canRenderProtectedContent: false };
  }
  if (inputs.auth === "signed_out") {
    return { state: "unauthenticated", canRenderProtectedContent: false };
  }
  if (inputs.auth === "rejected") {
    return { state: "auth_rejected", canRenderProtectedContent: false };
  }
  if (!inputs.online) {
    return { state: "offline", canRenderProtectedContent: false };
  }
  if (
    !inputs.backendCurrent ||
    inputs.user === undefined ||
    inputs.couple === undefined
  ) {
    return { state: "backend_pending", canRenderProtectedContent: false };
  }
  if (!inputs.user?.role) {
    return { state: "onboarding_incomplete", canRenderProtectedContent: false };
  }
  if (!inputs.couple?.isLinked) {
    // Web permits primary users to track privately before connecting a partner.
    // Partner-only screens remain gated until a current relationship is confirmed.
    if (inputs.user.role === "primary") {
      return { state: "unlinked_primary", canRenderProtectedContent: true, role: "primary" };
    }
    return { state: "unlinked", canRenderProtectedContent: false };
  }
  if (!inputs.couple.role || inputs.couple.role !== inputs.user.role) {
    return { state: "role_mismatch", canRenderProtectedContent: false };
  }

  return {
    state: inputs.couple.role,
    canRenderProtectedContent: true,
    role: inputs.couple.role,
  };
}
