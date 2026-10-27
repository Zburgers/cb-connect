import { useEffect, useState } from "react";
import { useAuth } from "@clerk/expo";
import { useMutation, useQuery } from "convex/react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, useColorScheme, View } from "react-native";
import type { NotificationPurpose } from "@cb-connect/contracts";
import { api } from "../../convex/api";
import { mobileColors } from "../../theme/tokens";
import { useThemePreference } from "../../theme/ThemePreferenceProvider";
import { themeModes } from "../../theme/themePreference";
import { getNotificationPurposeLabel, getVisibleNotificationPurposes } from "../notifications/presentation";

type SharingKey = "sharingPain" | "sharingPhase" | "sharingPeriodWrite";

function deviceTimeZone(): string | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && zone.length <= 128 ? zone : null;
  } catch {
    return null;
  }
}

export function Settings() {
  const palette = useColorScheme() === "dark" ? mobileColors.dark : mobileColors.light;
  const { mode: themeMode, ready: themeReady, setMode: setThemeMode } = useThemePreference();
  const { signOut } = useAuth();
  const profile = useQuery(api.queries.users.getMe, {});
  const isPrimary = profile?.role === "primary";
  const couple = useQuery(api.queries.couples.getCoupleStatus, isPrimary ? {} : "skip");
  const preferences = useQuery(api.queries.notifications.getMyPreferences, {});
  const cycleSettings = useQuery(api.queries.history.getCycleSettings, isPrimary ? {} : "skip");
  const segmentOptions = useQuery(api.queries.history.getPredictionSegmentOptions, isPrimary ? {} : "skip");
  const updatePreference = useMutation(api.mutations.notifications.setMyPreference);
  const updateTimeZone = useMutation(api.mutations.users.updateUserTimeZone);
  const updateProfile = useMutation(api.mutations.users.updateUserPreferences);
  const updateCycleSettings = useMutation(api.mutations.periods.updateCycleSettings);
  const createSegment = useMutation(api.mutations.cycleContext.createPredictionSegment);
  const updateSharing = useMutation(api.mutations.couples.updateSharingSettings);
  const [nameDraft, setNameDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const zone = deviceTimeZone();

  useEffect(() => setNameDraft(profile?.preferredName ?? ""), [profile?.preferredName]);

  const run = async (action: () => Promise<unknown>, successMessage?: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(successMessage ?? "Settings updated.");
    } catch {
      setError("Unable to update settings. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const changeSharing = (key: SharingKey, value: boolean) => {
    const args = key === "sharingPain"
      ? { sharingPain: value }
      : key === "sharingPhase"
        ? { sharingPhase: value }
        : { sharingPeriodWrite: value };
    return run(() => updateSharing(args), "Sharing settings updated.");
  };

  if (profile === undefined || preferences === undefined || (isPrimary && couple === undefined)) {
    return <View style={[styles.loading, { backgroundColor: palette.background }]}><ActivityIndicator accessibilityLabel="Loading settings" /></View>;
  }
  if (!profile) {
    return <View accessibilityRole="alert" style={[styles.loading, { backgroundColor: palette.background }]}><Text style={{ color: palette.foreground }}>Settings are unavailable for this account.</Text></View>;
  }

  const visiblePurposes = getVisibleNotificationPurposes(profile.role === "primary" ? "primary" : "partner");
  const preferenceMap = new Map(preferences.map((preference) => [preference.purpose, preference]));

  return (
    <ScrollView contentContainerStyle={styles.container} style={{ backgroundColor: "transparent" }}>
      <Text allowFontScaling accessibilityRole="header" style={[styles.title, { color: palette.foreground }]}>Settings</Text>
      {error ? <Text allowFontScaling accessibilityRole="alert" style={[styles.notice, { color: palette.foreground, backgroundColor: palette.highlight }]}>{error}</Text> : null}
      {message ? <Text allowFontScaling accessibilityLiveRegion="polite" style={[styles.notice, { color: palette.foreground, backgroundColor: palette.highlight }]}>{message}</Text> : null}

      <View style={[styles.section, { borderColor: palette.border, backgroundColor: palette.glass }]}>
        <Text allowFontScaling accessibilityRole="header" style={[styles.sectionTitle, { color: palette.foreground }]}>Appearance</Text>
        <Text allowFontScaling style={[styles.description, { color: palette.muted }]}>Choose how CB Connect looks. System follows your device setting.</Text>
        <View style={styles.themeChoices}>
          {themeModes.map((choice) => (
            <Pressable
              key={choice}
              accessibilityRole="radio"
              accessibilityLabel={`${choice[0].toUpperCase()}${choice.slice(1)} appearance`}
              accessibilityState={{ checked: themeMode === choice, disabled: !themeReady }}
              disabled={!themeReady}
              onPress={() => void setThemeMode(choice).catch(() => setError("Unable to save appearance preference. Try again."))}
              style={[styles.themeChoice, { borderColor: themeMode === choice ? palette.accent : palette.border, backgroundColor: themeMode === choice ? palette.highlight : "transparent" }]}
            >
              <Text allowFontScaling style={{ color: palette.foreground, textAlign: "center" }}>{choice[0].toUpperCase()}{choice.slice(1)}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[styles.section, { borderColor: palette.border, backgroundColor: palette.glass }]}>
        <Text allowFontScaling accessibilityRole="header" style={[styles.sectionTitle, { color: palette.foreground }]}>Profile</Text>
        <TextInput
          accessibilityLabel="Preferred name"
          maxLength={40}
          onChangeText={setNameDraft}
          placeholder="Preferred name"
          value={nameDraft}
          style={[styles.input, { color: palette.foreground, borderColor: palette.muted }]}
        />
        <ActionButton label="Save preferred name" disabled={busy} onPress={() => void run(() => updateProfile({ preferredName: nameDraft }), "Profile updated.")} palette={palette} />
      </View>

      <View style={[styles.section, { borderColor: palette.border, backgroundColor: palette.glass }]}>
        <Text allowFontScaling accessibilityRole="header" style={[styles.sectionTitle, { color: palette.foreground }]}>Time zone</Text>
        <Text allowFontScaling style={{ color: palette.muted }}>Saved: {profile.timeZone ?? "Not set"}</Text>
        <Text allowFontScaling style={{ color: palette.muted }}>This device: {zone ?? "Unavailable"}</Text>
        <ActionButton
          label="Use this device time zone"
          disabled={busy || zone === null || zone === profile.timeZone}
          onPress={() => zone && void run(() => updateTimeZone({ timeZone: zone }), "Time zone updated.")}
          palette={palette}
        />
      </View>

      <View style={[styles.section, { borderColor: palette.border, backgroundColor: palette.glass }]}>
        <Text allowFontScaling accessibilityRole="header" style={[styles.sectionTitle, { color: palette.foreground }]}>In-app notifications</Text>
        <Text allowFontScaling style={[styles.description, { color: palette.muted }]}>These preferences control in-app notifications only. Push delivery is not available in this build; device permission and push channel availability are separate.</Text>
        {visiblePurposes.map((purpose: NotificationPurpose) => {
          const preference = preferenceMap.get(purpose);
          if (!preference) return null;
          return (
            <View key={purpose} style={styles.switchRow}>
              <Text allowFontScaling style={[styles.switchLabel, { color: palette.foreground }]}>{getNotificationPurposeLabel(purpose)}</Text>
              <Switch
                accessibilityLabel={getNotificationPurposeLabel(purpose)}
                accessibilityRole="switch"
                disabled={busy}
                onValueChange={(value) => void run(() => updatePreference({
                  purpose,
                  inAppEnabled: value,
                  ...(preference.localReminderTime === undefined ? {} : { localReminderTime: preference.localReminderTime }),
                }))}
                value={preference.inAppEnabled}
              />
            </View>
          );
        })}
      </View>

      {isPrimary ? (
        <>
          <View style={[styles.section, { borderColor: palette.border, backgroundColor: palette.glass }]}>
            <Text allowFontScaling accessibilityRole="header" style={[styles.sectionTitle, { color: palette.foreground }]}>Private prediction controls</Text>
            <Text allowFontScaling style={[styles.description, { color: palette.muted }]}>Pausing predictions affects only your account and is not shared with your partner.</Text>
            <SettingSwitch
              label="Pause predictions"
              value={cycleSettings?.predictionPaused ?? false}
              disabled={busy || cycleSettings === undefined}
              palette={palette}
              onValueChange={(value) => void run(() => updateCycleSettings({ predictionPaused: value }))}
            />
            <Text allowFontScaling accessibilityRole="header" style={[styles.subsectionTitle, { color: palette.foreground }]}>Private context</Text>
            {segmentOptions?.eligibleStartDates.map((date) => (
              <ActionButton
                key={date}
                label={segmentOptions.activeStartDate === date ? `Current context: ${date}` : `Start private context at ${date}`}
                disabled={busy || segmentOptions.activeStartDate === date}
                onPress={() => void run(() => createSegment({ startDate: date }), "Private context updated.")}
                palette={palette}
              />
            ))}
            {segmentOptions === null ? <Text allowFontScaling style={{ color: palette.muted }}>Private context controls are unavailable while prediction context is disabled or history is incomplete.</Text> : null}
          </View>
          <View style={[styles.section, { borderColor: palette.border, backgroundColor: palette.glass }]}>
            <Text allowFontScaling accessibilityRole="header" style={[styles.sectionTitle, { color: palette.foreground }]}>Sharing</Text>
            <Text allowFontScaling style={[styles.description, { color: palette.muted }]}>Changes take effect through your account’s sharing settings.</Text>
            {couple?.sharingSettings ? (
              <>
                <SettingSwitch label="Share phase" value={couple.sharingSettings.phase} disabled={busy} palette={palette} onValueChange={(value) => void changeSharing("sharingPhase", value)} />
                <SettingSwitch label="Share pain details" value={couple.sharingSettings.pain} disabled={busy} palette={palette} onValueChange={(value) => void changeSharing("sharingPain", value)} />
                <SettingSwitch label="Allow period assistance" value={couple.sharingSettings.periodWrite} disabled={busy || !couple.sharingSettings.phase} palette={palette} onValueChange={(value) => void changeSharing("sharingPeriodWrite", value)} />
              </>
            ) : <Text allowFontScaling style={{ color: palette.muted }}>Sharing controls are unavailable for this account.</Text>}
          </View>
        </>
      ) : null}

      <View style={[styles.section, { borderColor: palette.border, backgroundColor: palette.glass }]}>
        <Text allowFontScaling accessibilityRole="header" style={[styles.sectionTitle, { color: palette.foreground }]}>Account</Text>
        <Text allowFontScaling style={[styles.description, { color: palette.muted }]}>Account deletion is unavailable until the retention and deletion policy is approved.</Text>
        <ActionButton label={busy ? "Signing out" : "Sign out"} disabled={busy} onPress={() => void run(signOut, "Signed out.")} palette={palette} />
      </View>
    </ScrollView>
  );
}

function SettingSwitch({
  label,
  value,
  disabled,
  palette,
  onValueChange,
}: {
  label: string;
  value: boolean;
  disabled: boolean;
  palette: (typeof mobileColors)["light"] | (typeof mobileColors)["dark"];
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Text allowFontScaling style={[styles.switchLabel, { color: palette.foreground }]}>{label}</Text>
      <Switch accessibilityLabel={label} accessibilityRole="switch" disabled={disabled} onValueChange={onValueChange} value={value} />
    </View>
  );
}

function ActionButton({
  label,
  disabled,
  onPress,
  palette,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  palette: (typeof mobileColors)["light"] | (typeof mobileColors)["dark"];
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.button, { borderColor: palette.muted }]}>
      <Text allowFontScaling style={{ color: palette.foreground }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: 20, paddingBottom: 36, gap: 16 },
  title: { fontSize: 30, fontWeight: "600", letterSpacing: -0.5 },
  section: { gap: 12, padding: 16, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth },
  sectionTitle: { fontSize: 18, fontWeight: "600" },
  subsectionTitle: { fontSize: 16, fontWeight: "600" },
  description: { fontSize: 14, lineHeight: 21 },
  notice: { borderRadius: 14, padding: 12, fontSize: 14, lineHeight: 20 },
  input: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 12 },
  switchRow: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  switchLabel: { flex: 1, fontSize: 15 },
  themeChoices: { flexDirection: "row", gap: 8 },
  themeChoice: { flex: 1, justifyContent: "center", minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 8 },
  button: { minHeight: 48, justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 16 },
});
