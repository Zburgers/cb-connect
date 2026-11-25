import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@clerk/expo";
import { useConvexAuth } from "convex/react";
import { mobileColors } from "../theme/tokens";
import {
  resolveAuthState,
  type AuthGateResolution,
  type AuthLifecycleStatus,
  type AuthStateInputs,
} from "./authResolver";

export interface AuthGateProps {
  children: React.ReactNode;
}

export {
  resolveAuthState,
  type AuthGateResolution,
  type AuthLifecycleStatus,
  type AuthStateInputs,
};

/**
 * Gate 5 M2.2 AuthGate component.
 *
 * Enforces fail-closed lifecycle:
 * - Renders loading screen while Clerk or Convex is initializing.
 * - Redirects signed-out users to /(auth)/sign-in.
 * - Only renders children when Clerk is signed in AND Convex confirms auth.
 * - Renders generic accessible error if token is expired/rejected.
 */
export function AuthGate({ children }: AuthGateProps): React.JSX.Element {
  const palette = useColorScheme() === "dark" ? mobileColors.dark : mobileColors.light;
  const containerStyle = [styles.container, { backgroundColor: palette.background }];
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const { isLoading: isConvexLoading, isAuthenticated: isConvexAuthenticated } =
    useConvexAuth();

  const resolution = resolveAuthState({
    isClerkLoaded: isLoaded,
    isSignedIn: Boolean(isSignedIn),
    isConvexLoading,
    isConvexAuthenticated,
  });

  if (resolution.canRenderChildren) {
    return <>{children}</>;
  }

  if (resolution.status === "signed_out") {
    return (
      <View
        style={containerStyle}
        accessibilityRole="text"
        accessibilityLabel={resolution.accessibilityLabel}
      >
        <Redirect href="/(auth)/sign-in" />
        <Text style={[styles.messageText, { color: palette.muted }]} accessibilityLabel="Redirecting to sign-in">
          Redirecting to sign-in...
        </Text>
      </View>
    );
  }

  if (resolution.status === "pending") {
    return (
      <View
        style={containerStyle}
        accessibilityRole="progressbar"
        accessibilityLabel={resolution.accessibilityLabel}
        accessibilityLiveRegion="polite"
      >
        <ActivityIndicator
          size="large"
          color={palette.foreground}
          accessibilityLabel="Loading authentication status"
        />
        <Text style={[styles.messageText, { color: palette.muted }]}>Loading...</Text>
      </View>
    );
  }

  if (resolution.status === "convex_pending") {
    return (
      <View
        style={containerStyle}
        accessibilityRole="progressbar"
        accessibilityLabel={resolution.accessibilityLabel}
        accessibilityLiveRegion="polite"
      >
        <ActivityIndicator
          size="large"
          color={palette.foreground}
          accessibilityLabel="Securing connection"
        />
        <Text style={[styles.messageText, { color: palette.muted }]}>Securing connection...</Text>
      </View>
    );
  }

  // resolution.status === "rejected" (expired session or rejected token)
  return (
    <View
      style={containerStyle}
      accessibilityRole="alert"
      accessibilityLabel={resolution.accessibilityLabel}
    >
      <Text accessibilityRole="header" style={[styles.titleText, { color: palette.foreground }]}>
        Authentication Error
      </Text>
      <Text style={[styles.messageText, { color: palette.muted }]}>
        {resolution.errorMessage ?? "Authentication failed. Please sign in again."}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out and return to sign in"
        style={[styles.button, { backgroundColor: palette.foreground }]}
        onPress={async () => {
          try {
            await signOut();
          } catch {
            // fail-closed, no-op or fallback
          }
        }}
      >
        <Text style={[styles.buttonText, { color: palette.background }]}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  titleText: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
  },
  messageText: {
    fontSize: 15,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

export default AuthGate;
