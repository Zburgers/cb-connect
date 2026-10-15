import { Stack } from "expo-router";
import { useAuth } from "@clerk/expo";
import { AppProviders } from "../providers/AppProviders";
import { ErrorBoundary } from "../components/ErrorBoundary";

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <AuthenticatedStack />
      </AppProviders>
    </ErrorBoundary>
  );
}

function AuthenticatedStack() {
  const { isLoaded, isSignedIn } = useAuth();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isLoaded && Boolean(isSignedIn)}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={isLoaded && !isSignedIn}>
        <Stack.Screen name="(auth)/sign-in" />
        <Stack.Screen name="(auth)/sign-up" />
      </Stack.Protected>
      <Stack.Screen name="index" />
    </Stack>
  );
}
