import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./AppProviders.tsx", import.meta.url), "utf8");
const appConfig = readFileSync(new URL("../../app.config.ts", import.meta.url), "utf8");

describe("mobile provider boundary", () => {
  it("wraps Convex with Clerk Expo and the Clerk SecureStore token cache", () => {
    expect(source).toContain('import { ClerkProvider, useAuth } from "@clerk/expo";');
    expect(source).toContain('import { ConvexProviderWithClerk } from "convex/react-clerk";');
    expect(source).toContain("tokenCache={tokenCache}");
    expect(source).toContain("useAuth={useAuth}");
    expect(source.indexOf("<ClerkProvider")).toBeLessThan(source.indexOf("<ClerkConvexProvider"));
    expect(source).not.toContain("AsyncStorage");
    expect(source).not.toMatch(/console\.(log|info|warn|error)/);
  });

  it("validates configuration before client creation and closes account clients", () => {
    expect(source.indexOf("getMobileAuthConfig()")).toBeLessThan(
      source.indexOf("new ConvexReactClient(convexUrl)"),
    );
    expect(source).toContain("JSON.stringify([userId, sessionId, orgId])");
    expect(source).toMatch(/setTimeout\(\(\) => \{\s*void client\.close\(\);\s*\}, 0\)/);
  });

  it("shows accessible loading while auth or the account client is pending", () => {
    expect(source).toContain("if (!isLoaded) return <AuthLoading />;");
    expect(source).toContain(
      "if (!entry || entry.accountKey !== accountKey) return <AuthLoading />;",
    );
    expect(source).toContain('accessibilityRole="progressbar"');
    expect(source).toContain('accessibilityLabel="Loading"');
    expect(source).toContain('accessibilityLiveRegion="polite"');
    expect(source).toContain("<Text>Loading…</Text>");
  });

  it("registers Clerk and SecureStore Expo config plugins", () => {
    expect(appConfig).toContain('"expo-secure-store", "@clerk/expo"');
  });
});
