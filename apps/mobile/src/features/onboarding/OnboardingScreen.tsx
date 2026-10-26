import React, { useState } from "react";
import { useRouter } from "expo-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { mobileColors } from "../../theme/tokens";
import { api } from "../../convex/api";
import {
  getDeviceTimeZone,
  isMobileRole,
  saveOnboardingRole,
  type MobileRole,
} from "./onboardingModel";

export function OnboardingScreen({
  onComplete,
}: {
  onComplete?: () => void;
}): React.JSX.Element {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.queries.users.getMe, isAuthenticated ? {} : "skip");
  const ensureUser = useMutation(api.mutations.users.ensureUser);
  const updateRole = useMutation(api.mutations.users.updateUserRole);
  const updateTimeZone = useMutation(api.mutations.users.updateUserTimeZone);
  const palette =
    useColorScheme() === "dark" ? mobileColors.dark : mobileColors.light;
  const [saving, setSaving] = useState(false);
  const [confirmedRole, setConfirmedRole] = useState<MobileRole | null>(null);
  const [failed, setFailed] = useState(false);

  const loading = isLoading || !isAuthenticated || me === undefined;
  const existingRole = me && isMobileRole(me.role) ? me.role : null;
  const complete = confirmedRole ?? existingRole;

  const chooseRole = async (role: MobileRole) => {
    setFailed(false);
    setSaving(true);
    try {
      const savedRole = await saveOnboardingRole({
        role,
        currentRole: existingRole ?? me?.role,
        timeZone: getDeviceTimeZone(),
        ensureUser: () => ensureUser({}),
        updateRole: (args) => updateRole(args),
        updateTimeZone: (args) => updateTimeZone(args),
      });
      setConfirmedRole(savedRole);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const finish = onComplete ?? (() => router.replace("/(app)"));
  const textStyle = { color: palette.foreground };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.background }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.screen,
          { backgroundColor: palette.background },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Text
            allowFontScaling
            accessibilityRole="header"
            style={[styles.title, textStyle]}
          >
            Welcome to CB Connect
          </Text>
          {loading ? (
            <Text
              allowFontScaling
              accessibilityRole="progressbar"
              accessibilityLiveRegion="polite"
              style={{ color: palette.muted }}
            >
              Checking your account…
            </Text>
          ) : complete ? (
            <>
              <Text allowFontScaling style={[styles.body, textStyle]}>
                Your {complete} role is saved.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Continue to your dashboard"
                onPress={finish}
                style={[
                  styles.button,
                  {
                    backgroundColor: palette.background,
                    borderColor: palette.muted,
                  },
                ]}
              >
                <Text allowFontScaling style={[styles.buttonText, textStyle]}>
                  Continue
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text
                allowFontScaling
                style={[styles.body, { color: palette.muted }]}
              >
                Choose how you will use the app. You can’t change this after
                setup.
              </Text>
              {failed ? (
                <Text
                  allowFontScaling
                  accessibilityRole="alert"
                  style={[styles.error, { color: palette.foreground }]}
                >
                  We couldn’t save your setup. Check your connection and try
                  again.
                </Text>
              ) : null}
              {(["primary", "partner"] as const).map((role) => (
                <Pressable
                  key={role}
                  accessibilityRole="button"
                  accessibilityLabel={`Set role to ${role}`}
                  accessibilityState={{
                    disabled: saving,
                    selected: confirmedRole === role,
                  }}
                  disabled={saving}
                  onPress={() => void chooseRole(role)}
                  style={[
                    styles.button,
                    {
                      backgroundColor: palette.background,
                      borderColor: palette.muted,
                    },
                  ]}
                >
                  <Text allowFontScaling style={[styles.buttonText, textStyle]}>
                    {saving
                      ? "Saving…"
                      : role === "primary"
                        ? "I track my cycle"
                        : "I support my partner"}
                  </Text>
                </Pressable>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  screen: { flexGrow: 1, justifyContent: "center", padding: 20 },
  content: { width: "100%", maxWidth: 480, alignSelf: "center", gap: 16 },
  title: { fontSize: 28, fontWeight: "700", flexShrink: 1 },
  body: { fontSize: 16, lineHeight: 24, flexShrink: 1 },
  button: {
    minHeight: 52,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    flexShrink: 1,
  },
  error: { fontSize: 15, lineHeight: 22 },
});
