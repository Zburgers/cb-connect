import { useEffect, useState } from "react";
import { AppState, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, useColorScheme, View } from "react-native";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/api";
import { mobileColors } from "../../theme/tokens";
import type { AccessState } from "../../navigation/accessResolver";
import { canLoadPartnerCycleProjection, canRenderPartnerViews, type CoupleRole } from "./partnerAccess";
import { CoupleChat } from "../chat/CoupleChat";

type CoupleStatus = FunctionReturnType<typeof api.queries.couples.getCoupleStatus>;
type GuardState = FunctionReturnType<typeof api.queries.mobileAccess.getGuardState>;
type ActiveCoupleStatus = CoupleStatus & { relationshipGeneration: string };

function hasRelationshipGeneration(couple: CoupleStatus | undefined): couple is ActiveCoupleStatus {
  return typeof couple?.relationshipGeneration === "string" && couple.relationshipGeneration.length > 0;
}

export function PartnerControls({
  access,
  role,
  couple,
  guard,
  isActive,
  revoking,
  onRevokeStart,
  onRevokeFailure,
}: {
  access: AccessState;
  role: CoupleRole | null;
  couple: CoupleStatus | undefined;
  guard: GuardState | undefined;
  isActive: boolean;
  revoking: boolean;
  onRevokeStart: () => void;
  onRevokeFailure: () => void;
}): React.JSX.Element {
  const dark = useColorScheme() === "dark";
  const activeView = canRenderPartnerViews(access, role, isActive, revoking) &&
    guard?.couple?.isLinked === true && guard.couple.role === role;

  if (revoking) {
    return <Message text="Revoking partner access…" dark={dark} />;
  }
  if (activeView && role && hasRelationshipGeneration(couple)) {
    return <ActivePartnerView key={couple.relationshipGeneration} role={role} couple={couple} dark={dark} onRevokeStart={onRevokeStart} onRevokeFailure={onRevokeFailure} />;
  }
  if (couple?.status === "active") {
    return <Message text="Refreshing relationship access…" dark={dark} />;
  }
  if (couple === undefined || guard === undefined) {
    return <Message text="Checking relationship access…" dark={dark} />;
  }
  if (!role) return <Message text="Complete account setup before pairing." dark={dark} />;

  return <PairingControls role={role} couple={couple} dark={dark} />;
}

