import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { usePaginatedQuery, useMutation, useConvexConnectionState } from "convex/react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "../../convex/api";
import { mobileColors } from "../../theme/tokens";
import { bloomType } from "../../theme/typography";
import { BloomPanel, BloomNotice } from "../../components/BloomPanel";
import { BloomText as Text } from "../../components/BloomText";
import { latestUnreadPartnerMessage, orderMessagesForDisplay } from "../partner/partnerAccess";

const REACTIONS = ["💗", "✨", "🫶", "😂", "🥺", "🌙"];
const QUICK_COMPOSE = ["Thinking of you.", "Want me to handle dinner?", "I am here. No pressure to explain."];

export function CoupleChat({ dark = false, relationshipGeneration }: { dark?: boolean; relationshipGeneration: string }): React.JSX.Element {
  const palette = dark ? mobileColors.dark : mobileColors.light;
  const connection = useConvexConnectionState();
  const connected = connection.isWebSocketConnected;
  const { results, status, loadMore } = usePaginatedQuery(
    api.queries.messages.listPageForMobile,
    { relationshipGeneration },
    { initialNumItems: 30 },
  );
  const sendMessage = useMutation(api.mutations.messages.send);
  const reactToMessage = useMutation(api.mutations.messages.react);
  const clearThread = useMutation(api.mutations.messages.clear);
  const markDelivered = useMutation(api.mutations.messages.markDelivered);
  const markReadThrough = useMutation(api.mutations.messages.markReadThrough);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [isAtBottom, setIsAtBottom] = useState(false);
  const connectedRef = useRef(connected);
  connectedRef.current = connected;
  const isAtBottomRef = useRef(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const contentHeight = useRef(0);
  const viewportHeight = useRef(0);
  const hasMeasuredContent = useRef(false);
  const didScrollToLatest = useRef(false);
  const latestMessageId = results[0]?._id;
  const unread = latestUnreadPartnerMessage(results, isAtBottom);
  const messages = orderMessagesForDisplay(results);

  function updateAtBottom(value: boolean) {
    isAtBottomRef.current = value;
    setIsAtBottom(value);
  }

  const previousLatestMessageId = useRef<string | undefined>(latestMessageId);
  useLayoutEffect(() => {
    if (latestMessageId === previousLatestMessageId.current) return;
    previousLatestMessageId.current = latestMessageId;
    if (!isAtBottomRef.current) return;
    updateAtBottom(false);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [latestMessageId]);

  useFocusEffect(useCallback(() => {
    if (!unread || !isAtBottomRef.current) return;
    void markDelivered({ messageId: unread._id })
      .then(() => markReadThrough({ messageId: unread._id }))
      .catch(() => undefined);
  }, [isAtBottom, markDelivered, markReadThrough, unread?._id]));

  async function handleSend() {
    if (!connected) {
      setError("Reconnect to send. Messages are not queued offline.");
      return;
    }
    const body = draft.trim();
    if (!body || sending) return;
    setError(null);
    setSending(true);
    try {
      await sendMessage({ body });
      setDraft("");
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch {
      setError("Message not sent. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  function insertEmoji(emoji: string) {
    const { start, end } = selection;
    const next = draft.slice(0, start) + emoji + draft.slice(end);
    if (next.length > 500) return;
    setDraft(next);
    setSelection({ start: start + emoji.length, end: start + emoji.length });
  }

  function confirmClearThread() {
    if (!connected || clearing) return;
    Alert.alert("Clear this chat?", "This clears the conversation for both of you. It cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear chat",
        style: "destructive",
        onPress: () => {
          if (!connectedRef.current) {
            setError("Reconnect before clearing chat.");
            return;
          }
          setError(null);
          setClearing(true);
          void clearThread({ relationshipGeneration })
            .catch(() => setError("Chat not cleared. Refresh and try again."))
            .finally(() => setClearing(false));
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}>
    <View style={[styles.container, { backgroundColor: "transparent", paddingBottom: 12 }]}>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <Text accessibilityRole="header" style={[bloomType.display, { color: palette.foreground }]}>Chat</Text>
        </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={clearing ? "Clearing chat" : "Clear chat"}
        accessibilityState={{ disabled: !connected || clearing }}
        disabled={!connected || clearing}
        onPress={confirmClearThread}
        style={[styles.clearButton, { borderColor: palette.outline }]}
      >
        <Text style={[bloomType.caption, { color: palette.muted }]}>{clearing ? "Clearing…" : "Clear chat"}</Text>
      </Pressable>
      </View>
      {!connected ? (
        <BloomNotice palette={palette} alert>Reconnect before sending. Messages are not queued offline.</BloomNotice>
      ) : null}
      {status === "CanLoadMore" ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Load older messages"
          onPress={() => loadMore(40)}
          style={styles.secondaryButton}
        >
          <Text style={{ color: palette.foreground }}>Load older messages</Text>
        </Pressable>
      ) : status === "LoadingMore" ? (
        <Text accessibilityRole="progressbar" accessibilityLiveRegion="polite" style={{ color: palette.muted }}>
          Loading older messages…
        </Text>
      ) : null}
      <ScrollView
        ref={scrollRef}
        accessibilityLabel="Couple chat messages"
        style={styles.messages}
        contentContainerStyle={styles.messageList}
        onLayout={({ nativeEvent }) => {
          viewportHeight.current = nativeEvent.layout.height;
          if (hasMeasuredContent.current && contentHeight.current <= viewportHeight.current + 2) {
            updateAtBottom(true);
          }
        }}
        onContentSizeChange={(_, height) => {
          const grew = height > contentHeight.current;
          contentHeight.current = height;
          hasMeasuredContent.current = true;
          if (!didScrollToLatest.current && status !== "LoadingFirstPage") {
            didScrollToLatest.current = true;
            requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
          } else if (didScrollToLatest.current && grew) {
            updateAtBottom(false);
          }
          if (didScrollToLatest.current && status !== "LoadingFirstPage" && height <= viewportHeight.current + 2) {
            updateAtBottom(true);
          }
        }}
        onScroll={({ nativeEvent }) => {
          const remaining = nativeEvent.contentSize.height -
            nativeEvent.layoutMeasurement.height - nativeEvent.contentOffset.y;
          updateAtBottom(remaining <= 2);
        }}
        scrollEventThrottle={16}
      >
        <Text style={[bloomType.caption, { color: palette.muted }]}>A private conversation between you and your partner</Text>
        {messages.map((message) => (
          <View key={message._id} style={[styles.message, { backgroundColor: message.isMine ? palette.highlight : palette.surface, borderColor: palette.outline, alignSelf: message.isMine ? "flex-end" : "flex-start" }]}>
            <Text style={[bloomType.label, { color: message.isMine ? palette.accent : palette.foreground }]}>{message.isMine ? "YOU" : message.senderName}</Text>
            <Text allowFontScaling style={[bloomType.body, { color: palette.foreground }]}>{message.body}</Text>
            <Text allowFontScaling style={[bloomType.caption, { color: palette.muted }]}>
              {message.readAt ? "Read" : message.deliveredAt ? "Delivered" : "Sent"}
            </Text>
            <View style={styles.reactions}>
              {REACTIONS.map((emoji) => {
                const reaction = message.reactions.find((entry) => entry.emoji === emoji);
                return (
                  <Pressable
                    key={emoji}
                    accessibilityRole="button"
                    accessibilityLabel={`${reaction?.isMine ? "Remove" : "Add"} ${emoji} reaction to message from ${message.senderName}`}
                    accessibilityState={{ selected: reaction?.isMine ?? false }}
                    onPress={() => void reactToMessage({ messageId: message._id, emoji }).catch(() => {
                      setError("Reaction not saved. Try again.");
                    })}
                    style={styles.reactionButton}
                  >
                    <Text style={{ color: palette.foreground }}>
                      {emoji}{reaction ? ` ${reaction.count}` : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        {messages.length === 0 && status !== "LoadingFirstPage" ? (
          <BloomPanel palette={palette} variant="sage"><Text style={[bloomType.body, { color: palette.foreground }]}>Start a private conversation. Messages stay between you and your partner.</Text></BloomPanel>
        ) : null}
      </ScrollView>
      <ScrollView accessibilityLabel="Message controls" style={styles.controls} contentContainerStyle={styles.controlContent} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets nestedScrollEnabled>
      {error ? <BloomNotice palette={palette} alert>{error}</BloomNotice> : null}
      <ScrollView horizontal keyboardShouldPersistTaps="handled" style={styles.quickScroll} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickCompose}>
        {QUICK_COMPOSE.map((suggestion) => (
          <Pressable
            key={suggestion}
            accessibilityRole="button"
            accessibilityLabel={`Compose ${suggestion}`}
            onPress={() => { setDraft(suggestion); setSelection({ start: suggestion.length, end: suggestion.length }); }}
            style={[styles.quickChip, { borderColor: palette.outline, backgroundColor: palette.surface }]}
          >
            <Text style={{ color: palette.foreground }}>{suggestion}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          accessibilityLabel="Write a private message"
          maxLength={500}
          multiline
          onChangeText={setDraft}
          onSelectionChange={({ nativeEvent }) => setSelection(nativeEvent.selection)}
          placeholder="Write a message"
          selection={selection}
          style={[styles.input, bloomType.body, { color: palette.foreground, borderColor: palette.controlBorder, backgroundColor: palette.surface }]}
          value={draft}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showEmojiPicker ? "Hide emoji picker" : "Add emoji"}
          accessibilityState={{ expanded: showEmojiPicker }}
          onPress={() => setShowEmojiPicker((visible) => !visible)}
          style={styles.emojiToggle}
        >
          <Text style={{ color: palette.foreground }}>😊</Text>
        </Pressable>
      </View>
      {showEmojiPicker ? (
        <View accessibilityLabel="Emoji input" style={styles.emojiPicker}>
          {REACTIONS.map((emoji) => (
            <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`Insert ${emoji}`} onPress={() => insertEmoji(emoji)} style={styles.reactionButton}>
              <Text style={{ color: palette.foreground }}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={sending ? "Sending message" : "Send message"}
        accessibilityState={{ disabled: !connected || !draft.trim() || sending }}
        disabled={!connected || !draft.trim() || sending}
        onPress={() => void handleSend()}
        style={[styles.sendButton, { backgroundColor: palette.accent, borderColor: palette.accent, opacity: connected && draft.trim() && !sending ? 1 : 0.5 }]}
      >
        <Text style={[bloomType.button, { color: palette.onAccent }]}>{sending ? "Sending…" : "Send"}</Text>
      </Pressable>
      </ScrollView>
    </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  container: { flex: 1, gap: 10, padding: 16, minHeight: 0 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  titleGroup: { flex: 1, gap: 2 },
  messages: { flex: 1, minHeight: 96 },
  controls: { flexGrow: 0, flexShrink: 1, maxHeight: "55%" },
  controlContent: { gap: 10, paddingBottom: 4 },
  quickScroll: { flexGrow: 0, flexShrink: 0 },
  messageList: { gap: 12, paddingVertical: 8 },
  message: { gap: 6, padding: 14, borderRadius: 22, borderWidth: 1, maxWidth: "88%" },
  reactions: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  quickCompose: { flexDirection: "row", gap: 8, alignItems: "center" },
  quickChip: { minHeight: 48, borderWidth: 1, borderRadius: 20, justifyContent: "center", paddingHorizontal: 14, paddingVertical: 9 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  reactionButton: { minHeight: 48, minWidth: 48, alignItems: "center", justifyContent: "center", padding: 4 },
  input: { flex: 1, minHeight: 48, maxHeight: 200, borderWidth: 1, borderRadius: 18, padding: 12 },
  emojiToggle: { minHeight: 48, minWidth: 44, alignItems: "center", justifyContent: "center" },
  emojiPicker: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap" },
  clearButton: { minHeight: 48, alignSelf: "flex-end", justifyContent: "center", borderWidth: 1, borderRadius: 999, paddingHorizontal: 14 },
  secondaryButton: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  sendButton: { minHeight: 52, minWidth: 92, alignItems: "center", justifyContent: "center", borderRadius: 18, borderWidth: 1 },
});
