export type AuthLifecycleStatus =
  | "pending"
  | "signed_out"
  | "convex_pending"
  | "resolved"
  | "rejected";

export interface AuthStateInputs {
  isClerkLoaded?: boolean | null;
  isSignedIn?: boolean | null;
  isConvexLoading?: boolean | null;
  isConvexAuthenticated?: boolean | null;
}

export interface AuthGateResolution {
  status: AuthLifecycleStatus;
  canRenderChildren: boolean;
  shouldRedirect: boolean;
  redirectTo?: string;
  errorMessage?: string;
  accessibilityLabel: string;
}

/**
 * Pure state resolver for the AuthGate lifecycle.
 * Fails closed: never renders children unless Clerk is loaded, signed in,
 * and Convex confirms authentication.
 */
export function resolveAuthState(inputs: AuthStateInputs): AuthGateResolution {
  // Fail closed while Clerk is still initializing
  if (!inputs.isClerkLoaded) {
    return {
      status: "pending",
      canRenderChildren: false,
      shouldRedirect: false,
      accessibilityLabel: "Loading authentication status",
    };
  }

  // Redirect signed-out users to /(auth)/sign-in
  if (!inputs.isSignedIn) {
    return {
      status: "signed_out",
      canRenderChildren: false,
      shouldRedirect: true,
      redirectTo: "/(auth)/sign-in",
      accessibilityLabel: "Signed out, redirecting to sign in",
    };
  }

  // Clerk is signed in, but Convex is still verifying the session token
  if (inputs.isConvexLoading) {
    return {
      status: "convex_pending",
      canRenderChildren: false,
      shouldRedirect: false,
      accessibilityLabel: "Verifying secure session",
    };
  }

  // Clerk is signed in and Convex has confirmed the identity
  if (inputs.isConvexAuthenticated) {
    return {
      status: "resolved",
      canRenderChildren: true,
      shouldRedirect: false,
      accessibilityLabel: "Authenticated",
    };
  }

  // Clerk is signed in, but Convex finished loading and rejected the token
  // (e.g. session expired, invalid token, or unapproved issuer)
  return {
    status: "rejected",
    canRenderChildren: false,
    shouldRedirect: false,
    errorMessage: "Authentication failed. Please sign in again.",
    accessibilityLabel: "Authentication error",
  };
}
