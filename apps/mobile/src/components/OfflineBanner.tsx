import React from "react";
import { StyleSheet, useColorScheme, View } from "react-native";
import { mobileColors } from "../theme/tokens";
import { BloomText as Text } from "./BloomText";
import { bloomType } from "../theme/typography";

export function OfflineBanner({ isOffline }: { isOffline: boolean }): React.JSX.Element | null {
  const palette = useColorScheme() === "dark" ? mobileColors.dark : mobileColors.light;
  if (!isOffline) return null;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel="Offline. Protected features are hidden until your connection returns."
      accessibilityLiveRegion="polite"
      style={[styles.container, { backgroundColor: palette.noticeBackground }]}
    >
      <Text allowFontScaling style={[styles.text, { color: palette.noticeForeground }]}>
        Offline. Protected features are hidden until your connection returns.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    padding: 12,
  },
  text: {
    fontSize: 14,
  },
});
