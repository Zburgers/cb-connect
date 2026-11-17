import React, { useContext, useEffect, useState } from "react";
import { Link } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery } from "convex/react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import { BloomPhaseArtwork, presentedArtworkPhase } from "../../components/BloomPhaseArtwork";
import { BloomScreen } from "../../components/BloomScreen";
import { BloomPanel, BloomNotice } from "../../components/BloomPanel";
import { BloomText as Text } from "../../components/BloomText";
import { bloomType } from "../../theme/typography";
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

export function CycleDashboardView({ model, data, palette }: {
  model: CycleDashboardPresentation;
  data: CycleDashboardData;
  palette: typeof mobileColors.light | typeof mobileColors.dark;
}): React.JSX.Element {
  const access = useContext(AccessContext);
  const linked = access === "primary" || access === "partner";
  return <BloomScreen palette={palette} eyebrow="CB Connect" title="Welcome back" subtitle={model.role === "partner" ? "Support signals are shown only when your partner has shared them." : "Today’s rhythm, translated into support."} headerAction={
    <Link href="/(app)/notifications" asChild>
      <Pressable accessibilityRole="button" accessibilityLabel="Open inbox" style={StyleSheet.flatten([styles.inboxBell, { backgroundColor: palette.surface, borderColor: palette.outline }])}>
        <Ionicons name="notifications-outline" size={23} color={palette.foreground} />
      </Pressable>
    </Link>
  }>
    {model.message ? <BloomNotice palette={palette}>{model.message}</BloomNotice> : null}
    {model.state ? <CycleCardView card={model.state} palette={palette} hero /> : null}
    {model.prediction ? <CycleCardView card={model.prediction} palette={palette} /> : null}
    {model.role !== "partner" ? <BloomNotice palette={palette} tone="sage">{access === "unlinked_primary" ? "You can track privately without linking a partner." : "Choose what your partner can see in sharing controls."}</BloomNotice> : null}
    <Link href="/(app)/log" asChild>
      <Pressable accessibilityRole="button" style={({ pressed }) => StyleSheet.flatten([styles.quickAction, { backgroundColor: palette.accent, opacity: pressed ? 0.8 : 1 }])}>
        <Text style={[bloomType.button, { color: palette.onAccent }]}>Log and view history</Text>
      </Pressable>
    </Link>
    <HomeSupport data={data} dark={palette === mobileColors.dark} />
    <HomeNudges dark={palette === mobileColors.dark} />
    {linked || access === "unlinked_primary" ? <Link href="/(app)/partner" asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={linked ? "Open partner connection and sharing controls" : "Invite a partner (optional)"} style={StyleSheet.flatten([styles.secondaryAction, { backgroundColor: palette.surface, borderColor: palette.outline }])}>
        <Text style={[bloomType.button, { color: palette.foreground }]}>{linked ? "Partner connection and sharing" : "Invite a partner (optional)"}</Text>
      </Pressable>
    </Link> : null}
    {linked ? <Link href="/(app)/chat" asChild>
      <Pressable accessibilityRole="button" accessibilityLabel="Open private chat" style={StyleSheet.flatten([styles.secondaryAction, { backgroundColor: palette.surface, borderColor: palette.outline }])}>
        <Text style={[bloomType.button, { color: palette.foreground }]}>Open private chat</Text>
      </Pressable>
    </Link> : null}
  </BloomScreen>;
}

export function CycleCardView({ card, palette, hero = false }: {
  card: NonNullable<CycleDashboardPresentation["state"]>;
  palette: typeof mobileColors.light | typeof mobileColors.dark;
  hero?: boolean;
}): React.JSX.Element {
  // Match only a phase already rendered by the authorized presentation model.
  // Paused, withheld, uncertain and unknown states never get a guessed phase.
  const artworkPhase = hero ? presentedArtworkPhase(card.title) : null;
  return <BloomPanel palette={palette} variant={hero ? "warm" : "quiet"} accessible accessibilityRole="summary" accessibilityLabel={[card.status, card.title, ...card.details, card.disclaimer].filter(Boolean).join(". ")}>
    <Text style={[bloomType.label, { color: palette.accent }]}>{card.status}</Text>
    <Text accessibilityRole="header" style={[hero ? bloomType.heading : bloomType.section, { color: palette.foreground }]}>{card.title}</Text>
    {artworkPhase ? <BloomPhaseArtwork phase={artworkPhase} /> : null}
    {card.details.map((detail) => <Text key={detail} style={[bloomType.body, { color: palette.muted }]}>{detail}</Text>)}
    {card.disclaimer ? <Text style={[bloomType.caption, styles.disclaimer, { color: palette.foreground }]}>{card.disclaimer}</Text> : null}
  </BloomPanel>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16, padding: 24 },
  inboxBell: { minHeight: 48, minWidth: 48, alignItems: "center", justifyContent: "center", borderRadius: 24, borderWidth: 1 },
  secondaryAction: { minHeight: 52, borderWidth: 1, borderRadius: 20, justifyContent: "center", alignItems: "center", padding: 14 },
  disclaimer: { paddingTop: 10 },
  quickAction: { minHeight: 54, borderRadius: 20, justifyContent: "center", alignItems: "center", padding: 14 },
});
