import { Tabs } from "expo-router";
import { useConvexConnectionState, useQuery } from "convex/react";
import { useRef } from "react";
import { StyleSheet, useColorScheme, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurTargetView, BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { api } from "../../convex/api";
import { AuthGate } from "../../auth/AuthGate";
import { canRenderPartnerRoute, resolveAccessState } from "../../navigation/accessResolver";
import { AccessContext } from "../../navigation/accessContext";
import { mobileColors } from "../../theme/tokens";

function GuardedRoutes() {
  const palette = useColorScheme() === "dark" ? mobileColors.dark : mobileColors.light;
  const blurTarget = useRef<View>(null);
  const connection = useConvexConnectionState();
  const guardState = useQuery(api.queries.mobileAccess.getGuardState, {});
  const access = resolveAccessState({
    auth: "authenticated",
    online: connection.isWebSocketConnected,
    user: guardState?.user,
    couple: guardState?.couple,
    backendCurrent: connection.isWebSocketConnected && guardState !== undefined,
  });

  return (
    <AccessContext.Provider value={access.state}>
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: palette.background }}>
      <BlurTargetView ref={blurTarget} style={StyleSheet.absoluteFill}>
        <LinearGradient colors={palette.atmosphere} style={StyleSheet.absoluteFill} />
      </BlurTargetView>
      <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "transparent" }, tabBarActiveTintColor: palette.accent, tabBarInactiveTintColor: palette.muted, tabBarStyle: { backgroundColor: palette.glass, borderTopColor: palette.border }, tabBarBackground: () => <BlurView blurTarget={blurTarget} blurMethod="dimezisBlurViewSdk31Plus" intensity={35} tint={palette === mobileColors.dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />, tabBarLabelStyle: { fontSize: 12, fontWeight: "600" }, tabBarItemStyle: { minHeight: 48 } }}>
        <Tabs.Protected guard={access.canRenderProtectedContent}>
          <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} /> }} />
          <Tabs.Screen name="log" options={{ title: "Log", tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} /> }} />
        </Tabs.Protected>
        <Tabs.Protected guard={canRenderPartnerRoute(access)}>
          <Tabs.Screen name="partner" options={{ title: "Partner", href: access.state === "unlinked" ? null : undefined, tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" color={color} size={size} /> }} />
        </Tabs.Protected>
        <Tabs.Protected guard={access.canRenderProtectedContent}>
          <Tabs.Screen name="notifications" options={{ title: "Inbox", tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" color={color} size={size} /> }} />
          <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} /> }} />
        </Tabs.Protected>
        <Tabs.Protected guard={!access.canRenderProtectedContent && access.state !== "unlinked"}>
          <Tabs.Screen name="status" options={{ href: null }} />
        </Tabs.Protected>
      </Tabs>
      </SafeAreaView>
    </AccessContext.Provider>
  );
}

export default function AppLayout() {
  return (
    <AuthGate>
      <GuardedRoutes />
    </AuthGate>
  );
}
