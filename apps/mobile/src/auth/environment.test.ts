import { describe, expect, it } from "vitest";
import {
  APPROVED_CONVEX_URL,
  APPROVED_CLERK_ISSUER,
  getMobileAuthConfig,
  MOBILE_AUTH_ERROR_MESSAGE,
} from "./environment";

const testKeyForIssuer = (issuer: string) =>
  `pk_test_${btoa(`${issuer}$`).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
const testPublishableKey = testKeyForIssuer(APPROVED_CLERK_ISSUER);

describe("mobile auth environment boundary", () => {
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
