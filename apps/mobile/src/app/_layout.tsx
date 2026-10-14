import { Stack } from "expo-router";

// M1 routing-only shell. Clerk/Convex providers are added in approved M2.
export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
