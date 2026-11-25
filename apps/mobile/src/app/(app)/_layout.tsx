import { Redirect, Tabs } from "expo-router";
import { useConvexConnectionState, useQuery } from "convex/react";
import { ActivityIndicator, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { api } from "../../convex/api";
import { AuthGate } from "../../auth/AuthGate";
import { canRenderChatRoute, canRenderPartnerRoute, resolveAccessState, resolvePrimaryCycleSetupRoute } from "../../navigation/accessResolver";
import { AccessContext } from "../../navigation/accessContext";
import { mobileColors } from "../../theme/tokens";
import { BloomTabLayout } from "../../components/BloomTabBar";
import { PresenceHeartbeat } from "../../features/home/PresenceHeartbeat";

function GuardedRoutes() {
  const palette = useColorScheme() === "dark" ? mobileColors.dark : mobileColors.light;
  const connection = useConvexConnectionState();
  const guardState = useQuery(api.queries.mobileAccess.getGuardState, {});
  const access = resolveAccessState({
    auth: "authenticated",
    online: connection.isWebSocketConnected,
    user: guardState?.user,
    couple: guardState?.couple,
    backendCurrent: connection.isWebSocketConnected && guardState !== undefined,
  });
  const periodHistory = useQuery(
    api.queries.history.getPeriodHistory,
    access.role === "primary" ? {} : "skip",
  );
  const cycleSetupRoute = resolvePrimaryCycleSetupRoute(access.role, periodHistory);

  if (cycleSetupRoute === "pending") {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, justifyContent: "center", backgroundColor: palette.background }}>
        <ActivityIndicator accessibilityLabel="Checking cycle setup" color={palette.accent} />
      </SafeAreaView>
    );
  }
  if (cycleSetupRoute === "onboarding") {
    return <Redirect href="/onboarding" />;
  }

  return (
    <AccessContext.Provider value={access.state}>
      {access.state === "primary" || access.state === "partner" ? (
        <PresenceHeartbeat />
      ) : null}
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: palette.background }}>
      <Tabs tabBar={() => null} layout={(props) => <BloomTabLayout {...props} dark={palette === mobileColors.dark} showDock={access.canRenderProtectedContent} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "transparent" } }}>
        <Tabs.Protected guard={access.canRenderProtectedContent}>
          <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} /> }} />
          <Tabs.Screen name="log" options={{ title: "Log", tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} /> }} />
        </Tabs.Protected>
        <Tabs.Protected guard={canRenderChatRoute(access)}>
          <Tabs.Screen name="chat" options={{ title: "Chat", tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" color={color} size={size} /> }} />
        </Tabs.Protected>
        <Tabs.Protected guard={canRenderPartnerRoute(access)}>
          <Tabs.Screen name="partner" options={{ title: "Partner", href: access.state === "unlinked" ? null : undefined, tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" color={color} size={size} /> }} />
        </Tabs.Protected>
        <Tabs.Protected guard={access.canRenderProtectedContent}>
          <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} /> }} />
          <Tabs.Screen name="notifications" options={{ href: null }} />
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
