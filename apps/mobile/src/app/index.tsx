import { Redirect } from "expo-router";
import { useAuth } from "@clerk/expo";

export default function MobileFoundationHome() {
  const { isSignedIn } = useAuth();
  return <Redirect href={isSignedIn ? "/(app)" : "/(auth)/sign-in"} />;
}
