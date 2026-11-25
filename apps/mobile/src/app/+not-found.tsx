import { StyleSheet, Text, useColorScheme, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { mobileColors } from "../theme/tokens";

export default function NotFound() {
  const palette = useColorScheme() === "dark" ? mobileColors.dark : mobileColors.light;
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
      <View style={styles.content} accessibilityRole="alert">
        <Text allowFontScaling accessibilityRole="header" style={[styles.title, { color: palette.foreground }]}>
          Link unavailable
        </Text>
        <Text allowFontScaling style={[styles.message, { color: palette.muted }]}>
          This link can’t be opened. Return to the app and try again.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24 },
  content: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  message: { fontSize: 16, textAlign: "center" },
});
