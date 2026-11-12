export const MOBILE_AUTH_ERROR_MESSAGE = "Authentication is unavailable in this build.";
export const APPROVED_CLERK_ISSUER = "holy-clam-29.clerk.accounts.dev";
export const APPROVED_CONVEX_URL = "https://hallowed-hummingbird-284.convex.cloud";

type PublicEnvironment = {
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  EXPO_PUBLIC_CONVEX_URL?: string;
};

export type MobileAuthConfig = {
  publishableKey: string;
  convexUrl: string;
};

function isTestPublishableKey(value: string | undefined): value is string {
  if (!value?.startsWith("pk_test_")) return false;

  const encoded = value.slice("pk_test_".length);
  if (!/^[A-Za-z0-9_-]+$/.test(encoded) || encoded.length % 4 === 1) return false;

  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const frontendApi = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    return frontendApi === `${APPROVED_CLERK_ISSUER}$`;
  } catch {
    return false;
  }
}

export function getMobileAuthConfig(
  env: PublicEnvironment = {
    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
    EXPO_PUBLIC_CONVEX_URL: process.env.EXPO_PUBLIC_CONVEX_URL,
  },
): MobileAuthConfig {
  const publishableKey = env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (
    !isTestPublishableKey(publishableKey) ||
    env.EXPO_PUBLIC_CONVEX_URL !== APPROVED_CONVEX_URL
  ) {
    throw new Error(MOBILE_AUTH_ERROR_MESSAGE);
  }

  return { publishableKey, convexUrl: APPROVED_CONVEX_URL };
}
