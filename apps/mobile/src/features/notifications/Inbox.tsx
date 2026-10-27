import { useState } from "react";
import { useRouter } from "expo-router";
import { usePaginatedQuery, useMutation, useQuery } from "convex/react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from "react-native";
import { api } from "../../convex/api";
import type { NotificationInboxItemDTO } from "@cb-connect/contracts";
import { mobileColors } from "../../theme/tokens";
import { getInboxPresentation, isInboxItemUnread } from "./presentation";

export function Inbox() {
  const router = useRouter();
  const palette = useColorScheme() === "dark" ? mobileColors.dark : mobileColors.light;
  const [actionFailed, setActionFailed] = useState(false);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const available = useQuery(api.queries.notifications.getMyInboxAvailability, {});
  const items = usePaginatedQuery(
    api.queries.notifications.getMyInbox,
    available === true ? {} : "skip",
    { initialNumItems: 20 },
  );
  const markRead = useMutation(api.mutations.notifications.markMyInboxItemRead);
  const dismiss = useMutation(api.mutations.notifications.dismissMyInboxItem);
  const visibleItems = available === true
    ? items.results.filter((item) => getInboxPresentation(item as NotificationInboxItemDTO))
    : [];

  const runAction = async (itemId: string, action: () => Promise<unknown>) => {
    setActionFailed(false);
    setBusyItem(itemId);
    try {
      await action();
    } catch {
      setActionFailed(true);
    } finally {
      setBusyItem(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} style={{ backgroundColor: "transparent" }}>
      <Text allowFontScaling accessibilityRole="header" style={[styles.title, { color: palette.foreground }]}>Inbox</Text>
      <Text allowFontScaling style={[styles.description, { color: palette.muted }]}>
        Private in-app updates appear here. Push delivery is not available in this build.
      </Text>
      {available === undefined || (available && items.status === "LoadingFirstPage") ? (
        <ActivityIndicator accessibilityLabel="Loading notifications" />
      ) : null}
      {available === false ? (
        <Text allowFontScaling accessibilityRole="alert" style={[styles.description, { color: palette.muted }]}>
          In-app inbox access is unavailable for this account right now. This does not reflect device notification permission or push channel availability.
        </Text>
      ) : null}
      {actionFailed ? <Text accessibilityRole="alert" style={{ color: palette.foreground }}>Unable to update this notification. Try again.</Text> : null}
      {available === true && items.status !== "LoadingFirstPage" && visibleItems.length === 0 ? (
        <Text allowFontScaling style={[styles.empty, { color: palette.foreground, backgroundColor: palette.glass, borderColor: palette.border }]}>You’re all caught up.</Text>
      ) : null}
      {visibleItems.map((item) => {
        const presentation = getInboxPresentation(item as NotificationInboxItemDTO);
        if (!presentation) return null;
        const unread = isInboxItemUnread(item as NotificationInboxItemDTO);
        return (
          <View key={item.itemId} style={[styles.card, { borderColor: palette.border, backgroundColor: palette.glass }]}>
            <View style={[styles.unreadDot, { backgroundColor: unread ? palette.accent : palette.border }]} />
            <Text allowFontScaling accessibilityRole="header" style={[styles.itemTitle, { color: palette.foreground }]}>{presentation.title}</Text>
            <Text allowFontScaling style={[styles.description, { color: palette.muted }]}>{presentation.body}</Text>
            <Text allowFontScaling accessibilityLabel={`Notification section: ${presentation.route}`} style={{ color: palette.muted }}>
              Section: {presentation.route === "settings" ? "Settings" : "Partner"}
            </Text>
            <Text allowFontScaling accessibilityLabel={unread ? "Unread notification" : "Read notification"} style={{ color: palette.muted }}>
              {unread ? "Unread" : "Read"}
            </Text>
            <View style={styles.actions}>
              {presentation.route === "settings" ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Open settings for ${presentation.title}`} onPress={() => router.push("/(app)/settings")} style={styles.action}>
                  <Text allowFontScaling style={{ color: palette.foreground }}>Open settings</Text>
                </Pressable>
              ) : (
                <Pressable accessibilityRole="button" accessibilityLabel={`Open partner space for ${presentation.title}`} onPress={() => router.push("/(app)/partner")} style={[styles.action, { borderColor: palette.border }]}>
                  <Text allowFontScaling style={{ color: palette.foreground }}>Open partner</Text>
                </Pressable>
              )}
              {unread ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Mark ${presentation.title} as read`} disabled={busyItem !== null} onPress={() => void runAction(item.itemId, () => markRead({ itemId: item.itemId }))} style={[styles.action, { borderColor: palette.border }]}>
                  <Text allowFontScaling style={{ color: palette.foreground }}>{busyItem === item.itemId ? "Saving…" : "Mark as read"}</Text>
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" accessibilityLabel={`Dismiss ${presentation.title}`} disabled={busyItem !== null} onPress={() => void runAction(item.itemId, () => dismiss({ itemId: item.itemId }))} style={[styles.action, { borderColor: palette.border }]}>
                <Text allowFontScaling style={{ color: palette.foreground }}>Dismiss</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
      {available === true && items.status === "CanLoadMore" ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Load more notifications" onPress={() => items.loadMore(20)} style={[styles.action, { borderColor: palette.border }]}>
          <Text allowFontScaling style={{ color: palette.foreground }}>Load more</Text>
        </Pressable>
      ) : null}
      {available === true && items.status === "LoadingMore" ? <ActivityIndicator accessibilityLabel="Loading more notifications" /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 36, gap: 16 },
  title: { fontSize: 30, fontWeight: "600", letterSpacing: -0.5 },
  itemTitle: { fontSize: 18, fontWeight: "600" },
  description: { fontSize: 15, lineHeight: 22 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 16, gap: 10 },
  unreadDot: { width: 9, height: 9, borderRadius: 5 },
  empty: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 18, fontSize: 14 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: { minHeight: 44, justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 14 },
});
