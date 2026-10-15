import { Stack } from "expo-router";
import { useConvexConnectionState, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { AuthGate } from "../../auth/AuthGate";
import { resolveAccessState } from "../../navigation/accessResolver";
import { AccessContext } from "../../navigation/accessContext";

function GuardedRoutes() {
  const connection = useConvexConnectionState();
  const user = useQuery(api.queries.users.getMe, {});
  const couple = useQuery(api.queries.couples.getCoupleStatus, {});
  const capabilitiesQuery = useQuery(
    api.queries.capabilities.getCapabilities,
    user ? {} : "skip",
  );
  const capabilities = user === null ? {} : capabilitiesQuery;
  const backendCurrent =
    connection.isWebSocketConnected &&
    user !== undefined &&
    couple !== undefined &&
    (user === null || capabilitiesQuery !== undefined);
  const access = resolveAccessState({
    auth: "authenticated",
    online: connection.isWebSocketConnected,
    user: user ?? null,
    couple,
    capabilities,
    backendCurrent,
  });

  return (
    <AccessContext.Provider value={access.state}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={access.canRenderProtectedContent}>
          <Stack.Screen name="index" />
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
