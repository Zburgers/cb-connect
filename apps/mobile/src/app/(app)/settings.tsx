import { useContext } from "react";
import { View, Text, useColorScheme } from "react-native";
import { Settings } from "../../features/settings/Settings";
import { mobileColors } from "../../theme/tokens";
import { AccessContext } from "../../navigation/accessContext";

export default function SettingsScreen() {
  const access = useContext(AccessContext);
  return access === "primary" || access === "partner" ? <Settings /> : <AccessUnavailable />;
}

function AccessUnavailable() {
  const palette = useColorScheme() === "dark" ? mobileColors.dark : mobileColors.light;
  return <View accessibilityRole="alert" style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: palette.background }}>
    <Text allowFontScaling style={{ color: palette.foreground }}>Your account cannot access settings right now.</Text>
  </View>;
}

export function ErrorBoundary() {
  const palette = useColorScheme() === "dark" ? mobileColors.dark : mobileColors.light;
  return (
    <View accessibilityRole="alert" style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: palette.background }}>
      <Text allowFontScaling accessibilityRole="header" style={{ color: palette.foreground, fontSize: 20, fontWeight: "600" }}>Settings unavailable</Text>
      <Text allowFontScaling style={{ color: palette.muted, marginTop: 8 }}>Settings are unavailable right now.</Text>
    </View>
  );
}
