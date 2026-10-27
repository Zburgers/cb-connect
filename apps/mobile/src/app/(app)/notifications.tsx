import { useContext } from "react";
import { View, Text, useColorScheme } from "react-native";
import { Inbox } from "../../features/notifications/Inbox";
import { mobileColors } from "../../theme/tokens";
import { AccessContext } from "../../navigation/accessContext";

export default function NotificationsScreen() {
  const access = useContext(AccessContext);
  return access === "primary" || access === "partner" ? <Inbox /> : <AccessUnavailable />;
}

function AccessUnavailable() {
  const palette = useColorScheme() === "dark" ? mobileColors.dark : mobileColors.light;
  return <View accessibilityRole="alert" style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: palette.background }}>
    <Text allowFontScaling style={{ color: palette.foreground }}>Your account cannot access the inbox right now.</Text>
  </View>;
}

export function ErrorBoundary() {
  const palette = useColorScheme() === "dark" ? mobileColors.dark : mobileColors.light;
  return (
    <View accessibilityRole="alert" style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: palette.background }}>
      <Text allowFontScaling accessibilityRole="header" style={{ color: palette.foreground, fontSize: 20, fontWeight: "600" }}>Inbox unavailable</Text>
      <Text allowFontScaling style={{ color: palette.muted, marginTop: 8 }}>In-app notifications are unavailable right now.</Text>
    </View>
  );
}
