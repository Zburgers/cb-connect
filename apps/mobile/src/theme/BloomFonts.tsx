import React from "react";
import { useFonts } from "expo-font";
import { ActivityIndicator, StyleSheet, Text, View, useColorScheme } from "react-native";
import { mobileColors } from "./tokens";

export function BloomFonts({ children }: React.PropsWithChildren): React.JSX.Element {
  const [loaded, error] = useFonts({
    DMSerifDisplay: require("../../assets/fonts/DMSerifDisplay-Regular.ttf"),
    DMSans: require("../../assets/fonts/DMSans-Regular.ttf"),
    DMSansMedium: require("../../assets/fonts/DMSans-Medium.ttf"),
    DMSansSemiBold: require("../../assets/fonts/DMSans-SemiBold.ttf"),
  });
  const palette = useColorScheme() === "dark" ? mobileColors.dark : mobileColors.light;
  if (!loaded && !error) return <View style={[styles.loading, { backgroundColor: palette.background }]}>
    <ActivityIndicator color={palette.accent} accessibilityLabel="Loading CB Connect" />
    <Text allowFontScaling style={{ color: palette.foreground, fontSize: 18 }}>CB Connect</Text>
  </View>;
  // Native Text falls back to the platform face if a bundled font cannot load.
  return <>{children}</>;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 } });
