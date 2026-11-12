import React, { useContext, useEffect, useRef, useState } from "react";
import { Link } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { BlurTargetView, BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQuery } from "convex/react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../convex/api";
import { AccessContext } from "../../navigation/accessContext";
import { mobileColors } from "../../theme/tokens";
import { HomeNudges } from "../home/HomeNudges";
import { HomeSupport } from "../home/HomeSupport";
import {
  getCycleDashboardPresentation,
  nextCalendarDate,
  shouldEnsureCyclePredictionSnapshot,
  type CycleDashboardData,
  type CycleDashboardPresentation,
} from "./CycleDashboardModel";

export function CycleDashboard(): React.JSX.Element {
  const account = useQuery(api.queries.users.getMe, {});
  const [rollover, setRollover] = useState<{ userId: string; date: string } | null>(null);
  const todayDate = account && rollover?.userId === account._id ? rollover.date : undefined;
  const data = useQuery(
    api.queries.dashboard.getDashboardData,
    todayDate ? { todayDate } : {},
  );
  const capabilities = useQuery(api.queries.capabilities.getCapabilities, {});
  const ensurePredictionSnapshot = useMutation(
    api.mutations.predictionSnapshots.ensureForViewer,
  );
  const model = getCycleDashboardPresentation(data, capabilities);
  const palette =
    useColorScheme() === "dark" ? mobileColors.dark : mobileColors.light;

  useEffect(() => {
    if (
      rollover &&
      account?._id === rollover.userId &&
      data?.calendarDate === rollover.date
    ) {
      // The date argument forces one fresh subscription at rollover. Return to
      // server-derived date context so account timezone changes stay current.
      setRollover(null);
    }
  }, [account?._id, data?.calendarDate, rollover]);

  useEffect(() => {
    if (!account?._id || !data?.calendarDate || !data.nextCalendarDayAt) return;
    const advanceDateIfNeeded = () => {
      if (Date.now() < data.nextCalendarDayAt!) return;
      setRollover({ userId: account._id, date: nextCalendarDate(data.calendarDate!) });
    };
    const timeout = setTimeout(
      advanceDateIfNeeded,
      Math.max(0, data.nextCalendarDayAt - Date.now() + 25),
    );
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") advanceDateIfNeeded();
    });
    return () => {
      clearTimeout(timeout);
      subscription.remove();
    };
  }, [account?._id, data?.calendarDate, data?.nextCalendarDayAt]);

  useEffect(() => {
    if (shouldEnsureCyclePredictionSnapshot(data, capabilities)) {
      ensurePredictionSnapshot().catch(() => {});
    }
  }, [capabilities, data, ensurePredictionSnapshot]);

  if (!model) {
    return (
      <View
        style={[styles.loading, { backgroundColor: palette.background }]}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading cycle information"
        accessibilityLiveRegion="polite"
      >
        <ActivityIndicator color={palette.foreground} />
        <Text allowFontScaling style={{ color: palette.muted }}>
          Loading cycle information…
        </Text>
      </View>
    );
  }

  return <CycleDashboardView model={model} data={data!} palette={palette} />;
}

