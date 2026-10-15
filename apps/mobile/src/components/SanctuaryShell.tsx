import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, Text, useColorScheme, View } from "react-native";
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
  const palette = useColorScheme() === "dark" ? mobileColors.dark : mobileColors.light;
  const isLoading = state === "auth_pending" || state === "backend_pending";

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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24 },
  content: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 12 },
  message: { fontSize: 16, textAlign: "center" },
});
