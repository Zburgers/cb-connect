import { Stack } from "expo-router";
import { useConvexConnectionState, useQuery } from "convex/react";
import { api } from "../../convex/api";
import { AuthGate } from "../../auth/AuthGate";
import { resolveAccessState } from "../../navigation/accessResolver";
import { AccessContext } from "../../navigation/accessContext";

function GuardedRoutes() {
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
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={access.canRenderProtectedContent}>
          <Stack.Screen name="index" />
          <Stack.Screen name="log" />
        </Stack.Protected>
        <Stack.Protected guard={!access.canRenderProtectedContent}>
          <Stack.Screen name="status" />
        </Stack.Protected>
      </Stack>
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