export function CycleDashboardView({
  model,
  data,
  palette,
}: {
  model: CycleDashboardPresentation;
  data: CycleDashboardData;
  palette: typeof mobileColors.light | typeof mobileColors.dark;
}): React.JSX.Element {
  const textStyle = { color: palette.foreground };
  const blurTarget = useRef<View>(null);
  const access = useContext(AccessContext);
  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.background }]}
    >
      <BlurTargetView ref={blurTarget} style={StyleSheet.absoluteFill}>
        <LinearGradient colors={palette.atmosphere} style={StyleSheet.absoluteFill} />
      </BlurTargetView>
      <ScrollView
        contentContainerStyle={styles.screen}
      >
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text
              allowFontScaling
              accessibilityRole="header"
              style={[styles.heading, textStyle]}
            >
              Welcome back
            </Text>
            <Link href="/(app)/notifications" asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open inbox"
                style={StyleSheet.flatten([styles.inboxBell, { backgroundColor: palette.glass, borderColor: palette.border }])}
              >
                <Ionicons name="notifications-outline" size={23} color={palette.foreground} />
              </Pressable>
            </Link>
          </View>
          <Text
            allowFontScaling
            style={[styles.subtitle, { color: palette.muted }]}
          >
            {model.role === "partner"
              ? "Support signals are shown only when your partner has shared them."
              : "Today’s rhythm, translated into support."}
          </Text>
          {model.message ? (
            <Text allowFontScaling style={{ color: palette.muted }}>
              {model.message}
            </Text>
          ) : null}
          {model.state ? (
            <CycleCardView card={model.state} palette={palette} blurTarget={blurTarget} />
          ) : null}
          {model.prediction ? (
            <CycleCardView card={model.prediction} palette={palette} blurTarget={blurTarget} />
          ) : null}
          <HomeNudges dark={palette === mobileColors.dark} />
          {access === "primary" || access === "partner" ? (
            <Link href="/(app)/partner" asChild>
              <Pressable accessibilityRole="button" accessibilityLabel="Open partner connection and sharing controls" style={StyleSheet.flatten([styles.secondaryAction, { borderColor: palette.border }])}>
                <Text allowFontScaling style={{ color: palette.foreground, fontWeight: "600" }}>Partner connection and sharing</Text>
              </Pressable>
            </Link>
          ) : null}
          <HomeSupport data={data} dark={palette === mobileColors.dark} />
          {(access === "primary" || access === "partner") ? (
            <Link href="/(app)/chat" asChild>
              <Pressable accessibilityRole="button" accessibilityLabel="Open private chat" style={StyleSheet.flatten([styles.secondaryAction, { borderColor: palette.border }])}>
                <Text allowFontScaling style={{ color: palette.foreground, fontWeight: "600" }}>Open private chat</Text>
              </Pressable>
            </Link>
          ) : access === "unlinked_primary" ? (
            <Link href="/(app)/partner" asChild>
              <Pressable accessibilityRole="button" accessibilityLabel="Invite a partner (optional)" style={StyleSheet.flatten([styles.secondaryAction, { borderColor: palette.border }])}>
                <Text allowFontScaling style={{ color: palette.foreground, fontWeight: "600" }}>Invite a partner (optional)</Text>
              </Pressable>
            </Link>
          ) : null}
          <Link href="/(app)/log" asChild>
            <Pressable accessibilityRole="button" style={StyleSheet.flatten([styles.quickAction, { backgroundColor: palette.accent }])}>
              <Text allowFontScaling style={[styles.quickActionText, { color: palette.surface }]}>Log and view history</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CycleCardView({
  card,
  palette,
  blurTarget,
}: {
  card: NonNullable<CycleDashboardPresentation["state"]>;
  palette: typeof mobileColors.light | typeof mobileColors.dark;
  blurTarget: React.RefObject<View | null>;
}) {
  return (
    <BlurView
      blurTarget={blurTarget}
      blurMethod="dimezisBlurViewSdk31Plus"
      tint={palette === mobileColors.dark ? "dark" : "light"}
      intensity={35}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={[
        card.status,
        card.title,
        ...card.details,
        card.disclaimer,
      ]
        .filter(Boolean)
        .join(". ")}
      style={[
        styles.card,
        { backgroundColor: palette.glass, borderColor: palette.border },
      ]}
    >
      <Text
        allowFontScaling
        accessibilityRole="header"
        style={[styles.status, { color: palette.foreground }]}
      >
        {card.status}
      </Text>
      <Text
        allowFontScaling
        style={[styles.cardTitle, { color: palette.foreground }]}
      >
        {card.title}
      </Text>
      {card.details.map((detail) => (
        <Text
          key={detail}
          allowFontScaling
          style={[styles.detail, { color: palette.muted }]}
        >
          {detail}
        </Text>
      ))}
      {card.disclaimer ? (
        <Text
          allowFontScaling
          style={[styles.disclaimer, { color: palette.foreground }]}
        >
          {card.disclaimer}
        </Text>
      ) : null}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 20,
  },
  screen: { flexGrow: 1, padding: 24, paddingBottom: 32 },
  content: { width: "100%", maxWidth: 560, alignSelf: "center", gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  inboxBell: { minHeight: 48, minWidth: 48, alignItems: "center", justifyContent: "center", borderRadius: 16, borderWidth: 1 },
  secondaryAction: { minHeight: 48, borderWidth: 1, borderRadius: 16, justifyContent: "center", alignItems: "center", paddingHorizontal: 16 },
  heading: { fontFamily: "serif", fontSize: 34, lineHeight: 42, flexShrink: 1 },
  subtitle: { fontSize: 16, lineHeight: 24, flexShrink: 1 },
  card: {
    width: "100%",
    padding: 22,
    borderWidth: 1,
    borderRadius: 24,
    overflow: "hidden",
    gap: 8,
  },
  status: {
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    flexShrink: 1,
  },
  cardTitle: { fontSize: 20, lineHeight: 28, fontWeight: "600", flexShrink: 1 },
  detail: { fontSize: 16, lineHeight: 24, flexShrink: 1 },
  disclaimer: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
    flexShrink: 1,
  },
  quickAction: { minHeight: 52, borderRadius: 16, justifyContent: "center", alignItems: "center", paddingHorizontal: 16 },
  quickActionText: { fontSize: 16, fontWeight: "700", textAlign: "center" },
});
