import { useContext, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useColorScheme, View } from "react-native";
import { useConvexConnectionState, useMutation, useQuery } from "convex/react";
import { loggingApi } from "./loggingApi";
import { AccessContext } from "../../navigation/accessContext";
import { dateDaysAgo, localDate, loggingErrorMessage, periodSuccessMessage } from "./logging";

function Action({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}

export function LoggingScreen() {
  const access = useContext(AccessContext);
  const role = access === "partner" ? "partner" : "primary";
  const online = useConvexConnectionState().isWebSocketConnected;
  const palette = useColorScheme() === "dark" ? { bg: "#111827", fg: "#F9FAFB", muted: "#D1D5DB" } : { bg: "#FFFFFF", fg: "#111827", muted: "#374151" };
  const today = localDate();
  const periodHistory = useQuery(loggingApi.history.getPeriodHistory, online ? {} : "skip");
  const painHistory = useQuery(loggingApi.history.getPainHistory, online ? { startDate: dateDaysAgo(365), endDate: today } : "skip");
  const startSelf = useMutation(loggingApi.periods.logPeriodStart);
  const endSelf = useMutation(loggingApi.periods.logPeriodEnd);
  const startAssist = useMutation(loggingApi.periods.assistLogPeriodStart);
  const endAssist = useMutation(loggingApi.periods.assistLogPeriodEnd);
  const updateSelf = useMutation(loggingApi.periods.updatePeriodEvent);
  const updateAssist = useMutation(loggingApi.periods.correctAssistedPeriodEvent);
  const savePain = useMutation(loggingApi.painLog.createOrUpdatePainLog);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [painDate, setPainDate] = useState(today);
  const [certainty, setCertainty] = useState<"exact" | "approximate">("exact");
  const [painScore, setPainScore] = useState("0");
  const [painTags, setPainTags] = useState<Array<"cramps" | "headache" | "back" | "fatigue" | "other">>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const openPeriod = useMemo(() => periodHistory?.find((item) => !item.endDate && item._id), [periodHistory]);
  const disabled = !online || busy;

  const run = async (work: () => Promise<unknown>, success: string) => {
    setError(""); setSaved(""); setBusy(true);
    try { await work(); setSaved(success); }
    catch (failure) { setError(loggingErrorMessage(failure)); }
    finally { setBusy(false); }
  };

  const savePeriod = () => run(async () => {
    if (!online) throw new Error("offline");
    if (openPeriod?._id) {
      const args = { endDate: startDate, endCertainty: certainty, periodEventId: openPeriod._id, ...(openPeriod.authorityVersion !== undefined ? { expectedAuthorityVersion: openPeriod.authorityVersion } : {}) };
      await (role === "partner" ? endAssist(args) : endSelf(args));
      return;
    }
    const started = await (role === "partner"
      ? startAssist({ startDate, startCertainty: certainty })
      : startSelf({ startDate, startCertainty: certainty }));
    if (endDate) {
      try {
        const args = { endDate, endCertainty: certainty, periodEventId: started.eventId, expectedAuthorityVersion: 1 };
        await (role === "partner" ? endAssist(args) : endSelf(args));
      } catch {
        throw new Error("START_SAVED_END_FAILED");
      }
    }
  }, periodSuccessMessage(Boolean(openPeriod), Boolean(endDate)));

  const savePainEntry = () => run(async () => {
    if (!online) throw new Error("offline");
    const score = Number(painScore);
    if (!Number.isInteger(score) || score < 0 || score > 10) throw new Error("invalid pain score");
    await savePain({ date: painDate, painScore: score, tags: painTags, ...(note ? { note } : {}) });
  }, "Pain entry saved.");

  const correct = (period: NonNullable<typeof periodHistory>[number]) => run(async () => {
    if (!period._id || !period.canCorrect || period.authorityVersion === undefined) throw new Error("not authorized");
    const args = { periodEventId: period._id, startDate: editStartDate, ...(editEndDate ? { endDate: editEndDate, endCertainty: certainty } : {}), expectedAuthorityVersion: period.authorityVersion };
    if (role === "partner") await updateAssist({ ...args, expectedAuthorityVersion: period.authorityVersion! });
    else await updateSelf(args);
    setEditing(null);
  }, "Period correction saved.");

  return <ScrollView contentContainerStyle={styles.content} style={{ backgroundColor: palette.bg }}>
    <Text accessibilityRole="header" style={[styles.title, { color: palette.fg }]}>Log and history</Text>
    {!online ? <Text accessibilityRole="alert" style={[styles.notice, { color: palette.fg }]}>Offline. Nothing can be saved until your connection returns.</Text> : null}
    <Text accessibilityRole="header" style={[styles.heading, { color: palette.fg }]}>{openPeriod ? "Confirm period end" : "Period start"}</Text>
    <TextInput accessibilityLabel={openPeriod ? "Period end date, YYYY-MM-DD" : "Period start date, YYYY-MM-DD"} value={startDate} onChangeText={setStartDate} autoCapitalize="none" style={styles.input} />
    {!openPeriod ? <TextInput accessibilityLabel="Optional period end date, YYYY-MM-DD" value={endDate} onChangeText={setEndDate} placeholder="Leave blank to keep it open" style={styles.input} /> : null}
    <View style={styles.row}><Action label="Exact date" disabled={disabled} onPress={() => setCertainty("exact")} /><Action label="Approximate date" disabled={disabled} onPress={() => setCertainty("approximate")} /></View>
    <Text accessibilityLabel={`Selected certainty: ${certainty}`} style={{ color: palette.muted }}>Selected: {certainty}</Text>
    <Action label={openPeriod ? "Confirm end" : "Save period"} disabled={disabled} onPress={savePeriod} />

    {role === "primary" ? <>
      <Text accessibilityRole="header" style={[styles.heading, { color: palette.fg }]}>Pain log</Text>
      <Text style={{ color: palette.muted }}>Score 0–10</Text>
      <TextInput accessibilityLabel="Pain log date, YYYY-MM-DD" value={painDate} onChangeText={setPainDate} style={styles.input} />
      <TextInput accessibilityLabel="Pain score from 0 to 10" keyboardType="number-pad" value={painScore} onChangeText={setPainScore} style={styles.input} />
      <Text style={{ color: palette.muted }}>Pain tags</Text>
      <View style={styles.row}>{(["cramps", "headache", "back", "fatigue", "other"] as const).map((tag) => <Pressable key={tag} accessibilityRole="button" accessibilityLabel={`${painTags.includes(tag) ? "Remove" : "Add"} ${tag} pain tag`} accessibilityState={{ selected: painTags.includes(tag) }} onPress={() => setPainTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])} style={[styles.button, !painTags.includes(tag) && styles.unselected]}><Text style={styles.buttonText}>{tag}</Text></Pressable>)}</View>
      <TextInput accessibilityLabel="Private pain note, optional" maxLength={140} value={note} onChangeText={setNote} placeholder="Optional note (140 characters max)" style={styles.input} />
      <Action label="Save pain log" disabled={disabled} onPress={savePainEntry} />
    </> : null}

    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {saved ? <Text accessibilityRole="alert" style={styles.success}>{saved}</Text> : null}

    <Text accessibilityRole="header" style={[styles.heading, { color: palette.fg }]}>Period history</Text>
    {periodHistory === undefined ? <Text style={{ color: palette.muted }}>Loading period history…</Text> : null}
    {periodHistory?.length === 0 ? <Text style={{ color: palette.muted }}>No period history recorded yet.</Text> : null}
    {periodHistory?.map((period) => <View key={period._id ?? period.startDate} style={styles.card}>
      <Text style={{ color: palette.fg }}>{period.startDate}{period.endDate ? ` – ${period.endDate}` : " – ongoing"}</Text>
      <Text style={{ color: palette.muted }}>{period.certainty} · {period.source === "partner_assist" ? `assisted by ${period.createdByName}` : period.source === "self" ? "self logged" : "legacy record"}{period.confirmationStatus === "unreviewed" ? " · needs review" : " · accepted"}</Text>
      {period.canCorrect && period._id && period.authorityVersion !== undefined ? editing === period._id ? <>
        <TextInput accessibilityLabel="Corrected period start date, YYYY-MM-DD" value={editStartDate} onChangeText={setEditStartDate} style={styles.input} />
        <TextInput accessibilityLabel="Corrected period end date, YYYY-MM-DD" value={editEndDate} onChangeText={setEditEndDate} placeholder="End date (blank means open)" style={styles.input} />
        <Action label="Save correction" disabled={disabled} onPress={() => correct(period)} />
        <Action label="Cancel correction" disabled={busy} onPress={() => setEditing(null)} />
      </> : <Action label="Correct period" disabled={disabled} onPress={() => { setEditing(period._id!); setEditStartDate(period.startDate); setEditEndDate(period.endDate ?? ""); }} /> : null}
    </View>)}
    <Text accessibilityRole="header" style={[styles.heading, { color: palette.fg }]}>Pain history</Text>
    {painHistory === undefined ? <Text style={{ color: palette.muted }}>Loading pain history…</Text> : null}
    {painHistory?.length === 0 ? <Text style={{ color: palette.muted }}>No pain history recorded in this range.</Text> : null}
    {painHistory?.slice(-30).reverse().map((pain) => <View key={pain._id} style={styles.card}><Text style={{ color: palette.fg }}>{pain.date} · pain {pain.painScore}/10</Text><Text style={{ color: palette.muted }}>{pain.tags.join(", ") || "No tags"}</Text></View>)}
  </ScrollView>;
}

const styles = StyleSheet.create({ content: { padding: 20, gap: 12 }, title: { fontSize: 24, fontWeight: "700" }, heading: { fontSize: 18, fontWeight: "700", marginTop: 16 }, input: { minHeight: 48, borderWidth: 1, borderColor: "#6B7280", borderRadius: 8, padding: 12, color: "#111827", backgroundColor: "#FFFFFF" }, row: { flexDirection: "row", gap: 8, flexWrap: "wrap" }, button: { minHeight: 48, paddingHorizontal: 14, justifyContent: "center", backgroundColor: "#374151", borderRadius: 8 }, unselected: { backgroundColor: "#6B7280" }, buttonText: { color: "#FFFFFF", fontWeight: "600" }, disabled: { opacity: 0.45 }, notice: { padding: 12, backgroundColor: "#713F12", color: "#FFFFFF", borderRadius: 8 }, error: { color: "#991B1B", fontWeight: "600" }, success: { color: "#166534", fontWeight: "600" }, card: { borderWidth: 1, borderColor: "#9CA3AF", borderRadius: 8, padding: 12, gap: 8 } });
