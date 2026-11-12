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
import { LinearGradient } from "expo-linear-gradient";
import { mobileColors } from "../../theme/tokens";
import { api } from "../../convex/api";
import { DateField } from "../logging/DateField";
import {
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
  getDeviceDate,
  getDeviceTimeZone,
  hasInitialPeriod,
  isMobileRole,
  MAX_CYCLE_LENGTH,
  MAX_PERIOD_LENGTH,
  MIN_CYCLE_LENGTH,
  MIN_PERIOD_LENGTH,
  saveInitialCycleSetup,
  saveOnboardingRole,
  type MobileRole,
  type PeriodCertainty,
} from "./onboardingModel";

export function OnboardingScreen({
  onComplete,
}: {
  onComplete?: () => void;
}): React.JSX.Element {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.queries.users.getMe, isAuthenticated ? {} : "skip");
  const periodHistory = useQuery(
    api.queries.history.getPeriodHistory,
    isAuthenticated ? {} : "skip",
  );
  const ensureUser = useMutation(api.mutations.users.ensureUser);
  const updateRole = useMutation(api.mutations.users.updateUserRole);
  const updateTimeZone = useMutation(api.mutations.users.updateUserTimeZone);
  const logPeriodStart = useMutation(api.mutations.periods.logPeriodStart);
  const updateCycleSettings = useMutation(api.mutations.periods.updateCycleSettings);
  const palette =
    useColorScheme() === "dark" ? mobileColors.dark : mobileColors.light;
  const [saving, setSaving] = useState(false);
  const [confirmedRole, setConfirmedRole] = useState<MobileRole | null>(null);
  const [failed, setFailed] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [certainty, setCertainty] = useState<PeriodCertainty>("exact");
  const [cycleLength, setCycleLength] = useState(DEFAULT_CYCLE_LENGTH);
  const [periodLength, setPeriodLength] = useState(DEFAULT_PERIOD_LENGTH);
  const [setupSaved, setSetupSaved] = useState(false);
  const [savedPeriodStart, setSavedPeriodStart] = useState<string | null>(null);

  const loading = isLoading || !isAuthenticated || me === undefined || periodHistory === undefined;
  const existingRole = me && isMobileRole(me.role) ? me.role : null;
  const complete = confirmedRole ?? existingRole;
  const periodIsSaved = setupSaved || hasInitialPeriod(periodHistory);
  const deviceTimeZone = getDeviceTimeZone();

  const chooseRole = async (role: MobileRole) => {
    setFailed(false);
    setSaving(true);
    try {
      const savedRole = await saveOnboardingRole({
        role,
        currentRole: existingRole ?? me?.role,
        timeZone: deviceTimeZone,
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

  const saveCycleSetup = async () => {
    setFailed(false);
    setSaving(true);
    try {
      await saveInitialCycleSetup({
        startDate,
        startCertainty: certainty,
        cycleLength,
        periodLength,
        timeZone: deviceTimeZone,
        existingPeriods: [
          ...(periodHistory ?? []),
          ...(savedPeriodStart ? [{ startDate: savedPeriodStart }] : []),
        ],
        logPeriodStart: (args) => logPeriodStart(args),
        updateCycleSettings: (args) => updateCycleSettings(args),
        onPeriodSaved: setSavedPeriodStart,
      });
      setSetupSaved(true);
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
      <LinearGradient colors={palette.atmosphere} style={StyleSheet.absoluteFill} />
      <ScrollView
        contentContainerStyle={styles.screen}
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
          ) : complete === "partner" || (complete === "primary" && periodIsSaved) ? (
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
                    backgroundColor: palette.glass,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Text allowFontScaling style={[styles.buttonText, textStyle]}>
                  Continue
                </Text>
              </Pressable>
            </>
          ) : complete === "primary" ? (
            <>
              <Text allowFontScaling style={[styles.body, { color: palette.muted }]}>
                Let’s set up your cycle tracking.
              </Text>
              {failed ? (
                <Text allowFontScaling accessibilityRole="alert" style={[styles.error, textStyle]}>
                  {savedPeriodStart
                    ? "Your period date is saved. We couldn’t finish the cycle settings; check your connection and try again."
                    : "We couldn’t save your setup. Check your connection and try again."}
                </Text>
              ) : null}
              <DateField
                label="When did your last period start?"
                value={startDate}
                onChange={setStartDate}
                palette={palette}
                maximumDate={deviceTimeZone ? getDeviceDate(deviceTimeZone) : undefined}
                placeholder="Choose start date"
                disabled={saving || savedPeriodStart !== null}
              />
              <Text allowFontScaling style={[styles.body, textStyle]}>How certain are you about that date?</Text>
              <View style={styles.row}>
                {(["exact", "approximate"] as const).map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityLabel={`${value === "exact" ? "Exact" : "Approximate"} start date`}
                    accessibilityState={{ selected: certainty === value, disabled: saving || savedPeriodStart !== null }}
                    disabled={saving || savedPeriodStart !== null}
                    onPress={() => setCertainty(value)}
                    style={[styles.choice, { backgroundColor: palette.glass, borderColor: palette.border }]}
                  >
                    <Text allowFontScaling style={[styles.buttonText, textStyle]}>
                      {value === "exact" ? "Exact date" : "Approximate date"}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text allowFontScaling style={[styles.body, textStyle]}>Average cycle length: {cycleLength} days</Text>
              <View style={styles.row}>
                <LengthButton label="Decrease cycle length" value={cycleLength} minimum={MIN_CYCLE_LENGTH} disabled={saving || savedPeriodStart !== null} palette={palette} onChange={setCycleLength} delta={-1} />
                <LengthButton label="Increase cycle length" value={cycleLength} maximum={MAX_CYCLE_LENGTH} disabled={saving || savedPeriodStart !== null} palette={palette} onChange={setCycleLength} delta={1} />
              </View>
              <Text allowFontScaling style={[styles.body, textStyle]}>Average period length: {periodLength} days</Text>
              <View style={styles.row}>
                <LengthButton label="Decrease period length" value={periodLength} minimum={MIN_PERIOD_LENGTH} disabled={saving || savedPeriodStart !== null} palette={palette} onChange={setPeriodLength} delta={-1} />
                <LengthButton label="Increase period length" value={periodLength} maximum={MAX_PERIOD_LENGTH} disabled={saving || savedPeriodStart !== null} palette={palette} onChange={setPeriodLength} delta={1} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start tracking"
                accessibilityState={{ disabled: saving || !startDate }}
                disabled={saving || !startDate}
                onPress={() => void saveCycleSetup()}
                style={[styles.button, { backgroundColor: palette.glass, borderColor: palette.border }]}
              >
                <Text allowFontScaling style={[styles.buttonText, textStyle]}>
                  {saving ? "Saving…" : "Start Tracking"}
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
                      backgroundColor: palette.glass,
                      borderColor: palette.border,
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
  row: { flexDirection: "row", gap: 12 },
  choice: { minHeight: 52, flex: 1, justifyContent: "center", alignItems: "center", padding: 12, borderWidth: 1, borderRadius: 16 },
  title: { fontFamily: "serif", fontSize: 34, lineHeight: 42, flexShrink: 1 },
  body: { fontSize: 16, lineHeight: 24, flexShrink: 1 },
  button: {
    minHeight: 52,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 20,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    flexShrink: 1,
  },
  error: { fontSize: 15, lineHeight: 22 },
});

function LengthButton({
  label,
  value,
  minimum,
  maximum,
  delta,
  disabled,
  palette,
  onChange,
}: {
  label: string;
  value: number;
  minimum?: number;
  maximum?: number;
  delta: -1 | 1;
  disabled: boolean;
  palette: typeof mobileColors.light | typeof mobileColors.dark;
  onChange: (value: number) => void;
}): React.JSX.Element {
  const next = value + delta;
  const atLimit = (minimum !== undefined && next < minimum) || (maximum !== undefined && next > maximum);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || atLimit }}
      disabled={disabled || atLimit}
      onPress={() => onChange(next)}
      style={[styles.choice, { backgroundColor: palette.glass, borderColor: palette.border }]}
    >
      <Text allowFontScaling style={[styles.buttonText, { color: palette.foreground }]}>
        {delta < 0 ? "−" : "+"} 1 day
      </Text>
    </Pressable>
  );
}
