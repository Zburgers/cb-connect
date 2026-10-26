import React from "react";
import { useQuery } from "convex/react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../../../convex/_generated/api";
import { mobileColors } from "../../theme/tokens";
import {
  getCycleDashboardPresentation,
  type CycleDashboardPresentation,
} from "./CycleDashboardModel";

export function CycleDashboard(): React.JSX.Element {
  const data = useQuery(api.queries.dashboard.getDashboardData, {});
  const capabilities = useQuery(api.queries.capabilities.getCapabilities, {});
  const model = getCycleDashboardPresentation(data, capabilities);
  const palette =
    useColorScheme() === "dark" ? mobileColors.dark : mobileColors.light;

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

  return <CycleDashboardView model={model} palette={palette} />;
}

export function CycleDashboardView({
  model,
  palette,
}: {
  model: CycleDashboardPresentation;
  palette: typeof mobileColors.light | typeof mobileColors.dark;
}): React.JSX.Element {
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
      >
        <View style={styles.content}>
          <Text
            allowFontScaling
            accessibilityRole="header"
            style={[styles.heading, textStyle]}
          >
            Cycle overview
          </Text>
          <Text
            allowFontScaling
            style={[styles.subtitle, { color: palette.muted }]}
          >
            {model.role === "partner"
              ? "Shared cycle information"
              : "Your cycle information"}
          </Text>
          {model.message ? (
            <Text allowFontScaling style={{ color: palette.muted }}>
              {model.message}
            </Text>
          ) : null}
          {model.state ? (
            <CycleCardView card={model.state} palette={palette} />
          ) : null}
          {model.prediction ? (
            <CycleCardView card={model.prediction} palette={palette} />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CycleCardView({
  card,
  palette,
}: {
  card: NonNullable<CycleDashboardPresentation["state"]>;
  palette: typeof mobileColors.light | typeof mobileColors.dark;
}) {
  return (
    <View
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
        { backgroundColor: palette.background, borderColor: palette.muted },
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
    </View>
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
  screen: { flexGrow: 1, padding: 20 },
  content: { width: "100%", maxWidth: 560, alignSelf: "center", gap: 16 },
  heading: { fontSize: 28, lineHeight: 36, fontWeight: "700", flexShrink: 1 },
  subtitle: { fontSize: 16, lineHeight: 24, flexShrink: 1 },
  card: {
    width: "100%",
    padding: 16,
    borderWidth: 1,
    borderRadius: 14,
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
});
