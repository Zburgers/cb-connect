import { useEffect, useState, type PropsWithChildren } from "react";
import { Platform, Text, View } from "react-native";
import * as ScreenCapture from "expo-screen-capture";

const SCREEN_CAPTURE_KEY = "cb-connect-sensitive-screens";

export async function protectAppPrivacy(platform: "android" | "ios"): Promise<() => void> {
  await ScreenCapture.preventScreenCaptureAsync(SCREEN_CAPTURE_KEY);
  if (platform === "ios") await ScreenCapture.enableAppSwitcherProtectionAsync(1);

  return () => {
    void ScreenCapture.allowScreenCaptureAsync(SCREEN_CAPTURE_KEY).catch(() => {});
    if (platform === "ios") void ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => {});
  };
}

export function AppPrivacyShield({ children }: PropsWithChildren): React.JSX.Element {
  const [protectedReady, setProtectedReady] = useState(false);
  const [protectionFailed, setProtectionFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    let releaseProtection: (() => void) | undefined;

    void protectAppPrivacy(Platform.OS === "ios" ? "ios" : "android")
      .then((release) => {
        if (!mounted) {
          release();
          return;
        }
        releaseProtection = release;
        setProtectedReady(true);
      })
      .catch(() => {
        // Keep sensitive screens hidden if the platform privacy control fails.
        if (mounted) setProtectionFailed(true);
      });

    return () => {
      mounted = false;
      releaseProtection?.();
    };
  }, []);

  return protectedReady ? (
    <>{children}</>
  ) : (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#000" }}>
      <Text accessibilityRole={protectionFailed ? "alert" : "progressbar"} style={{ color: "#fff", textAlign: "center" }}>
        {protectionFailed ? "Privacy protection is unavailable. Close and reopen the app." : "Preparing a private screen…"}
      </Text>
    </View>
  );
}
