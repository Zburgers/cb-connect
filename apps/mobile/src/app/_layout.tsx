import { Stack } from "expo-router";
import { useAuth } from "@clerk/expo";
import { AppProviders } from "../providers/AppProviders";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { AppPrivacyShield } from "../security/appPrivacy";
import { StatusBar } from "expo-status-bar";
import { ThemePreferenceProvider } from "../theme/ThemePreferenceProvider";

export default function RootLayout() {
  return (
    <ThemePreferenceProvider>
      <ErrorBoundary>
        <AppPrivacyShield>
          <AppProviders>
            <StatusBar style="auto" />
            <AuthenticatedStack />
          </AppProviders>
        </AppPrivacyShield>
      </ErrorBoundary>
    </ThemePreferenceProvider>
  );
}

function AuthenticatedStack() {
  const { isLoaded, isSignedIn } = useAuth();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isLoaded && Boolean(isSignedIn)}>
        <Stack.Screen name="onboarding" />
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
