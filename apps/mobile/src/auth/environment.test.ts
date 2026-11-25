import { describe, expect, it } from "vitest";
import {
  APPROVED_CONVEX_URL,
  APPROVED_CLERK_ISSUER,
  getMobileAuthConfig,
  MOBILE_AUTH_ERROR_MESSAGE,
  PRODUCTION_CLERK_ISSUER,
  PRODUCTION_CONVEX_URL,
} from "./environment";

const testKeyForIssuer = (issuer: string) =>
  `pk_test_${btoa(`${issuer}$`).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
const testPublishableKey = testKeyForIssuer(APPROVED_CLERK_ISSUER);

describe("mobile auth environment boundary", () => {
  const productionKey = `pk_live_${btoa(`${PRODUCTION_CLERK_ISSUER}$`).replace(/=+$/, "")}`;

  it("requires an explicit production profile and the matching live issuer/backend", () => {
    expect(getMobileAuthConfig({
      EXPO_PUBLIC_MOBILE_ENVIRONMENT: "production",
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: productionKey,
      EXPO_PUBLIC_CONVEX_URL: PRODUCTION_CONVEX_URL,
    })).toEqual({ publishableKey: productionKey, convexUrl: PRODUCTION_CONVEX_URL });
  });

  it.each([
    ["production key in default profile", undefined, productionKey, PRODUCTION_CONVEX_URL],
    ["production key in synthetic profile", "synthetic", productionKey, PRODUCTION_CONVEX_URL],
    ["test issuer in production", "production", testPublishableKey, PRODUCTION_CONVEX_URL],
    ["test backend in production", "production", productionKey, APPROVED_CONVEX_URL],
    ["test-prefix production issuer", "production", testKeyForIssuer(PRODUCTION_CLERK_ISSUER), PRODUCTION_CONVEX_URL],
    ["unknown profile", "staging", testPublishableKey, APPROVED_CONVEX_URL],
  ])("rejects mixed or unknown release identity: %s", (_label, profile, key, url) => {
    expect(() => getMobileAuthConfig({
      EXPO_PUBLIC_MOBILE_ENVIRONMENT: profile,
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: key,
      EXPO_PUBLIC_CONVEX_URL: url,
    })).toThrowError(MOBILE_AUTH_ERROR_MESSAGE);
  });

  it("accepts only a well-formed test key for the approved synthetic Convex target", () => {
    expect(
      getMobileAuthConfig({
        EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: testPublishableKey,
        EXPO_PUBLIC_CONVEX_URL: APPROVED_CONVEX_URL,
      }),
    ).toEqual({
      publishableKey: testPublishableKey,
      convexUrl: APPROVED_CONVEX_URL,
    });
  });

  it.each([
    ["missing key", undefined, APPROVED_CONVEX_URL],
    ["live key", "pk_live_private-looking-value", APPROVED_CONVEX_URL],
    ["malformed test key", "pk_test_not-a-key", APPROVED_CONVEX_URL],
    ["different dev Clerk issuer", testKeyForIssuer("another.clerk.accounts.dev"), APPROVED_CONVEX_URL],
    ["production Clerk issuer", testKeyForIssuer("clerk.cb.builtbynaki.tech"), APPROVED_CONVEX_URL],
    ["wrong Convex target", testPublishableKey, "https://other.convex.cloud"],
    ["missing Convex URL", testPublishableKey, undefined],
  ])("fails closed for %s without echoing config", (_case, key, url) => {
    expect(() =>
      getMobileAuthConfig({
        EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: key,
        EXPO_PUBLIC_CONVEX_URL: url,
      }),
    ).toThrowError(MOBILE_AUTH_ERROR_MESSAGE);
  });
});
