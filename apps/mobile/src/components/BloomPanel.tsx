import React from "react";
import { StyleSheet, Text, View, type ViewProps } from "react-native";
import type { MobilePalette } from "../theme/tokens";
import { bloomType } from "../theme/typography";

export function BloomPanel({ palette, children, style, variant = "quiet", ...props }: ViewProps & {
  palette: MobilePalette;
  variant?: "quiet" | "warm" | "sage";
}): React.JSX.Element {
  return <View {...props} style={[
    styles.panel,
    { backgroundColor: variant === "sage" ? palette.sageSurface : variant === "warm" ? palette.highlight : palette.surface, borderColor: palette.outline },
    style,
  ]}>
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.rim, { borderColor: palette.rim }]} />
    {children}
  </View>;
}

export function BloomNotice({ palette, children, tone = "quiet", alert = false }: {
  palette: MobilePalette;
  children: React.ReactNode;
  tone?: "quiet" | "sage";
  alert?: boolean;
}): React.JSX.Element {
  return <View style={[styles.notice, { backgroundColor: tone === "sage" ? palette.sageSurface : palette.highlight }]}>
    <Text allowFontScaling accessibilityRole={alert ? "alert" : "text"} accessibilityLiveRegion={alert ? "assertive" : "polite"} style={[bloomType.caption, { color: tone === "sage" ? palette.sage : palette.foreground }]}>{children}</Text>
  </View>;
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 28, padding: 20, gap: 14, position: "relative" },
  rim: { position: "absolute", top: 1, left: 1, right: 1, bottom: 1, borderWidth: 1, borderRadius: 26 },
  notice: { padding: 14, borderRadius: 18, marginVertical: 4 },
});
