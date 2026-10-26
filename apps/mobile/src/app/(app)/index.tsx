import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { CycleDashboard } from "../../features/cycle/CycleDashboard";
import { mobileColors } from "../../theme/tokens";

const links = [
  ["/(app)/log", "Log and history"],
  ["/(app)/partner", "Partner and chat"],
  ["/(app)/notifications", "Inbox"],
  ["/(app)/settings", "Settings"],
] as const;

export default function MobileDashboard(): React.JSX.Element {
  const palette = useColorScheme() === "dark" ? mobileColors.dark : mobileColors.light;
  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <CycleDashboard />
      <View style={styles.navigation}>
        {links.map(([href, label]) => (
          <Link key={href} href={href} asChild>
            <Pressable accessibilityRole="link" accessibilityLabel={label} style={[styles.link, { borderColor: palette.muted }]}>
              <Text allowFontScaling style={{ color: palette.foreground }}>{label}</Text>
            </Pressable>
          </Link>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  navigation: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 12 },
  link: { minHeight: 48, justifyContent: "center", paddingHorizontal: 12, borderWidth: 1, borderRadius: 10 },
});
