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

  const runAction = async (action: () => Promise<unknown>) => {
    setActionFailed(false);
    try {
      await action();
    } catch {
      setActionFailed(true);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} style={{ backgroundColor: palette.background }}>
      <Text allowFontScaling accessibilityRole="header" style={[styles.title, { color: palette.foreground }]}>Inbox</Text>
      <Text allowFontScaling style={[styles.description, { color: palette.muted }]}>
        These are private, in-app notifications. Push delivery is not available here.
      </Text>
      {available === undefined || (available && items.status === "LoadingFirstPage") ? (
        <ActivityIndicator accessibilityLabel="Loading notifications" />
      ) : null}
      {available === false ? (
        <Text allowFontScaling accessibilityRole="alert" style={[styles.description, { color: palette.muted }]}>
          The in-app inbox is unavailable right now. Push is not available until Gate 6, and device permission and channel availability are separate.
        </Text>
      ) : null}
      {actionFailed ? <Text accessibilityRole="alert" style={{ color: palette.foreground }}>Unable to update this notification. Try again.</Text> : null}
      {available === true && items.status !== "LoadingFirstPage" && visibleItems.length === 0 ? (
        <Text allowFontScaling style={[styles.description, { color: palette.muted }]}>No current notifications.</Text>
      ) : null}
      {visibleItems.map((item) => {
        const presentation = getInboxPresentation(item as NotificationInboxItemDTO);
        if (!presentation) return null;
        const unread = isInboxItemUnread(item as NotificationInboxItemDTO);
        return (
          <View key={item.itemId} style={[styles.card, { borderColor: palette.muted }]}>
            <Text allowFontScaling accessibilityRole="header" style={[styles.itemTitle, { color: palette.foreground }]}>{presentation.title}</Text>
            <Text allowFontScaling style={[styles.description, { color: palette.muted }]}>{presentation.body}</Text>
            <Text allowFontScaling accessibilityLabel={`Notification section: ${presentation.route}`} style={{ color: palette.muted }}>
              Section: {presentation.route === "settings" ? "Settings" : "Messages unavailable"}
            </Text>
            <Text allowFontScaling accessibilityLabel={unread ? "Unread notification" : "Read notification"} style={{ color: palette.muted }}>
              {unread ? "Unread" : "Read"}
            </Text>
            <View style={styles.actions}>
              {presentation.route === "settings" ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Open settings for ${presentation.title}`} onPress={() => router.push("/(app)/settings")} style={styles.action}>
                  <Text allowFontScaling style={{ color: palette.foreground }}>Open settings</Text>
                </Pressable>
              ) : null}
              {unread ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Mark ${presentation.title} as read`} onPress={() => void runAction(() => markRead({ itemId: item.itemId }))} style={styles.action}>
                  <Text allowFontScaling style={{ color: palette.foreground }}>Mark read</Text>
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" accessibilityLabel={`Dismiss ${presentation.title}`} onPress={() => void runAction(() => dismiss({ itemId: item.itemId }))} style={styles.action}>
                <Text allowFontScaling style={{ color: palette.foreground }}>Dismiss</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
      {available === true && items.status === "CanLoadMore" ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Load more notifications" onPress={() => items.loadMore(20)} style={styles.action}>
          <Text allowFontScaling style={{ color: palette.foreground }}>Load more</Text>
        </Pressable>
      ) : null}
      {available === true && items.status === "LoadingMore" ? <ActivityIndicator accessibilityLabel="Loading more notifications" /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16 },
  title: { fontSize: 26, fontWeight: "700" },
  itemTitle: { fontSize: 18, fontWeight: "600" },
  description: { fontSize: 15, lineHeight: 22 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16, gap: 10 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  action: { minHeight: 48, justifyContent: "center", paddingHorizontal: 12 },
});