function PairingControls({
  role,
  couple,
  dark,
}: {
  role: CoupleRole;
  couple: CoupleStatus;
  dark: boolean;
}): React.JSX.Element {
  const palette = dark ? mobileColors.dark : mobileColors.light;
  const generateCode = useAction(api.mutations.couples.generatePairingCode);
  const linkWithCode = useMutation(api.mutations.couples.linkPartnerWithCode);
  const [code, setCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function createCode() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await generateCode({});
      setGeneratedCode(result.code);
    } catch {
      setMessage("A pairing code could not be created. Try again later.");
    } finally {
      setBusy(false);
    }
  }

  async function joinCouple() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await linkWithCode({ code });
      if (result.success) setCode("");
      else setMessage(result.error);
    } catch {
      setMessage("The pairing request could not be completed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const pairingCode = generatedCode ?? couple.activePairingCode?.code;
  return (
    <ScrollView contentContainerStyle={styles.page} style={{ backgroundColor: palette.background }}>
      <Text accessibilityRole="header" style={[styles.heading, { color: palette.foreground }]}>Partner connection</Text>
      {role === "primary" ? (
        <>
          <Text style={{ color: palette.muted }}>Create a code for one partner to join.</Text>
          {pairingCode ? (
            <Text accessibilityLabel="Pairing code" selectable style={[styles.code, { color: palette.foreground }]}>
              {pairingCode}
            </Text>
          ) : null}
          {couple.activePairingCode ? (
            <Text style={{ color: palette.muted }}>
              Expires {new Date(couple.activePairingCode.expiresAt).toLocaleString()}.
            </Text>
          ) : null}
          <Button label={busy ? "Creating pairing code" : pairingCode ? "Create a new pairing code" : "Create pairing code"} disabled={busy} onPress={() => void createCode()} dark={dark} />
          {couple.status === "pending" ? (
            <Text style={{ color: palette.muted }}>This code can be used by one partner account.</Text>
          ) : null}
        </>
      ) : (
        <>
          <Text style={{ color: palette.muted }}>Enter the pairing code from your partner.</Text>
          <TextInput
            accessibilityLabel="Partner pairing code"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={64}
            onChangeText={setCode}
            placeholder="Pairing code"
            style={[styles.input, { color: palette.foreground, borderColor: palette.muted }]}
            value={code}
          />
          <Button label={busy ? "Connecting" : "Connect with code"} disabled={busy || !code.trim()} onPress={() => void joinCouple()} dark={dark} />
        </>
      )}
      {message ? <Text accessibilityRole="alert" style={{ color: palette.foreground }}>{message}</Text> : null}
    </ScrollView>
  );
}

function ActivePartnerView({
  role,
  couple,
  dark,
  onRevokeStart,
  onRevokeFailure,
}: {
  role: CoupleRole;
  couple: ActiveCoupleStatus;
  dark: boolean;
  onRevokeStart: () => void;
  onRevokeFailure: () => void;
}): React.JSX.Element {
  const palette = dark ? mobileColors.dark : mobileColors.light;
  const [error, setError] = useState<string | null>(null);
  const [sharingBusy, setSharingBusy] = useState(false);
  const sharing = useMutation(api.mutations.couples.updateSharingSettings);
  const revoke = useMutation(api.mutations.couples.revokePartnerAccess);
  const settings = couple.sharingSettings;
  if (!settings) return <Message text="Refreshing sharing controls…" dark={dark} />;

  async function setSharing(key: "sharingPain" | "sharingPhase" | "sharingPeriodWrite", value: boolean) {
    if (sharingBusy) return;
    setSharingBusy(true);
    setError(null);
    try {
      await sharing({ [key]: value });
    } catch {
      setError("Sharing setting was not changed. Try again.");
    } finally {
      setSharingBusy(false);
    }
  }

  function confirmRevoke() {
    Alert.alert("Revoke partner access?", "Your partner will lose access to shared cycle information and chat.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Revoke access",
        style: "destructive",
        onPress: () => {
          onRevokeStart();
          void revoke({}).catch(() => {
            onRevokeFailure();
            setError("Partner access was not revoked. Try again.");
          });
        },
      },
    ]);
  }

  return (
    <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={styles.page}>
      <Text accessibilityRole="header" style={[styles.heading, { color: palette.foreground }]}>Partner connection</Text>
      <Text style={{ color: palette.muted }}>
        {couple.partner?.displayName ? `Connected with ${couple.partner.displayName}.` : "Your partner is connected."}
      </Text>
      <PresenceStatus dark={dark} />
      {role === "primary" ? (
        <>
          <Text accessibilityRole="header" style={[styles.subheading, { color: palette.foreground }]}>Sharing controls</Text>
          <Toggle label="Cycle phase" value={settings.phase} onChange={(value) => void setSharing("sharingPhase", value)} dark={dark} disabled={sharingBusy} />
          <Toggle label="Pain details" value={settings.pain} onChange={(value) => void setSharing("sharingPain", value)} dark={dark} disabled={sharingBusy} />
          <Toggle label="Partner period logging" value={settings.periodWrite} onChange={(value) => void setSharing("sharingPeriodWrite", value)} dark={dark} disabled={sharingBusy} />
          <Button label="Revoke partner access" onPress={confirmRevoke} dark={dark} destructive />
        </>
      ) : (
        <PartnerCycleSummary role={role} sharingPhase={settings.phase} dark={dark} />
      )}
      <NudgeControls dark={dark} />
      {error ? <Text accessibilityRole="alert" style={{ color: palette.foreground }}>{error}</Text> : null}
      <CoupleChat relationshipGeneration={couple.relationshipGeneration} dark={dark} />
    </ScrollView>
  );
}

function PartnerCycleSummary({ role, sharingPhase, dark }: { role: CoupleRole; sharingPhase: boolean; dark: boolean }): React.JSX.Element {
  const palette = dark ? mobileColors.dark : mobileColors.light;
  const cycle = useQuery(
    api.queries.dashboard.getDashboardData,
    canLoadPartnerCycleProjection("partner", role, true, sharingPhase) ? {} : "skip",
  );
  const projection = cycle?.cycleStateV1;
  const status = projection && typeof projection.status === "string"
    ? projection.status.replaceAll("_", " ")
    : null;
  const phase = projection && "phase" in projection && projection.phase
    ? projection.phase
    : cycle?.cycleInfo?.phase ?? null;
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.subheading, { color: palette.foreground }]}>Shared cycle update</Text>
      {!sharingPhase ? (
        <Text style={{ color: palette.muted }}>Cycle phase is not shared.</Text>
      ) : cycle === undefined ? (
        <Text accessibilityRole="progressbar" style={{ color: palette.muted }}>Loading shared update…</Text>
      ) : phase ? (
        <Text style={{ color: palette.foreground }}>Current phase: {phase}</Text>
      ) : (
        <Text style={{ color: palette.muted }}>{cycle.message ?? status ?? "No shared update is available."}</Text>
      )}
    </View>
  );
}

