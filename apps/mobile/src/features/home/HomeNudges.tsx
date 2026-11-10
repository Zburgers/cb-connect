import { useContext, useEffect, useState } from "react";
import { useConvexConnectionState, useMutation, useQuery } from "convex/react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../../convex/api";
import { AccessContext } from "../../navigation/accessContext";
import { mobileColors } from "../../theme/tokens";
import { canSendNudge, NUDGE_OPTIONS } from "./HomeModel";

export function HomeNudges({ dark }: { dark: boolean }): React.JSX.Element | null {
  const access = useContext(AccessContext);
  const linked = access === "primary" || access === "partner";
  const online = useConvexConnectionState().isWebSocketConnected;
  const palette = dark ? mobileColors.dark : mobileColors.light;
  const presence = useQuery(
    api.queries.presence.getPartnerPresence,
    linked ? {} : "skip",
  );
  const latest = useQuery(
    api.queries.nudges.latestReceived,
    linked ? {} : "skip",
  );
  const send = useMutation(api.mutations.nudges.send);
  const markSeen = useMutation(api.mutations.nudges.markSeen);
  const [now, setNow] = useState(() => Date.now());
  const [sending, setSending] = useState(false);
  const [sentEmoji, setSentEmoji] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!presence?.expiresAt) return;
    const delay = Math.max(0, presence.expiresAt - Date.now() + 50);
    const timeout = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(timeout);
  }, [presence]);

  const partnerPresent = Boolean(
    presence?.isPresent && presence.expiresAt > now,
  );
  const canSend = canSendNudge(access, online, partnerPresent);

  useEffect(() => {
    if (!partnerPresent) setSentEmoji(null);
  }, [partnerPresent]);

  if (!linked) return null;

  async function sendNudge(emoji: string) {
    if (!canSend || sending) return;
    setSending(true);
    setSentEmoji(null);
    setError(null);
    try {
      await send({ emoji });
      setSentEmoji(emoji);
    } catch {
      setError("Nudge not sent. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  async function dismissNudge() {
    if (!latest || dismissing) return;
    setDismissing(true);
    setError(null);
    try {
      await markSeen({ nudgeId: latest._id });
    } catch {
      setError("Nudge receipt was not saved. Try again.");
    } finally {
      setDismissing(false);
    }
  }

  const target = access === "partner" ? "your partner" : "partner";

  return (
    <View style={styles.stack}>
      {canSend ? (
        <View
          style={[
            styles.card,
            { backgroundColor: palette.glass, borderColor: palette.border },
          ]}
        >
          <Text
            accessibilityRole="header"
            style={[styles.label, { color: palette.foreground }]}
          >
            {access === "partner" ? "Both online now" : "Partner online now"}
          </Text>
          <Text style={[styles.heading, { color: palette.foreground }]}>
            Nudge {target}
          </Text>
          <View style={styles.emojiRow}>
            {NUDGE_OPTIONS.map(({ emoji, message }) => (
              <Pressable
                key={emoji}
                accessibilityRole="button"
                accessibilityLabel={`Send nudge: ${message}`}
                accessibilityState={{ disabled: sending }}
                disabled={sending}
                onPress={() => void sendNudge(emoji)}
                style={[
                  styles.emojiButton,
                  {
                    backgroundColor:
                      sentEmoji === emoji ? palette.highlight : palette.surface,
                    borderColor: palette.border,
                    opacity: sending ? 0.6 : 1,
                  },
                ]}
              >
                <Text style={styles.emoji}>{sending ? "…" : emoji}</Text>
              </Pressable>
            ))}
          </View>
          {sentEmoji ? (
            <Text style={{ color: palette.foreground }}>
              Sent {sentEmoji} to {target}.
            </Text>
          ) : null}
        </View>
      ) : null}

      {latest ? (
        <View
          accessible
          accessibilityRole="summary"
          accessibilityLabel={`${latest.senderName} nudged you. ${latest.message}`}
          style={[
            styles.receivedCard,
            { backgroundColor: palette.highlight, borderColor: palette.accent },
          ]}
        >
          <Text style={styles.receivedEmoji}>{latest.emoji}</Text>
          <View style={styles.receivedCopy}>
            <Text style={[styles.label, { color: palette.foreground }]}>
              {latest.senderName} nudged you
            </Text>
            <Text style={[styles.message, { color: palette.foreground }]}>
              {latest.message}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss nudge"
            accessibilityState={{ disabled: dismissing }}
            disabled={dismissing}
            onPress={() => void dismissNudge()}
            style={styles.dismiss}
          >
            <Text style={{ color: palette.foreground }}>{dismissing ? "…" : "×"}</Text>
          </Pressable>
        </View>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: palette.foreground }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  card: { borderWidth: 1, borderRadius: 24, padding: 16, gap: 10 },
  label: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.2 },
  heading: { fontSize: 18, fontWeight: "700" },
  emojiRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emojiButton: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 22 },
  receivedCard: { minHeight: 80, borderWidth: 1, borderRadius: 24, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  receivedEmoji: { fontSize: 28 },
  receivedCopy: { flex: 1, gap: 4 },
  message: { fontSize: 15, fontWeight: "600" },
  dismiss: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
});
