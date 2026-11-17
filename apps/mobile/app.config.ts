import type { ExpoConfig } from "expo/config";
import targets from "./src/auth/targets.json";

const environment = process.env.EXPO_PUBLIC_MOBILE_ENVIRONMENT ?? "synthetic";
if (environment !== "synthetic" && environment !== "production") {
  throw new Error("Unknown mobile build profile");
}
const production = environment === "production";
// Validate production builds at configuration time as well as at runtime.
if (production) {
  const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const encoded = key.slice("pk_live_".length);
  if (
    !key.startsWith("pk_live_") ||
    !/^[A-Za-z0-9_-]+$/.test(encoded) ||
    encoded.length % 4 === 1 ||
    Buffer.from(encoded, "base64url").toString("utf8") !== `${targets.production.issuer}$` ||
    process.env.EXPO_PUBLIC_CONVEX_URL !== targets.production.convexUrl
  ) {
    throw new Error("Invalid production mobile build identity");
  }
}
const identifier = production ? "tech.builtbynaki.cbconnect" : "tech.builtbynaki.cbconnect.beta";

const config: ExpoConfig = {
  name: production ? "CB Connect" : "CB Connect (Internal)",
  slug: "cb-connect",
  scheme: production ? "cbconnect" : "cbconnectbeta",
  version: production ? "0.1.0" : "0.0.1",
  orientation: "portrait",
  plugins: ["expo-router", "expo-secure-store", "@clerk/expo", "expo-font", "@react-native-community/datetimepicker", "expo-sharing", "./plugins/withOwnerAndroidSigning.cjs"],
  ios: { bundleIdentifier: identifier },
  android: { package: identifier, versionCode: 1 },
  extra: { mobileEnvironment: environment },
};
export default config;
