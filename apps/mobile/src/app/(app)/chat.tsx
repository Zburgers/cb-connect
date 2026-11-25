import { useContext } from "react";
import { useQuery } from "convex/react";
import { KeyboardAvoidingView, StyleSheet, Text, useColorScheme, View } from "react-native";
import { AccessContext } from "../../navigation/accessContext";
import { api } from "../../convex/api";
import { CoupleChat } from "../../features/chat/CoupleChat";
import { mobileColors } from "../../theme/tokens";

export default function ChatRoute(): React.JSX.Element {
  const access = useContext(AccessContext);
  const activeRole = access === "primary" || access === "partner";
  const guard = useQuery(api.queries.mobileAccess.getGuardState, activeRole ? {} : "skip");
  const couple = useQuery(api.queries.couples.getCoupleStatus, activeRole ? {} : "skip");
  const dark = useColorScheme() === "dark";
  const palette = dark ? mobileColors.dark : mobileColors.light;

  if (!activeRole || !guard || !couple) {
    return <View style={styles.unavailable}><Text style={{ color: palette.foreground }}>Checking private chat access…</Text></View>;
  }

  const canChat = guard?.user?.role === access &&
    guard?.couple?.isLinked === true &&
    guard?.couple?.role === access &&
    couple.isLinked === true &&
    couple.status === "active" &&
    couple.role === access &&
    typeof couple.relationshipGeneration === "string" &&
    couple.relationshipGeneration.length > 0;

  if (!canChat || !couple.relationshipGeneration) {
    return <View accessibilityRole="alert" style={styles.unavailable}>
      <Text style={{ color: palette.foreground }}>Private chat is available only while you are connected to a partner.</Text>
    </View>;
  }

  return (
    <KeyboardAvoidingView behavior="height" style={styles.container}>
      <View style={[styles.header, { borderColor: palette.border, backgroundColor: palette.glass }]}>
        <Text accessibilityRole="header" style={[styles.heading, { color: palette.foreground }]}>
          {couple.partner?.displayName ?? "Your partner"}
        </Text>
        <Text style={{ color: palette.muted }}>Connected · Private couple chat</Text>
      </View>
      <CoupleChat
        key={couple.relationshipGeneration}
        relationshipGeneration={couple.relationshipGeneration}
        dark={dark}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  unavailable: { flex: 1, justifyContent: "center", padding: 24 },
  header: { paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 },
  heading: { fontSize: 20, fontWeight: "700" },
});
