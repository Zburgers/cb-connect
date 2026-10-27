import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { useAuth } from "@clerk/expo";
import type { AccessState } from "../navigation/accessResolver";
import { mobileColors } from "../theme/tokens";
import { OfflineBanner } from "./OfflineBanner";

const statusCopy: Record<AccessState, string> = {
  auth_pending: "Checking your secure session…",
  unauthenticated: "Sign in to continue.",
  auth_rejected: "Your session needs attention. Please sign in again.",
  offline: "Protected features are hidden while you are offline.",
  backend_pending: "Checking account access…",
  onboarding_incomplete: "Account setup is not complete yet.",
  unlinked: "An active relationship is required for this area.",
  role_mismatch: "Account access is unavailable right now.",
  primary: "Your primary account is ready.",
  partner: "Your partner account is ready.",
};

export function SanctuaryShell({ state }: { state: AccessState }): React.JSX.Element {
  const { signOut } = useAuth();
  const palette = useColorScheme() === "dark" ? mobileColors.dark : mobileColors.light;
  const isLoading = state === "auth_pending" || state === "backend_pending";
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

  const handleSignOut = async () => {
    setSignOutFailed(false);
    setIsSigningOut(true);
    try {
      await signOut();
    } catch {
      setIsSigningOut(false);
      setSignOutFailed(true);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
      <OfflineBanner isOffline={state === "offline"} />
      <View style={styles.content}>
        <Text allowFontScaling accessibilityRole="header" style={[styles.title, { color: palette.foreground }]}>
          CB Connect
        </Text>
        <Text
          allowFontScaling
          accessibilityRole={isLoading ? "progressbar" : "text"}
          accessibilityLiveRegion={isLoading ? "polite" : undefined}
          style={[styles.message, { color: palette.muted }]}
        >
          {statusCopy[state]}
        </Text>
        {signOutFailed ? (
          <Text accessibilityRole="alert" style={[styles.signOutError, { color: palette.foreground }]}>
            Unable to sign out. Please try again.
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isSigningOut ? "Signing out" : "Sign out"}
          disabled={isSigningOut}
          onPress={handleSignOut}
          style={styles.signOutButton}
        >
          <Text allowFontScaling style={[styles.signOutText, { color: palette.foreground }]}>
            {isSigningOut ? "Signing out…" : "Sign out"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24 },
  content: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 12 },
  message: { fontSize: 16, textAlign: "center" },
  signOutButton: { minHeight: 48, justifyContent: "center", paddingHorizontal: 16, marginTop: 24 },
  signOutText: { fontSize: 16, fontWeight: "600" },
  signOutError: { fontSize: 14, textAlign: "center", marginTop: 16 },
});
