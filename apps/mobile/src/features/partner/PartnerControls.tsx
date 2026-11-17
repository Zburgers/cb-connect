import { useEffect, useState } from "react";
import { Alert, Pressable, Share, StyleSheet, TextInput, useColorScheme, View } from "react-native";
import { useAction, useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/expo";
import type { FunctionReturnType } from "convex/server";
import * as Clipboard from "expo-clipboard";
import { api } from "../../convex/api";
import { mobileColors } from "../../theme/tokens";
import { bloomType } from "../../theme/typography";
import { BloomNotice, BloomPanel } from "../../components/BloomPanel";
import { BloomScreen } from "../../components/BloomScreen";
import { BloomText as Text } from "../../components/BloomText";
import { BloomLocket } from "../../components/BloomLocket";
import type { AccessState } from "../../navigation/accessResolver";
import { canLoadPartnerCycleProjection, canRenderPartnerViews, type CoupleRole } from "./partnerAccess";
import { HomeNudges } from "../home/HomeNudges";
import { DateField } from "../logging/DateField";
import { getFreshPairingCode, normalizeNickname, normalizePairingCode, syncPartnerDrafts } from "./partnerDetails";

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
  const { signOut } = useAuth();
  const generateCode = useAction(api.mutations.couples.generatePairingCode);
  const linkWithCode = useMutation(api.mutations.couples.linkPartnerWithCode);
  const [code, setCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState<{ code: string; expiresAt: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const generatedCodeExpiry = generatedCode?.expiresAt;
  const serverCodeExpiry = couple.activePairingCode?.expiresAt;

  useEffect(() => {
    const nextExpiry = [generatedCodeExpiry, serverCodeExpiry]
      .filter((expiry): expiry is number => expiry !== undefined && expiry > now)
      .sort((left, right) => left - right)[0];
    if (nextExpiry === undefined) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(1, nextExpiry - Date.now() + 1));
    return () => clearTimeout(timer);
  }, [generatedCodeExpiry, now, serverCodeExpiry]);

  async function createCode() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await generateCode({});
      setGeneratedCode(result);
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
      const normalizedCode = normalizePairingCode(code);
      if (!normalizedCode) {
        setMessage("Enter a valid 6 or 12 character pairing code.");
        return;
      }
      const result = await linkWithCode({ code: normalizedCode });
      if (result.success) setCode("");
      else setMessage(result.error);
    } catch {
      setMessage("The pairing request could not be completed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const activePairingCode = getFreshPairingCode(generatedCode, couple.activePairingCode, now);
  const pairingCode = activePairingCode?.code;
  const pairingExpiresAt = activePairingCode?.expiresAt;
  const pairingCodeExpired = [generatedCodeExpiry, serverCodeExpiry].some((expiry) => expiry !== undefined && expiry <= now);
  async function copyPairingCode() {
    const freshCode = getFreshPairingCode(generatedCode, couple.activePairingCode, Date.now());
    if (!freshCode) {
      setNow(Date.now());
      setMessage("Pairing code expired. Create a new one to invite your partner.");
      return;
    }
    try {
      await Clipboard.setStringAsync(freshCode.code);
      setMessage("Pairing code copied.");
    } catch {
      setMessage("Could not copy the pairing code. You can select it to copy manually.");
    }
  }
  async function sharePairingCode() {
    const freshCode = getFreshPairingCode(generatedCode, couple.activePairingCode, Date.now());
    if (!freshCode) {
      setNow(Date.now());
      setMessage("Pairing code expired. Create a new one to invite your partner.");
      return;
    }
    try {
      await Share.share({ message: `Join me on CB Connect! Use pairing code: ${freshCode.code}` }, { dialogTitle: "Share pairing code" });
    } catch {
      setMessage("Could not open the share menu. Copy the code to share it.");
    }
  }
  return (
    <BloomScreen palette={palette} title="Partner connection" eyebrow="YOUR SHARED SPACE" subtitle={role === "primary" ? "Create a private invitation for one partner." : "Connect with the person who invited you."}>
      <BloomLocket />
      {role === "primary" ? (
        <>
          <BloomPanel palette={palette} variant="warm">
          <Text style={[bloomType.section, { color: palette.foreground }]}>Invite your partner</Text>
          {pairingCode ? (
            <Text accessibilityLabel="Pairing code" selectable style={[styles.code, { color: palette.foreground }]}>
              {pairingCode}
            </Text>
          ) : null}
          {pairingExpiresAt ? <Text style={{ color: palette.muted }}>Expires {new Date(pairingExpiresAt).toLocaleString()}.</Text> : null}
          {pairingCodeExpired ? <Text accessibilityRole="alert" style={{ color: palette.muted }}>Pairing code expired. Create a new one to invite your partner.</Text> : null}
          {pairingCode ? (
            <View style={styles.actions}>
              <Button label="Copy pairing code" onPress={() => void copyPairingCode()} dark={dark} />
              <Button label="Share pairing code" onPress={() => void sharePairingCode()} dark={dark} />
            </View>
          ) : null}
          <Button label={busy ? "Creating pairing code" : pairingCode ? "Create a new pairing code" : "Create pairing code"} disabled={busy} onPress={() => void createCode()} dark={dark} />
          {couple.status === "pending" ? (
            <Text style={{ color: palette.muted }}>This code can be used by one partner account.</Text>
          ) : null}
          </BloomPanel>
        </>
      ) : (
        <>
          <BloomPanel palette={palette} variant="sage">
          <Text style={[bloomType.section, { color: palette.foreground }]}>Enter an invitation code</Text>
          <Text style={{ color: palette.muted }}>Use the 6 or 12 character code shared by your partner.</Text>
          <TextInput
            accessibilityLabel="Partner pairing code"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={14}
            autoComplete="off"
            textContentType="none"
            onChangeText={setCode}
            placeholder="Pairing code"
            style={[styles.input, { color: palette.foreground, borderColor: palette.muted }]}
            value={code}
          />
          <Button label={busy ? "Connecting" : "Connect with code"} disabled={busy || !code.trim()} onPress={() => void joinCouple()} dark={dark} />
          </BloomPanel>
        </>
      )}
      {message ? <BloomNotice palette={palette} alert>{message}</BloomNotice> : null}
      <Button label={busy ? "Please wait" : "Sign out"} disabled={busy} onPress={() => {
        setBusy(true);
        setMessage(null);
        void signOut().catch(() => setMessage("Unable to sign out. Try again.")).finally(() => setBusy(false));
      }} dark={dark} />
    </BloomScreen>
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
  const updateConnectedSinceDate = useMutation(api.mutations.couples.updateConnectedSinceDate);
  const updatePartnerNickname = useMutation(api.mutations.couples.updatePartnerNickname);
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [detailsMessage, setDetailsMessage] = useState<string | null>(null);
  const [drafts, setDrafts] = useState({
    connectedSinceDate: couple.connectedSinceDate ?? "",
    partnerNickname: couple.partner?.nickname ?? "",
  });
  const settings = couple.sharingSettings;
  useEffect(() => {
    setDrafts((current) => syncPartnerDrafts(current, { connectedSinceDate: couple.connectedSinceDate ?? "" }));
  }, [couple.connectedSinceDate]);
  useEffect(() => {
    setDrafts((current) => syncPartnerDrafts(current, { partnerNickname: couple.partner?.nickname ?? "" }));
  }, [couple.partner?.nickname]);
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

  async function saveConnectedSinceDate() {
    if (detailsBusy) return;
    setDetailsBusy(true);
    setDetailsMessage(null);
    try {
      await updateConnectedSinceDate({ connectedSinceDate: drafts.connectedSinceDate });
      setDetailsMessage(drafts.connectedSinceDate ? "Relationship date saved." : "Relationship date cleared.");
    } catch {
      setDetailsMessage("Relationship date was not saved. Check the date and try again.");
    } finally {
      setDetailsBusy(false);
    }
  }

  async function savePartnerNickname() {
    const nickname = normalizeNickname(drafts.partnerNickname);
    if (nickname === null) {
      setDetailsMessage("Nickname must be 40 characters or fewer.");
      return;
    }
    if (detailsBusy) return;
    setDetailsBusy(true);
    setDetailsMessage(null);
    try {
      await updatePartnerNickname({ nickname });
      setDrafts((current) => syncPartnerDrafts(current, { partnerNickname: nickname }));
      setDetailsMessage(nickname ? "Private nickname saved." : "Private nickname cleared.");
    } catch {
      setDetailsMessage("Private nickname was not saved. Try again.");
    } finally {
      setDetailsBusy(false);
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
    <BloomScreen palette={palette} title="Partner connection" eyebrow="YOUR SHARED SPACE" subtitle={couple.partner?.displayName ? `Connected with ${couple.partner.displayName}.` : "Your partner is connected."}>
      <BloomLocket />
      <PresenceStatus dark={dark} />
      <BloomPanel palette={palette} variant="warm">
        <Text accessibilityRole="header" style={[styles.subheading, { color: palette.foreground }]}>Relationship date</Text>
        <Text style={{ color: palette.muted }}>Used for anniversary moments in your shared space.</Text>
        {couple.anniversary ? <Text style={{ color: palette.foreground }}>{couple.anniversary.headline} · {couple.anniversary.body}</Text> : null}
        <DateField label="Relationship date" value={drafts.connectedSinceDate} onChange={(connectedSinceDate) => setDrafts((current) => syncPartnerDrafts(current, { connectedSinceDate }))} palette={palette} disabled={detailsBusy} clearable />
        <Button label={detailsBusy ? "Saving relationship details" : drafts.connectedSinceDate ? "Save relationship date" : "Clear relationship date"} disabled={detailsBusy} onPress={() => void saveConnectedSinceDate()} dark={dark} />
        <Text accessibilityRole="header" style={[styles.subheading, { color: palette.foreground }]}>Partner nickname</Text>
        <Text style={{ color: palette.muted }}>Private to your account. It only changes how your partner appears for you.</Text>
        <TextInput accessibilityLabel="Private partner nickname" editable={!detailsBusy} maxLength={40} onChangeText={(partnerNickname) => setDrafts((current) => syncPartnerDrafts(current, { partnerNickname }))} placeholder={couple.partner?.name ?? "Partner name"} value={drafts.partnerNickname} style={[styles.input, { color: palette.foreground, borderColor: palette.muted }]} />
        <Button label="Save nickname" disabled={detailsBusy} onPress={() => void savePartnerNickname()} dark={dark} />
        {detailsMessage ? <BloomNotice palette={palette} alert>{detailsMessage}</BloomNotice> : null}
      </BloomPanel>
      {role === "primary" ? (
        <>
          <BloomPanel palette={palette} variant="sage">
            <Text accessibilityRole="header" style={[styles.subheading, { color: palette.foreground }]}>Sharing controls</Text>
            <Text style={{ color: palette.muted }}>Choose what your partner can see or add. Changes take effect when saved.</Text>
            <Toggle label="Cycle phase" value={settings.phase} onChange={(value) => void setSharing("sharingPhase", value)} dark={dark} disabled={sharingBusy} />
            <Toggle label="Pain details" value={settings.pain} onChange={(value) => void setSharing("sharingPain", value)} dark={dark} disabled={sharingBusy} />
            <Toggle label="Partner period logging" value={settings.periodWrite} onChange={(value) => void setSharing("sharingPeriodWrite", value)} dark={dark} disabled={sharingBusy} />
            {sharingBusy ? <Text accessibilityRole="progressbar" style={{ color: palette.muted }}>Saving sharing setting…</Text> : null}
          </BloomPanel>
          <Button label="Revoke partner access" onPress={confirmRevoke} dark={dark} destructive />
        </>
      ) : (
        <PartnerCycleSummary role={role} sharingPhase={settings.phase} dark={dark} />
      )}
      <HomeNudges dark={dark} />
      {error ? <BloomNotice palette={palette} alert>{error}</BloomNotice> : null}
    </BloomScreen>
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

  const label = presence === undefined
    ? "Checking recent activity…"
    : presence?.isPresent
      ? "Recently active"
      : presence?.lastSeen
        ? `Last active ${new Date(presence.lastSeen).toLocaleString()}`
        : "No recent activity";
  return <Text accessibilityLabel={`Partner activity: ${label}`} style={{ color: palette.muted }}>{label}</Text>;
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
      style={[styles.toggle, { borderBottomColor: palette.border }]}
    >
      <Text style={{ color: palette.foreground }}>{label}</Text>
      <View style={[styles.statePill, { backgroundColor: value ? palette.highlight : palette.background }]}>
        <Text style={{ color: value ? palette.accent : palette.muted, fontWeight: "700" }}>{value ? "On" : "Off"}</Text>
      </View>
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
      style={[styles.actionButton, { borderColor: destructive ? palette.accent : palette.muted, opacity: disabled ? 0.5 : 1 }]}
    >
      <Text style={{ color: destructive ? palette.accent : palette.foreground }}>{label}</Text>
    </Pressable>
  );
}

function Message({ text, dark }: { text: string; dark: boolean }): React.JSX.Element {
  const palette = dark ? mobileColors.dark : mobileColors.light;
  return <BloomScreen palette={palette}><BloomPanel palette={palette}><Text style={[bloomType.body, { color: palette.foreground }]}>{text}</Text></BloomPanel></BloomScreen>;
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  subheading: { fontSize: 17, fontWeight: "700" },
  code: { fontSize: 24, fontWeight: "700", letterSpacing: 3, paddingVertical: 8 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 8, padding: 12 },
  actionButton: { minHeight: 48, justifyContent: "center", alignItems: "center", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12 },
  toggle: { minHeight: 52, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  statePill: { minWidth: 48, alignItems: "center", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  section: { gap: 8, paddingVertical: 8 },
});
