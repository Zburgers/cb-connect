import { useContext } from "react";
import { AccessContext } from "../../navigation/accessContext";
import { SanctuaryShell } from "../../components/SanctuaryShell";
import { Link } from "expo-router";
import { Pressable, Text, useColorScheme, View } from "react-native";
import { mobileColors } from "../../theme/tokens";

export default function SanctuaryHome() {
  const state = useContext(AccessContext);
  if (state !== "primary" && state !== "partner") return <SanctuaryShell state={state} />;
  const palette = useColorScheme() === "dark" ? mobileColors.dark : mobileColors.light;
  return <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 16, backgroundColor: palette.background }}>
    <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: "700", color: palette.foreground }}>CB Connect</Text>
    <Link href="/(app)/log" asChild><Pressable accessibilityRole="button" style={{ minHeight: 48, justifyContent: "center" }}><Text style={{ color: palette.foreground }}>Open logging and history</Text></Pressable></Link>
  </View>;
}
