import targets from "./targets.json";

export const MOBILE_AUTH_ERROR_MESSAGE = "Authentication is unavailable in this build.";
export const APPROVED_CLERK_ISSUER = targets.synthetic.issuer;
export const APPROVED_CONVEX_URL = targets.synthetic.convexUrl;
export const PRODUCTION_CLERK_ISSUER = targets.production.issuer;
export const PRODUCTION_CONVEX_URL = targets.production.convexUrl;

type PublicEnvironment = {
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  EXPO_PUBLIC_CONVEX_URL?: string;
  EXPO_PUBLIC_MOBILE_ENVIRONMENT?: string;
};

export type MobileAuthConfig = {
  publishableKey: string;
  convexUrl: string;
};

function isPublishableKeyFor(
  value: string | undefined,
  prefix: "pk_test_" | "pk_live_",
  issuer: string,
): value is string {
  if (!value?.startsWith(prefix)) return false;

  const encoded = value.slice(prefix.length);
  if (!/^[A-Za-z0-9_-]+$/.test(encoded) || encoded.length % 4 === 1) return false;

  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const frontendApi = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    return frontendApi === `${issuer}$`;
  } catch {
    return false;
  }
}

export function getMobileAuthConfig(
  env: PublicEnvironment = {
    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
    EXPO_PUBLIC_CONVEX_URL: process.env.EXPO_PUBLIC_CONVEX_URL,
    EXPO_PUBLIC_MOBILE_ENVIRONMENT: process.env.EXPO_PUBLIC_MOBILE_ENVIRONMENT,
  },
): MobileAuthConfig {
  const publishableKey = env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const environment = env.EXPO_PUBLIC_MOBILE_ENVIRONMENT ?? "synthetic";
  const production = environment === "production";
  const convexUrl = production ? PRODUCTION_CONVEX_URL : APPROVED_CONVEX_URL;
  if (
    (environment !== "synthetic" && environment !== "production") ||
    !isPublishableKeyFor(
      publishableKey,
      production ? "pk_live_" : "pk_test_",
      production ? PRODUCTION_CLERK_ISSUER : APPROVED_CLERK_ISSUER,
    ) ||
    env.EXPO_PUBLIC_CONVEX_URL !== convexUrl
  ) {
    throw new Error(MOBILE_AUTH_ERROR_MESSAGE);
  }

  return { publishableKey, convexUrl };
}
