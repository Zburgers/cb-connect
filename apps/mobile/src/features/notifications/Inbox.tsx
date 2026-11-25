import { useState } from "react";
import { useRouter } from "expo-router";
import { usePaginatedQuery, useMutation, useQuery } from "convex/react";
import { ActivityIndicator, Pressable, StyleSheet, useColorScheme, View } from "react-native";
import { api } from "../../convex/api";
import type { NotificationInboxItemDTO } from "@cb-connect/contracts";
import { mobileColors } from "../../theme/tokens";
import { bloomType } from "../../theme/typography";
import { BloomNotice, BloomPanel } from "../../components/BloomPanel";
import { BloomScreen } from "../../components/BloomScreen";
import { BloomText as Text } from "../../components/BloomText";
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
    <BloomScreen palette={palette} eyebrow="PRIVATE UPDATES" title="Inbox" subtitle="Private in-app updates appear here. Push delivery is not available in this build.">
      {available === undefined || (available && items.status === "LoadingFirstPage") ? (
        <ActivityIndicator accessibilityLabel="Loading notifications" />
      ) : null}
      {available === false ? (
        <BloomNotice palette={palette} alert>In-app inbox access is unavailable for this account right now. This does not reflect device notification permission or push channel availability.</BloomNotice>
      ) : null}
      {actionFailed ? <BloomNotice palette={palette} alert>Unable to update this notification. Try again.</BloomNotice> : null}
      {available === true && items.status !== "LoadingFirstPage" && visibleItems.length === 0 ? (
        <BloomPanel palette={palette} variant="sage"><Text allowFontScaling style={[bloomType.body, { color: palette.foreground }]}>You’re all caught up.</Text></BloomPanel>
      ) : null}
      {visibleItems.map((item) => {
        const presentation = getInboxPresentation(item as NotificationInboxItemDTO);
        if (!presentation) return null;
        const unread = isInboxItemUnread(item as NotificationInboxItemDTO);
        return (
          <BloomPanel key={item.itemId} palette={palette} variant={unread ? "warm" : "quiet"} style={styles.card}>
            <View style={[styles.status, { backgroundColor: unread ? palette.accent : palette.sageSurface }]}>
              <Text allowFontScaling accessibilityLabel={unread ? "Unread notification" : "Read notification"} style={[bloomType.label, { color: unread ? palette.onAccent : palette.sage }]}>{unread ? "UNREAD" : "READ"}</Text>
            </View>
            <Text allowFontScaling accessibilityRole="header" style={[bloomType.section, { color: palette.foreground }]}>{presentation.title}</Text>
            <Text allowFontScaling style={[styles.description, { color: palette.muted }]}>{presentation.body}</Text>
            <Text allowFontScaling accessibilityLabel={`Notification section: ${presentation.destination}`} style={[bloomType.caption, { color: palette.muted }]}>
              Section: {presentation.destination === "settings" ? "Settings" : presentation.destination === "chat" ? "Chat" : "Partner"}
            </Text>
            <View style={styles.actions}>
              {presentation.destination === "settings" ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Open settings for ${presentation.title}`} onPress={() => router.push("/(app)/settings")} style={styles.action}>
                  <Text allowFontScaling style={{ color: palette.foreground }}>Open settings</Text>
                </Pressable>
              ) : presentation.destination === "chat" ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Open messages for ${presentation.title}`} onPress={() => router.push("/(app)/chat")} style={[styles.action, { borderColor: palette.border }]}>
                  <Text allowFontScaling style={{ color: palette.foreground }}>Open messages</Text>
                </Pressable>
              ) : (
                <Pressable accessibilityRole="button" accessibilityLabel={`Open partner for ${presentation.title}`} onPress={() => router.push("/(app)/partner")} style={[styles.action, { borderColor: palette.border }]}>
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
          </BloomPanel>
        );
      })}
      {available === true && items.status === "CanLoadMore" ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Load more notifications" onPress={() => items.loadMore(20)} style={[styles.action, { borderColor: palette.border }]}>
          <Text allowFontScaling style={{ color: palette.foreground }}>Load more</Text>
        </Pressable>
      ) : null}
      {available === true && items.status === "LoadingMore" ? <ActivityIndicator accessibilityLabel="Loading more notifications" /> : null}
    </BloomScreen>
  );
}

const styles = StyleSheet.create({
  description: { fontSize: 15, lineHeight: 22 },
  card: { padding: 18, gap: 12 },
  status: { alignSelf: "flex-start", minHeight: 30, justifyContent: "center", borderRadius: 999, paddingHorizontal: 12 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: { minHeight: 48, justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 16 },
});
