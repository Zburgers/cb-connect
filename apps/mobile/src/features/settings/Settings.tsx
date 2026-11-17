import { useEffect, useState } from "react";
import { useAuth } from "@clerk/expo";
import { useMutation, useQuery } from "convex/react";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, useColorScheme, View } from "react-native";
import type { NotificationPurpose } from "@cb-connect/contracts";
import { api } from "../../convex/api";
import { mobileColors } from "../../theme/tokens";
import { useThemePreference } from "../../theme/ThemePreferenceProvider";
import { themeModes } from "../../theme/themePreference";
import { getNotificationPurposeLabel, getVisibleNotificationPurposes } from "../notifications/presentation";
import { formatReminderTime, parseReminderTime } from "./reminderTime";

type SharingKey = "sharingPain" | "sharingPhase" | "sharingPeriodWrite";
type Gender = "prefer_not_to_say" | "female" | "male" | "other";
type PartnerType = "partner" | "boyfriend" | "girlfriend" | "spouse" | "other";

const genderOptions: { value: Gender; label: string }[] = [
  { value: "prefer_not_to_say", label: "Prefer not to say" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
];

const partnerTypeOptions: { value: PartnerType; label: string }[] = [
  { value: "partner", label: "Partner" },
  { value: "boyfriend", label: "Boyfriend" },
  { value: "girlfriend", label: "Girlfriend" },
  { value: "spouse", label: "Spouse" },
  { value: "other", label: "Other" },
];

type CycleValues = { cycleLength: number; periodLength: number };
type ProfileValues = { preferredName: string; gender: Gender; partnerType: PartnerType };

function sameCycleValues(left: CycleValues, right: CycleValues): boolean {
  return left.cycleLength === right.cycleLength && left.periodLength === right.periodLength;
}

function sameProfileValues(left: ProfileValues, right: ProfileValues): boolean {
  return left.preferredName === right.preferredName && left.gender === right.gender && left.partnerType === right.partnerType;
}

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
  const [genderDraft, setGenderDraft] = useState<Gender>("prefer_not_to_say");
  const [partnerTypeDraft, setPartnerTypeDraft] = useState<PartnerType>("partner");
  const [profileBaseline, setProfileBaseline] = useState<ProfileValues>({
    preferredName: "",
    gender: "prefer_not_to_say",
    partnerType: "partner",
  });
  const [profileDraftDirty, setProfileDraftDirty] = useState(false);
  const [profileConflict, setProfileConflict] = useState(false);
  const [cycleDraft, setCycleDraft] = useState<CycleValues>(() => ({
    cycleLength: cycleSettings?.cycleLength ?? 28,
    periodLength: cycleSettings?.periodLength ?? 5,
  }));
  const [cycleBaseline, setCycleBaseline] = useState<CycleValues>(() => ({
    cycleLength: cycleSettings?.cycleLength ?? 28,
    periodLength: cycleSettings?.periodLength ?? 5,
  }));
  const [cycleDraftDirty, setCycleDraftDirty] = useState(false);
  const [cycleConflict, setCycleConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reminderTimeDraft, setReminderTimeDraft] = useState<string | undefined>();
  const [reminderPickerOpen, setReminderPickerOpen] = useState(false);
  const zone = deviceTimeZone();

  useEffect(() => {
    if (!profile) return;
    const saved: ProfileValues = {
      preferredName: profile.preferredName ?? "",
      gender: profile.gender ?? "prefer_not_to_say",
      partnerType: profile.partnerType ?? "partner",
    };
    if (!profileDraftDirty) {
      if (nameDraft !== saved.preferredName) setNameDraft(saved.preferredName);
      if (genderDraft !== saved.gender) setGenderDraft(saved.gender);
      if (partnerTypeDraft !== saved.partnerType) setPartnerTypeDraft(saved.partnerType);
      if (!sameProfileValues(profileBaseline, saved)) setProfileBaseline(saved);
      if (profileConflict) setProfileConflict(false);
    } else if (sameProfileValues(saved, { preferredName: nameDraft, gender: genderDraft, partnerType: partnerTypeDraft })) {
      if (!sameProfileValues(profileBaseline, saved)) setProfileBaseline(saved);
      setProfileDraftDirty(false);
      if (profileConflict) setProfileConflict(false);
    } else if (!sameProfileValues(saved, profileBaseline)) {
      setProfileConflict(true);
    }
  }, [profile?.preferredName, profile?.gender, profile?.partnerType, profileDraftDirty, profileBaseline, nameDraft, genderDraft, partnerTypeDraft, profileConflict]);

  useEffect(() => {
    if (!cycleSettings) return;
    const saved = { cycleLength: cycleSettings.cycleLength, periodLength: cycleSettings.periodLength };
    if (!cycleDraftDirty) {
      if (!sameCycleValues(cycleDraft, saved)) setCycleDraft(saved);
      if (!sameCycleValues(cycleBaseline, saved)) setCycleBaseline(saved);
      if (cycleConflict) setCycleConflict(false);
    } else if (sameCycleValues(saved, cycleDraft)) {
      if (!sameCycleValues(cycleDraft, saved)) setCycleDraft(saved);
      if (!sameCycleValues(cycleBaseline, saved)) setCycleBaseline(saved);
      setCycleDraftDirty(false);
      if (cycleConflict) setCycleConflict(false);
    } else if (!sameCycleValues(saved, cycleBaseline)) {
      setCycleConflict(true);
    }
  }, [cycleSettings?.cycleLength, cycleSettings?.periodLength, cycleDraftDirty, cycleDraft, cycleBaseline, cycleConflict]);

  const run = async (action: () => Promise<unknown>, successMessage?: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(successMessage ?? "Settings updated.");
      return true;
    } catch {
      setError("Unable to update settings. Try again.");
      return false;
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

  const saveCycleSettings = () => {
    if (!isPrimary || cycleConflict || !cycleSettings) return Promise.resolve(false);
    const current = { cycleLength: cycleSettings.cycleLength, periodLength: cycleSettings.periodLength };
    if (!sameCycleValues(current, cycleBaseline)) {
      setCycleConflict(true);
      setError("These cycle settings changed elsewhere. Reload before saving.");
      return Promise.resolve(false);
    }
    return run(() => updateCycleSettings(cycleDraft), "Cycle settings updated.").then((saved) => {
      if (saved) {
        setCycleBaseline(cycleDraft);
        setCycleDraftDirty(false);
        setCycleConflict(false);
      }
      return saved;
    });
  };

  const saveProfilePreferences = () => {
    if (!profile || profileConflict) return Promise.resolve(false);
    const current: ProfileValues = {
      preferredName: profile.preferredName ?? "",
      gender: profile.gender ?? "prefer_not_to_say",
      partnerType: profile.partnerType ?? "partner",
    };
    if (!sameProfileValues(current, profileBaseline)) {
      setProfileConflict(true);
      setError("Profile preferences changed elsewhere. Reload before saving.");
      return Promise.resolve(false);
    }
    return run(() => updateProfile({
      preferredName: nameDraft,
      gender: genderDraft,
      partnerType: partnerTypeDraft,
    }), "Profile updated.").then((saved) => {
      if (saved) {
        setProfileBaseline({ preferredName: nameDraft, gender: genderDraft, partnerType: partnerTypeDraft });
        setProfileDraftDirty(false);
        setProfileConflict(false);
      }
      return saved;
    });
  };

  const reloadProfilePreferences = () => {
    if (!profile) return;
    const saved: ProfileValues = {
      preferredName: profile.preferredName ?? "",
      gender: profile.gender ?? "prefer_not_to_say",
      partnerType: profile.partnerType ?? "partner",
    };
    setNameDraft(saved.preferredName);
    setGenderDraft(saved.gender);
    setPartnerTypeDraft(saved.partnerType);
    setProfileBaseline(saved);
    setProfileDraftDirty(false);
    setProfileConflict(false);
  };

  const reloadCycleSettings = () => {
    if (!cycleSettings) return;
    const saved = { cycleLength: cycleSettings.cycleLength, periodLength: cycleSettings.periodLength };
    setCycleDraft(saved);
    setCycleBaseline(saved);
    setCycleDraftDirty(false);
    setCycleConflict(false);
    setError(null);
  };

  const changeCycleDraft = (change: Partial<CycleValues>) => {
    setCycleDraft((current) => ({ ...current, ...change }));
    setCycleDraftDirty(true);
    setCycleConflict(false);
    setError(null);
    setMessage(null);
  };

  if (profile === undefined || preferences === undefined || (isPrimary && couple === undefined)) {
    return <View style={[styles.loading, { backgroundColor: palette.background }]}><ActivityIndicator accessibilityLabel="Loading settings" /></View>;
  }
  if (!profile) {
    return <View accessibilityRole="alert" style={[styles.loading, { backgroundColor: palette.background }]}><Text style={{ color: palette.foreground }}>Settings are unavailable for this account.</Text></View>;
  }

  const visiblePurposes = getVisibleNotificationPurposes(profile.role === "primary" ? "primary" : "partner");
  const preferenceMap = new Map(preferences.map((preference) => [preference.purpose, preference]));
  const cycleWindowPreference = isPrimary ? preferenceMap.get("period_window_approaching") : undefined;
  const savedReminderTime = cycleWindowPreference?.localReminderTime ?? "";
  const reminderTime = reminderTimeDraft ?? savedReminderTime;
  const reminderPickerValue = profile.timeZone
    ? parseReminderTime(reminderTime, profile.timeZone) ?? new Date()
    : new Date();
  const handleReminderPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === "set" && selected && profile.timeZone) {
      setReminderTimeDraft(formatReminderTime(selected, profile.timeZone));
    }
    setReminderPickerOpen(false);
  };

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
          onChangeText={(value) => {
            setNameDraft(value);
            setProfileDraftDirty(true);
            setProfileConflict(false);
          }}
          placeholder="Preferred name"
          value={nameDraft}
          style={[styles.input, { color: palette.foreground, borderColor: palette.muted }]}
        />
        <Text allowFontScaling style={[styles.description, { color: palette.muted }]}>Gender</Text>
        <View style={styles.themeChoices}>
          {genderOptions.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={`Gender: ${option.label}`}
              accessibilityState={{ checked: genderDraft === option.value, disabled: busy }}
              disabled={busy}
              onPress={() => {
                setGenderDraft(option.value);
                setProfileDraftDirty(true);
                setProfileConflict(false);
              }}
              style={[styles.themeChoice, { borderColor: genderDraft === option.value ? palette.accent : palette.border, backgroundColor: genderDraft === option.value ? palette.highlight : "transparent" }]}
            >
              <Text allowFontScaling style={{ color: palette.foreground, textAlign: "center" }}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text allowFontScaling style={[styles.description, { color: palette.muted }]}>Relationship term</Text>
        <View style={styles.themeChoices}>
          {partnerTypeOptions.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={`Relationship term: ${option.label}`}
              accessibilityState={{ checked: partnerTypeDraft === option.value, disabled: busy }}
              disabled={busy}
              onPress={() => {
                setPartnerTypeDraft(option.value);
                setProfileDraftDirty(true);
                setProfileConflict(false);
              }}
              style={[styles.themeChoice, { borderColor: partnerTypeDraft === option.value ? palette.accent : palette.border, backgroundColor: partnerTypeDraft === option.value ? palette.highlight : "transparent" }]}
            >
              <Text allowFontScaling style={{ color: palette.foreground, textAlign: "center" }}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
        {profileConflict ? (
          <>
            <Text allowFontScaling accessibilityRole="alert" style={{ color: palette.foreground }}>Profile preferences changed elsewhere. Reload before saving.</Text>
            <ActionButton label="Reload profile preferences" disabled={busy} onPress={reloadProfilePreferences} palette={palette} />
          </>
        ) : null}
        <ActionButton label="Save profile preferences" disabled={busy || profileConflict || !profileDraftDirty} onPress={() => void saveProfilePreferences()} palette={palette} />
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
          const scheduledTimeNeedsSave = purpose === "period_window_approaching" &&
            !preference.inAppEnabled &&
            (reminderTime !== savedReminderTime || !savedReminderTime);
          return (
            <View key={purpose} style={styles.switchRow}>
              <Text allowFontScaling style={[styles.switchLabel, { color: palette.foreground }]}>{getNotificationPurposeLabel(purpose)}</Text>
              <Switch
                accessibilityLabel={getNotificationPurposeLabel(purpose)}
                accessibilityRole="switch"
                disabled={busy || scheduledTimeNeedsSave}
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
        {cycleWindowPreference ? (
          <View style={styles.reminderTime}>
            <Text allowFontScaling style={{ color: palette.foreground, fontWeight: "600" }}>Upcoming cycle window reminder time</Text>
            <Text allowFontScaling style={[styles.description, { color: palette.muted }]}>This clock time follows your saved account time zone: {profile.timeZone ?? "Not set"}. Changing your time zone keeps this clock time.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Reminder time for cycle window: ${reminderTime || "Choose a time"}`}
              accessibilityState={{ disabled: busy || !profile.timeZone }}
              disabled={busy || !profile.timeZone}
              onPress={() => setReminderPickerOpen(true)}
              style={[styles.button, { borderColor: palette.muted }]}
            >
              <Text allowFontScaling style={{ color: palette.foreground }}>{reminderTime || "Choose a time"}</Text>
            </Pressable>
            {!profile.timeZone ? <Text allowFontScaling style={[styles.description, { color: palette.muted }]}>Set an account time zone before choosing a reminder time.</Text> : null}
            {reminderPickerOpen ? (
              <DateTimePicker
                accessibilityLabel="Cycle window reminder time"
                mode="time"
                display="default"
                timeZoneName={profile.timeZone}
                value={reminderPickerValue}
                onChange={handleReminderPickerChange}
              />
            ) : null}
            <ActionButton
              label="Save reminder time"
              disabled={busy || !profile.timeZone || !reminderTime || reminderTime === savedReminderTime}
              onPress={() => void run(() => updatePreference({
                purpose: "period_window_approaching",
                inAppEnabled: cycleWindowPreference.inAppEnabled,
                localReminderTime: reminderTime,
              }), "Reminder time saved.").then((saved) => {
                if (saved) setReminderTimeDraft(undefined);
              })}
              palette={palette}
            />
          </View>
        ) : null}
      </View>

      {isPrimary ? (
        <>
          <View style={[styles.section, { borderColor: palette.border, backgroundColor: palette.glass }]}>
            <Text allowFontScaling accessibilityRole="header" style={[styles.sectionTitle, { color: palette.foreground }]}>Cycle settings</Text>
            <Text allowFontScaling style={[styles.description, { color: palette.muted }]}>Average cycle and period lengths are used by the saved cycle settings. Changes are applied by the existing account settings service.</Text>
            <Text allowFontScaling style={{ color: palette.foreground }}>Cycle length: {cycleDraft.cycleLength} days</Text>
            <View style={styles.themeChoices}>
              <ActionButton label="Decrease cycle length" disabled={busy || cycleDraft.cycleLength <= 21} onPress={() => changeCycleDraft({ cycleLength: cycleDraft.cycleLength - 1 })} palette={palette} />
              <ActionButton label="Increase cycle length" disabled={busy || cycleDraft.cycleLength >= 40} onPress={() => changeCycleDraft({ cycleLength: cycleDraft.cycleLength + 1 })} palette={palette} />
            </View>
            <Text allowFontScaling style={{ color: palette.foreground }}>Period length: {cycleDraft.periodLength} days</Text>
            <View style={styles.themeChoices}>
              <ActionButton label="Decrease period length" disabled={busy || cycleDraft.periodLength <= 2} onPress={() => changeCycleDraft({ periodLength: cycleDraft.periodLength - 1 })} palette={palette} />
              <ActionButton label="Increase period length" disabled={busy || cycleDraft.periodLength >= 8} onPress={() => changeCycleDraft({ periodLength: cycleDraft.periodLength + 1 })} palette={palette} />
            </View>
            {cycleConflict ? (
              <>
                <Text allowFontScaling accessibilityRole="alert" style={{ color: palette.foreground }}>These cycle settings changed elsewhere. Reload before saving.</Text>
                <ActionButton label="Reload cycle settings" disabled={busy || cycleSettings === undefined} onPress={reloadCycleSettings} palette={palette} />
              </>
            ) : null}
            <ActionButton label="Save cycle settings" disabled={busy || !cycleDraftDirty || cycleConflict || cycleSettings === undefined} onPress={() => void saveCycleSettings()} palette={palette} />
          </View>
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
  reminderTime: { gap: 10, paddingTop: 8 },
  switchLabel: { flex: 1, fontSize: 15 },
  themeChoices: { flexDirection: "row", gap: 8 },
  themeChoice: { flex: 1, justifyContent: "center", minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 8 },
  button: { minHeight: 48, justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 16 },
});
