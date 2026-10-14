import type { ExpoConfig } from "expo/config";

// Candidate beta IDs only: not signed, registered, or approved for release.
const config: ExpoConfig = {
  name: "CB Connect (Internal)",
  slug: "cb-connect",
  scheme: "cbconnectbeta",
  version: "0.0.1",
  orientation: "portrait",
  plugins: ["expo-router"],
  ios: { bundleIdentifier: "tech.builtbynaki.cbconnect.beta" },
  android: { package: "tech.builtbynaki.cbconnect.beta" },
  extra: { mobileEnvironment: "isolated-development-only" },
};
export default config;
