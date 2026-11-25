import React from "react";
import { describe, expect, it, vi } from "vitest";
import { AuthGate } from "./AuthGate";
import { resolveAuthState } from "./authResolver";
import { mobileColors } from "../theme/tokens";

const hooks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useConvexAuth: vi.fn(),
  useColorScheme: vi.fn(),
}));

vi.mock("@clerk/expo", () => ({ useAuth: hooks.useAuth }));
vi.mock("convex/react", () => ({ useConvexAuth: hooks.useConvexAuth }));
vi.mock("expo-router", () => ({ Redirect: "Redirect" }));
vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  Pressable: "Pressable",
  StyleSheet: { create: (styles: object) => styles },
  Text: "Text",
  useColorScheme: hooks.useColorScheme,
  View: "View",
}));

function findElement(node: React.ReactNode, type: string): React.ReactElement | undefined {
  for (const child of React.Children.toArray(node)) {
    if (!React.isValidElement(child)) continue;
    if (child.type === type) return child;
    const nested = findElement(
      (child.props as { children?: React.ReactNode }).children,
      type,
    );
    if (nested) return nested;
  }
  return undefined;
}

describe("AuthGate pure lifecycle state resolver", () => {
  it("fails closed in pending state while Clerk is not loaded", () => {
    const resolution = resolveAuthState({
      isClerkLoaded: false,
      isSignedIn: false,
      isConvexLoading: true,
      isConvexAuthenticated: false,
    });

    expect(resolution.status).toBe("pending");
    expect(resolution.canRenderChildren).toBe(false);
    expect(resolution.shouldRedirect).toBe(false);
    expect(resolution.accessibilityLabel).toBe("Loading authentication status");
  });

  it("redirects to /(auth)/sign-in when Clerk is loaded and signed out", () => {
    const resolution = resolveAuthState({
      isClerkLoaded: true,
      isSignedIn: false,
      isConvexLoading: false,
      isConvexAuthenticated: false,
    });

    expect(resolution.status).toBe("signed_out");
    expect(resolution.canRenderChildren).toBe(false);
    expect(resolution.shouldRedirect).toBe(true);
    expect(resolution.redirectTo).toBe("/(auth)/sign-in");
    expect(resolution.accessibilityLabel).toBe("Signed out, redirecting to sign in");
  });

  it("fails closed when Clerk is signed in but Convex auth is pending", () => {
    const resolution = resolveAuthState({
      isClerkLoaded: true,
      isSignedIn: true,
      isConvexLoading: true,
      isConvexAuthenticated: false,
    });

    expect(resolution.status).toBe("convex_pending");
    expect(resolution.canRenderChildren).toBe(false);
    expect(resolution.shouldRedirect).toBe(false);
    expect(resolution.accessibilityLabel).toBe("Verifying secure session");
  });

  it("resolves and renders children only after Convex confirms authentication", () => {
    const resolution = resolveAuthState({
      isClerkLoaded: true,
      isSignedIn: true,
      isConvexLoading: false,
      isConvexAuthenticated: true,
    });

    expect(resolution.status).toBe("resolved");
    expect(resolution.canRenderChildren).toBe(true);
    expect(resolution.shouldRedirect).toBe(false);
    expect(resolution.accessibilityLabel).toBe("Authenticated");
  });

  it("fails closed to rejected state when token is expired, rejected, or issuer mismatches", () => {
    const resolution = resolveAuthState({
      isClerkLoaded: true,
      isSignedIn: true,
      isConvexLoading: false,
      isConvexAuthenticated: false,
    });

    expect(resolution.status).toBe("rejected");
    expect(resolution.canRenderChildren).toBe(false);
    expect(resolution.shouldRedirect).toBe(false);
    expect(resolution.errorMessage).toBe("Authentication failed. Please sign in again.");
    expect(resolution.accessibilityLabel).toBe("Authentication error");
  });

  describe("fail-closed invariant checks", () => {
    it("fails closed when all inputs are undefined", () => {
      const resolution = resolveAuthState({});
      expect(resolution.canRenderChildren).toBe(false);
      expect(resolution.status).toBe("pending");
    });

    it("fails closed to signed_out if Clerk reports signed out even if Convex claimed authenticated", () => {
      const resolution = resolveAuthState({
        isClerkLoaded: true,
        isSignedIn: false,
        isConvexLoading: false,
        isConvexAuthenticated: true,
      });

      expect(resolution.status).toBe("signed_out");
      expect(resolution.canRenderChildren).toBe(false);
      expect(resolution.shouldRedirect).toBe(true);
      expect(resolution.redirectTo).toBe("/(auth)/sign-in");
    });

    it("fails closed if Convex is loading even if Convex was previously authenticated", () => {
      const resolution = resolveAuthState({
        isClerkLoaded: true,
        isSignedIn: true,
        isConvexLoading: true,
        isConvexAuthenticated: true,
      });

      expect(resolution.status).toBe("convex_pending");
      expect(resolution.canRenderChildren).toBe(false);
    });

    it("never exposes tokens, credentials, or user identities in resolution data", () => {
      const states = [
        resolveAuthState({ isClerkLoaded: false }),
        resolveAuthState({ isClerkLoaded: true, isSignedIn: false }),
        resolveAuthState({ isClerkLoaded: true, isSignedIn: true, isConvexLoading: true }),
        resolveAuthState({ isClerkLoaded: true, isSignedIn: true, isConvexLoading: false, isConvexAuthenticated: false }),
        resolveAuthState({ isClerkLoaded: true, isSignedIn: true, isConvexLoading: false, isConvexAuthenticated: true }),
      ];

      for (const res of states) {
        const serialized = JSON.stringify(res);
        expect(serialized).not.toMatch(/token/i);
        expect(serialized).not.toMatch(/secret/i);
        expect(serialized).not.toMatch(/bearer/i);
        expect(serialized).not.toMatch(/jwt/i);
      }
    });
  });
});