function PresenceStatus({ dark }: { dark: boolean }): React.JSX.Element {
  const palette = dark ? mobileColors.dark : mobileColors.light;
  const presence = useQuery(api.queries.presence.getPartnerPresence, {});
  const heartbeat = useMutation(api.mutations.presence.heartbeat);
  const goOffline = useMutation(api.mutations.presence.goOffline);

  useEffect(() => {
    const beat = () => {
      if (AppState.currentState === "active") void heartbeat({}).catch(() => undefined);
      else void goOffline({}).catch(() => undefined);
    };
    beat();
    const interval = setInterval(beat, 15_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void heartbeat({}).catch(() => undefined);
      else void goOffline({}).catch(() => undefined);
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
      void goOffline({}).catch(() => undefined);
    };
  }, [goOffline, heartbeat]);

  const label = presence === undefined
    ? "Checking recent activity…"
    : presence?.isPresent
      ? "Recently active"
      : presence?.lastSeen
        ? `Last active ${new Date(presence.lastSeen).toLocaleString()}`
        : "No recent activity";
  return <Text accessibilityLabel={`Partner activity: ${label}`} style={{ color: palette.muted }}>{label}</Text>;
}

function NudgeControls({ dark }: { dark: boolean }): React.JSX.Element {
  const palette = dark ? mobileColors.dark : mobileColors.light;
  const send = useMutation(api.mutations.nudges.send);
  const markSeen = useMutation(api.mutations.nudges.markSeen);
  const latest = useQuery(api.queries.nudges.latestReceived, {});
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const emojis = ["💗", "🤗", "☕", "🌙", "✨", "🫶"];
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.subheading, { color: palette.foreground }]}>Send a nudge</Text>
      <View style={styles.nudges}>
        {emojis.map((emoji) => (
          <Pressable
            key={emoji}
            accessibilityRole="button"
            accessibilityLabel={`Send ${emoji} nudge`}
            accessibilityState={{ disabled: sending }}
            disabled={sending}
            onPress={() => {
              setSending(true);
              void send({ emoji }).catch(() => setError("Nudge not sent. Try again.")).finally(() => setSending(false));
            }}
            style={styles.nudgeButton}
          >
            <Text>{emoji}</Text>
          </Pressable>
        ))}
      </View>
      {latest ? (
        <View>
          <Text style={{ color: palette.foreground }}>{latest.senderName}: {latest.message}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mark nudge as seen"
            onPress={() => void markSeen({ nudgeId: latest._id }).catch(() => setError("Nudge receipt was not saved."))}
            style={styles.actionButton}
          >
            <Text style={{ color: palette.foreground }}>Mark as seen</Text>
          </Pressable>
        </View>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={{ color: palette.foreground }}>{error}</Text> : null}
    </View>
  );
}

function Toggle({ label, value, onChange, dark, disabled = false }: { label: string; value: boolean; onChange: (value: boolean) => void; dark: boolean; disabled?: boolean }): React.JSX.Element {
  const palette = dark ? mobileColors.dark : mobileColors.light;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={styles.toggle}
    >
      <Text style={{ color: palette.foreground }}>{label}</Text>
      <Text style={{ color: palette.foreground }}>{value ? "On" : "Off"}</Text>
    </Pressable>
  );
}

function Button({ label, onPress, disabled = false, dark, destructive = false }: { label: string; onPress: () => void; disabled?: boolean; dark: boolean; destructive?: boolean }): React.JSX.Element {
  const palette = dark ? mobileColors.dark : mobileColors.light;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.actionButton, { borderColor: destructive ? "#B91C1C" : palette.muted, opacity: disabled ? 0.5 : 1 }]}
    >
      <Text style={{ color: destructive ? "#B91C1C" : palette.foreground }}>{label}</Text>
    </Pressable>
  );
}

function Message({ text, dark }: { text: string; dark: boolean }): React.JSX.Element {
  const palette = dark ? mobileColors.dark : mobileColors.light;
  return <View style={[styles.page, { backgroundColor: palette.background }]}><Text style={{ color: palette.foreground }}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, gap: 14, padding: 20 },
  heading: { fontSize: 22, fontWeight: "700" },
  subheading: { fontSize: 17, fontWeight: "700" },
  code: { fontSize: 24, fontWeight: "700", letterSpacing: 3, paddingVertical: 8 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 8, padding: 12 },
  actionButton: { minHeight: 48, justifyContent: "center", alignItems: "center", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12 },
  toggle: { minHeight: 48, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 8 },
  section: { gap: 8, paddingVertical: 8 },
  nudges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  nudgeButton: { minHeight: 48, minWidth: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#9CA3AF", borderRadius: 8 },
});
