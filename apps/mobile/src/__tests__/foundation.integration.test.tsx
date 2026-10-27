import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("mobile foundation route boundary", () => {
  const layout = read("../app/(app)/_layout.tsx");
  const shell = read("../components/SanctuaryShell.tsx");
  const root = read("../app/_layout.tsx");
  const notFound = read("../app/+not-found.tsx");
  const metro = read("../../metro.config.js");

  it("places Clerk and Convex auth before backend role and relationship checks", () => {
    expect(layout).toContain("<AuthGate>");
    expect(layout).toContain("api.queries.mobileAccess.getGuardState");
    expect(layout).not.toMatch(/getMe|getCoupleStatus|getCapabilities/);
    expect(layout).toContain("<Tabs.Protected guard={access.canRenderProtectedContent}>");
    expect(layout).toContain("<Tabs.Protected guard={canRenderPartnerRoute(access)}>");
    expect(layout).toContain("<Tabs.Protected guard={!access.canRenderProtectedContent && access.state !== \"unlinked\"}>");
    expect(metro).toContain("config.watchFolders = [path.resolve(repositoryRoot, \"convex\")]");
    expect(metro).toMatch(
      /config\.resolver\.nodeModulesPaths\s*=\s*\[\s*path\.resolve\(projectRoot,\s*"node_modules"\)\s*\]/,
    );
    expect(metro).not.toContain('path.resolve(repositoryRoot, "node_modules")');
  });

  it("keeps status copy generic and renders no cycle or partner data", () => {
    expect(shell).toContain("OfflineBanner");
    expect(shell).not.toMatch(/cycle|period|pain|symptom|email|partner name/i);
  });

  it("contains route errors in an accessible privacy-safe fallback", () => {
    expect(root).toContain("<ErrorBoundary>");
    expect(root).toContain("<AppProviders>");
    expect(root).toContain("<AppPrivacyShield>");
    expect(root).toContain('<Stack.Screen name="onboarding" />');
    expect(root).toContain("<Stack.Protected guard={isLoaded && Boolean(isSignedIn)}>");
    expect(root).toContain('<Stack.Screen name="(auth)/sign-in" />');
    expect(root).toContain('<Stack.Screen name="(auth)/sign-up" />');
    expect(notFound).toContain("This link can’t be opened.");
    expect(notFound).not.toMatch(/useLocalSearchParams|userId|sessionId|email|password|partner|period|pain/i);
  });
});
