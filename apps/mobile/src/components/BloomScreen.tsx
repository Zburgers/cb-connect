import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ScrollViewProps } from "react-native";
import type { MobilePalette } from "../theme/tokens";
import { bloomType } from "../theme/typography";
import { getBloomScrollBottomPadding } from "./bloomDockModel";

export function BloomScreen({ palette, children, title, subtitle, eyebrow, headerAction, contentContainerStyle, style, ...props }: ScrollViewProps & {
  palette: MobilePalette;
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  headerAction?: React.ReactNode;
}): React.JSX.Element {
  const { fontScale, width } = useWindowDimensions();
  return <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView {...props} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets style={[styles.fill, style]} contentContainerStyle={[styles.screen, { paddingBottom: getBloomScrollBottomPadding(fontScale, width) }, contentContainerStyle]}>
      <View style={styles.content}>
        {eyebrow ? <Text allowFontScaling style={[bloomType.label, { color: palette.accent }]}>{eyebrow}</Text> : null}
        {title ? <View style={styles.header}><Text allowFontScaling accessibilityRole="header" style={[bloomType.display, styles.title, { color: palette.foreground }]}>{title}</Text>{headerAction}</View> : null}
        {subtitle ? <Text allowFontScaling style={[bloomType.body, { color: palette.muted }]}>{subtitle}</Text> : null}
        {children}
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  screen: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 22 },
  content: { width: "100%", maxWidth: 560, alignSelf: "center", gap: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { flex: 1, flexShrink: 1 },
});
