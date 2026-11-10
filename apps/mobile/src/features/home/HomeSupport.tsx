import { useState } from "react";
import { useMutation } from "convex/react";
import type { GenericId } from "convex/values";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../../convex/api";
import type { CycleDashboardData } from "../cycle/CycleDashboardModel";
import { getHomeSupportPresentation } from "./HomeModel";
import { HomePainCheckIn } from "./HomePainCheckIn";
import { mobileColors } from "../../theme/tokens";

export function HomeSupport({
  data,
  dark,
}: {
  data: CycleDashboardData;
  dark: boolean;
}): React.JSX.Element {
  const palette = dark ? mobileColors.dark : mobileColors.light;
  const support = getHomeSupportPresentation(data);
  const hideTip = useMutation(api.mutations.misc.hideNutritionTip);
  const [hidingId, setHidingId] = useState<string | null>(null);
  const [hideError, setHideError] = useState(false);

  if (support.role === "partner") {
    return (
      <View style={styles.stack}>
        <View
          accessibilityLabel={support.pain ? "Shared pain signal" : "Pain signal is private"}
          style={[
            styles.card,
            { backgroundColor: palette.glass, borderColor: palette.border },
          ]}
        >
          <Text accessibilityRole="header" style={[styles.heading, { color: palette.foreground }]}>
            {support.pain ? "How today feels" : "Pain signal is private"}
          </Text>
          {support.pain ? (
            <Text style={[styles.body, { color: palette.foreground }]}>
              Shared pain signal · {support.pain.score}/10 · {support.pain.severity}
            </Text>
          ) : (
            <Text style={[styles.body, { color: palette.muted }]}>
              No pain data is shared today. That may mean nothing was logged, or that your partner chose not to share it.
            </Text>
          )}
        </View>
        {support.painTip ? (
          <View style={[styles.card, { backgroundColor: palette.glass, borderColor: palette.border }]}>
            <Text accessibilityRole="header" style={[styles.heading, { color: palette.foreground }]}>
              How to help without making it weird
            </Text>
            {support.painTip.suggestions.map((suggestion, index) => (
              <View key={`${index}-${suggestion}`} style={styles.suggestion}>
                <Text style={[styles.number, { color: palette.accent }]}>{index + 1}</Text>
                <Text style={[styles.body, { color: palette.foreground }]}>{suggestion}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  }

  if (!data.hasData) return <></>;

  return (
    <View style={styles.stack}>
      <HomePainCheckIn currentPain={support.pain} dark={dark} />

      {support.painTip ? (
        <View style={[styles.card, { backgroundColor: palette.glass, borderColor: palette.border }]}>
          <Text style={[styles.eyebrow, { color: palette.muted }]}>Support for today</Text>
          <Text accessibilityRole="header" style={[styles.heading, { color: palette.foreground }]}>
            {support.painTip.title}
          </Text>
          {support.painTip.suggestions.map((suggestion, index) => (
            <View key={`${index}-${suggestion}`} style={styles.suggestion}>
              <Text style={[styles.number, { color: palette.accent }]}>{index + 1}</Text>
              <Text style={[styles.body, { color: palette.foreground }]}>{suggestion}</Text>
            </View>
          ))}
          <Text style={[styles.note, { color: palette.muted }]}>
            {support.painTip.safetyNote}
          </Text>
        </View>
      ) : null}

      {support.nutritionTipsPhase && support.nutritionTips.length > 0 ? (
        <View style={[styles.card, { backgroundColor: palette.glass, borderColor: palette.border }]}>
          <Text style={[styles.eyebrow, { color: palette.muted }]}>Cycle-informed support</Text>
          <Text accessibilityRole="header" style={[styles.heading, { color: palette.foreground }]}>
            Gentle nourishment ideas
          </Text>
          {support.nutritionTipsPhase === "ovulation" ? (
            <Text style={[styles.note, { color: palette.muted }]}>
              Calendar timing is an estimate and does not confirm ovulation.
            </Text>
          ) : null}
          {support.nutritionTips.map((tip) => (
            <View key={tip._id} style={[styles.tip, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <View style={styles.tipText}>
                <Text style={[styles.tipTitle, { color: palette.foreground }]}>{tip.foodItem}</Text>
                <Text style={[styles.body, { color: palette.muted }]}>{tip.reasoning}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Dismiss ${tip.foodItem}`}
                accessibilityHint="Hide this suggestion for 30 days"
                accessibilityState={{ disabled: hidingId !== null }}
                disabled={hidingId !== null}
                onPress={() => {
                  setHidingId(tip._id);
                  setHideError(false);
                  void hideTip({ nutritionTipId: tip._id as GenericId<"nutritionTips"> })
                    .catch(() => setHideError(true))
                    .finally(() => setHidingId(null));
                }}
                style={styles.dismissTip}
              >
                <Text style={{ color: palette.muted }}>{hidingId === tip._id ? "…" : "×"}</Text>
              </Pressable>
            </View>
          ))}
          {hideError ? (
            <Text accessibilityRole="alert" style={{ color: palette.foreground }}>
              This suggestion was not dismissed. Try again.
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  card: { borderWidth: 1, borderRadius: 24, padding: 20, gap: 12 },
  eyebrow: { fontSize: 12, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase" },
  heading: { fontSize: 20, lineHeight: 28, fontWeight: "700" },
  body: { fontSize: 14, lineHeight: 21 },
  suggestion: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  number: { fontWeight: "800" },
  note: { borderRadius: 16, padding: 12, fontSize: 13, lineHeight: 20, backgroundColor: "rgba(127, 127, 127, 0.12)" },
  tip: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", gap: 8 },
  tipText: { flex: 1, gap: 4 },
  tipTitle: { fontSize: 17, fontWeight: "700" },
  dismissTip: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
});