describe("AuthGate rendering boundary", () => {
  it("uses accessible colors for dark-mode authentication states", () => {
    hooks.useColorScheme.mockReturnValue("dark");
    hooks.useAuth.mockReturnValue({ isLoaded: true, isSignedIn: true, signOut: vi.fn() });
    hooks.useConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false });

    const rejected = AuthGate({ children: React.createElement("PrivateContent") });
    expect(rejected.props.style).toContainEqual(expect.objectContaining({ backgroundColor: mobileColors.dark.background }));
    const rejectedTitle = findElement(rejected, "Text");
    const rejectedTitleStyle = (rejectedTitle?.props as { style?: unknown[] } | undefined)?.style;
    expect(rejectedTitleStyle).toContainEqual(expect.objectContaining({ color: mobileColors.dark.foreground }));
    hooks.useColorScheme.mockReturnValue("light");
  });

  it("keeps protected children out until Convex confirms auth", () => {
    const child = React.createElement("PrivateContent", null, "private");
    hooks.useAuth.mockReturnValue({ isLoaded: true, isSignedIn: true, signOut: vi.fn() });
    hooks.useConvexAuth.mockReturnValue({ isLoading: true, isAuthenticated: false });

    const pending = AuthGate({ children: child });
    expect(pending.type).toBe("View");
    expect(JSON.stringify(pending)).not.toContain("PrivateContent");

    hooks.useConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true });
    const resolved = AuthGate({ children: child });
    expect(resolved.type).toBe(React.Fragment);
    expect(resolved.props.children).toBe(child);
  });

  it("redirects when Clerk signs out even if Convex still reports auth", () => {
    hooks.useAuth.mockReturnValue({ isLoaded: true, isSignedIn: false, signOut: vi.fn() });
    hooks.useConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true });

    const result = AuthGate({ children: React.createElement("PrivateContent") });
    expect(findElement(result, "Redirect")?.props).toMatchObject({
      href: "/(auth)/sign-in",
    });
    expect(JSON.stringify(result)).not.toContain("PrivateContent");
  });

  it("leaves rejected-session recovery available without logging out credentials", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    hooks.useAuth.mockReturnValue({ isLoaded: true, isSignedIn: true, signOut });
    hooks.useConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false });

    const result = AuthGate({ children: React.createElement("PrivateContent") });
    const button = findElement(result, "Pressable");
    expect(button).toBeDefined();
    await (button?.props as { onPress: () => Promise<void> }).onPress();
    expect(signOut).toHaveBeenCalledOnce();
    expect(JSON.stringify(result)).not.toMatch(/token|secret|bearer|jwt/i);
  });
});
