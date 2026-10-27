import { useEffect, useState, type PropsWithChildren } from "react";
import { AppState, Platform, Text, View, type AppStateStatus } from "react-native";
import * as ScreenCapture from "expo-screen-capture";

const SCREEN_CAPTURE_KEY = "cb-connect-sensitive-screens";
let nextScreenCaptureKey = 0;
let appSwitcherUsers = 0;
let appSwitcherQueue: Promise<void> = Promise.resolve();

function queueAppSwitcher(operation: () => Promise<void>): Promise<void> {
  const pending = appSwitcherQueue.then(operation);
  appSwitcherQueue = pending.catch(() => {});
  return pending;
}

async function acquireAppSwitcherProtection(): Promise<() => void> {
  await queueAppSwitcher(async () => {
    if (appSwitcherUsers === 0) {
      try {
        await ScreenCapture.enableAppSwitcherProtectionAsync(1);
      } catch (error) {
        await ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => {});
        throw error;
      }
    }
    appSwitcherUsers += 1;
  });

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    void queueAppSwitcher(async () => {
      appSwitcherUsers -= 1;
      if (appSwitcherUsers === 0) await ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => {});
    });
  };
}

export async function protectAppPrivacy(platform: "android" | "ios"): Promise<() => void> {
  const screenCaptureKey = `${SCREEN_CAPTURE_KEY}-${++nextScreenCaptureKey}`;
  await ScreenCapture.preventScreenCaptureAsync(screenCaptureKey);

  let releaseAppSwitcher: (() => void) | undefined;
  if (platform === "ios") {
    try {
      releaseAppSwitcher = await acquireAppSwitcherProtection();
    } catch (error) {
      await ScreenCapture.allowScreenCaptureAsync(screenCaptureKey).catch(() => {});
      throw error;
    }
  }

  return () => {
    void ScreenCapture.allowScreenCaptureAsync(screenCaptureKey).catch(() => {});
    releaseAppSwitcher?.();
  };
}

export function mountAppPrivacyShield(
  platform: "android" | "ios",
  onReady: () => void,
  onFailure: () => void,
  onAppActiveChange: (active: boolean) => void = () => {},
): () => void {
  let mounted = true;
  let releaseProtection: (() => void) | undefined;
  const appStateSubscription = AppState.addEventListener("change", (state: AppStateStatus) => {
    onAppActiveChange(state === "active");
  });

  void protectAppPrivacy(platform)
    .then((release) => {
      if (!mounted) {
        release();
        return;
      }
      releaseProtection = release;
      onReady();
    })
    .catch(() => {
      if (mounted) onFailure();
    });

  return () => {
    mounted = false;
    appStateSubscription.remove();
    releaseProtection?.();
  };
}

export function AppPrivacyShield({ children }: PropsWithChildren): React.JSX.Element {
  const [protectedReady, setProtectedReady] = useState(false);
  const [protectionFailed, setProtectionFailed] = useState(false);
  const [appIsActive, setAppIsActive] = useState(AppState.currentState === "active");

  useEffect(
    () =>
      mountAppPrivacyShield(
        Platform.OS === "ios" ? "ios" : "android",
        () => setProtectedReady(true),
        () => setProtectionFailed(true),
        setAppIsActive,
      ),
    [],
  );

  return protectedReady && appIsActive ? (
    <>{children}</>
  ) : (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#000" }}>
      <Text accessibilityRole={protectionFailed ? "alert" : "progressbar"} style={{ color: "#fff", textAlign: "center" }}>
        {protectionFailed ? "Privacy protection is unavailable. Close and reopen the app." : "Preparing a private screen…"}
      </Text>
    </View>
  );
}
