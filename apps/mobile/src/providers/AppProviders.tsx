import { useEffect, useState, type PropsWithChildren } from "react";
import { ClerkProvider, useAuth } from "@clerk/expo";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { Text, View } from "react-native";
import { getMobileAuthConfig, MOBILE_AUTH_ERROR_MESSAGE } from "../auth/environment";
import { tokenCache } from "../auth/tokenCache";

type ClientEntry = {
  accountKey: string;
  client: ConvexReactClient;
};

export function AppProviders({ children }: PropsWithChildren) {
  let config;
  try {
    config = getMobileAuthConfig();
  } catch {
    return <AuthUnavailable />;
  }
  if (!tokenCache) return <AuthUnavailable />;

  return (
    <ClerkProvider publishableKey={config.publishableKey} tokenCache={tokenCache}>
      <ClerkConvexProvider convexUrl={config.convexUrl}>{children}</ClerkConvexProvider>
    </ClerkProvider>
  );
}

function AuthUnavailable() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text accessibilityRole="alert">{MOBILE_AUTH_ERROR_MESSAGE}</Text>
    </View>
  );
}

function AuthLoading() {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      accessibilityLiveRegion="polite"
      style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <Text>Loading…</Text>
    </View>
  );
}

function ClerkConvexProvider({ children, convexUrl }: PropsWithChildren<{ convexUrl: string }>) {
  const { isLoaded, userId, sessionId, orgId } = useAuth();
  if (!isLoaded) return <AuthLoading />;

  const accountKey = JSON.stringify([userId, sessionId, orgId]);
  return (
    <AccountConvexProvider key={accountKey} accountKey={accountKey} convexUrl={convexUrl}>
      {children}
    </AccountConvexProvider>
  );
}

function AccountConvexProvider({
  children,
  accountKey,
  convexUrl,
}: PropsWithChildren<{ accountKey: string; convexUrl: string }>) {
  const [entry, setEntry] = useState<ClientEntry | null>(null);

  useEffect(() => {
    const client = new ConvexReactClient(convexUrl);
    setEntry({ accountKey, client });
    return () => {
      // Let ConvexProviderWithClerk clear auth in its child effect before closing.
      setTimeout(() => {
        void client.close();
      }, 0);
    };
  }, [accountKey, convexUrl]);

  if (!entry || entry.accountKey !== accountKey) return <AuthLoading />;
  return (
    <ConvexProviderWithClerk client={entry.client} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
