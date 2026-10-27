import { useContext, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useColorScheme, View } from "react-native";
import { useConvexConnectionState, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/api";
import { loggingApi } from "./loggingApi";
import { AccessContext } from "../../navigation/accessContext";
import { mobileColors } from "../../theme/tokens";
import { dateDaysAgo, isValidTimeZone, localDate, loggingErrorMessage, periodSuccessMessage } from "./logging";
import { DateField } from "./DateField";

function Action({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}

export function LoggingScreen() {
  const access = useContext(AccessContext);
  const role = access === "partner" ? "partner" : "primary";
  const online = useConvexConnectionState().isWebSocketConnected;
  const account = useQuery(api.queries.users.getMe, online ? {} : "skip");
  const palette = mobileColors[useColorScheme() === "dark" ? "dark" : "light"];
  const timeZone = account?.timeZone;
  const now = new Date();
  const today = online && isValidTimeZone(timeZone) ? localDate(now, timeZone) : null;
  const dateContextReady = today !== null;
  const periodHistory = useQuery(loggingApi.history.getPeriodHistory, online ? {} : "skip");
  const painHistory = useQuery(loggingApi.history.getPainHistory, online && role === "primary" && today && timeZone
    ? { startDate: dateDaysAgo(365, now, timeZone), endDate: today }
    : "skip");
  const startSelf = useMutation(loggingApi.periods.logPeriodStart);
  const endSelf = useMutation(loggingApi.periods.logPeriodEnd);
  const startAssist = useMutation(loggingApi.periods.assistLogPeriodStart);
  const endAssist = useMutation(loggingApi.periods.assistLogPeriodEnd);
  const updateSelf = useMutation(loggingApi.periods.updatePeriodEvent);
  const updateAssist = useMutation(loggingApi.periods.correctAssistedPeriodEvent);
  const savePain = useMutation(loggingApi.painLog.createOrUpdatePainLog);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState("");
  const [painDate, setPainDate] = useState<string | null>(null);
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
  const periodWritesReady = dateContextReady && periodHistory !== undefined;
  const painWritesReady = dateContextReady && painHistory !== undefined;
  const disabledPeriod = !periodWritesReady || busy;
  const disabledPain = !painWritesReady || busy;
  const selectedStartDate = startDate ?? (role === "partner" ? "" : today ?? "");
  const selectedPainDate = painDate ?? today ?? "";

  const run = async (work: () => Promise<unknown>, success: string) => {
    setError(""); setSaved(""); setBusy(true);
    try { await work(); setSaved(success); }
    catch (failure) { setError(loggingErrorMessage(failure)); }
    finally { setBusy(false); }
  };

  const savePeriod = () => run(async () => {
    if (!online) throw new Error("offline");
    if (!periodWritesReady) throw new Error("DATE_CONTEXT_UNAVAILABLE");
    if (!selectedStartDate.trim()) throw new Error("DATE_SELECTION_REQUIRED");
    if (openPeriod?._id) {
      const args = { endDate: selectedStartDate, endCertainty: certainty, periodEventId: openPeriod._id, ...(openPeriod.authorityVersion !== undefined ? { expectedAuthorityVersion: openPeriod.authorityVersion } : {}) };
      await (role === "partner" ? endAssist(args) : endSelf(args));
      return;
    }
    const started = await (role === "partner"
      ? startAssist({ startDate: selectedStartDate, startCertainty: certainty })
      : startSelf({ startDate: selectedStartDate, startCertainty: certainty }));
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
    if (!painWritesReady) throw new Error("DATE_CONTEXT_UNAVAILABLE");
    const score = Number(painScore);
    if (!Number.isInteger(score) || score < 0 || score > 10) throw new Error("invalid pain score");
    await savePain({ date: selectedPainDate, painScore: score, tags: painTags, ...(note ? { note } : {}) });
  }, "Pain entry saved.");

  const correct = (period: NonNullable<typeof periodHistory>[number]) => run(async () => {
    if (!periodWritesReady) throw new Error("DATE_CONTEXT_UNAVAILABLE");
    if (!period._id || !period.canCorrect || period.authorityVersion === undefined) throw new Error("not authorized");
    const args = { periodEventId: period._id, startDate: editStartDate, ...(editEndDate ? { endDate: editEndDate, endCertainty: certainty } : {}), expectedAuthorityVersion: period.authorityVersion };
    if (role === "partner") await updateAssist({ ...args, expectedAuthorityVersion: period.authorityVersion! });
    else await updateSelf(args);
    setEditing(null);
  }, "Period correction saved.");

  return <ScrollView contentContainerStyle={styles.content} style={{ backgroundColor: "transparent" }}>
    <Text accessibilityRole="header" style={[styles.title, { color: palette.foreground }]}>Log and history</Text>
    {!online ? <Text accessibilityRole="alert" style={[styles.notice, { color: palette.noticeForeground, backgroundColor: palette.noticeBackground }]}>Offline. Nothing can be saved until your connection returns.</Text> : null}
    {online && account === undefined ? <Text style={{ color: palette.muted }}>Loading account timezone…</Text> : null}
    {online && account !== undefined && !isValidTimeZone(timeZone) ? <Text accessibilityRole="alert" style={[styles.notice, { color: palette.noticeForeground, backgroundColor: palette.noticeBackground }]}>Account timezone is unavailable. Update it in Settings before logging.</Text> : null}
    <Text accessibilityRole="header" style={[styles.heading, { color: palette.foreground }]}>{openPeriod ? "Confirm period end" : "Period start"}</Text>
    <Text style={{ color: palette.muted }}>{openPeriod ? "Choose when your period ended." : "Add the first day of bleeding. Leave the end date blank if it has not ended."}</Text>
    {role === "partner" ? <Text style={{ color: palette.muted }}>Select the date in the primary user’s calendar.</Text> : null}
    <Text style={{ color: palette.foreground }}>{openPeriod ? "End date" : "Start date"}</Text>
    <DateField label={openPeriod ? "Period end date" : "Period start date"} value={selectedStartDate} onChange={setStartDate} palette={palette} disabled={disabledPeriod} maximumDate={today ?? undefined} minimumDate={openPeriod?.startDate} />
    {role === "primary" && today && timeZone ? <View style={styles.row}><Action label="Today" disabled={disabledPeriod} onPress={() => setStartDate(today)} /><Action label="Yesterday" disabled={disabledPeriod} onPress={() => setStartDate(dateDaysAgo(1, now, timeZone))} /></View> : null}
    {!openPeriod ? <><Text style={{ color: palette.foreground }}>End date (optional)</Text><DateField label="Optional period end date" value={endDate} onChange={setEndDate} palette={palette} disabled={disabledPeriod} placeholder="Leave blank to keep it open" maximumDate={today ?? undefined} minimumDate={selectedStartDate || undefined} clearable /></> : null}
    <View style={styles.row}><Action label="Exact date" disabled={disabledPeriod} onPress={() => setCertainty("exact")} /><Action label="Approximate date" disabled={disabledPeriod} onPress={() => setCertainty("approximate")} /></View>
    <Text accessibilityLabel={`Selected certainty: ${certainty}`} style={{ color: palette.muted }}>Selected: {certainty}</Text>
    <Action label={openPeriod ? "Confirm end" : "Save period"} disabled={disabledPeriod || !selectedStartDate.trim()} onPress={savePeriod} />

    {role === "primary" ? <>
      <Text accessibilityRole="header" style={[styles.heading, { color: palette.foreground }]}>Pain log</Text>
      <Text style={{ color: palette.muted }}>Rate your pain from 0 (none) to 10 (worst).</Text>
      <Text style={{ color: palette.foreground }}>Date</Text>
      <DateField label="Pain log date" value={selectedPainDate} onChange={setPainDate} palette={palette} disabled={disabledPain} maximumDate={today ?? undefined} />
      <Text style={{ color: palette.foreground }}>Pain score</Text>
      <TextInput accessibilityLabel="Pain score from 0 to 10" keyboardType="number-pad" value={painScore} onChangeText={setPainScore} style={[styles.input, { color: palette.foreground, backgroundColor: palette.surface, borderColor: palette.border }]} />
      <View style={styles.row}>
        <Action label="Less pain" disabled={disabledPain || !/^\d+$/.test(painScore) || Number(painScore) <= 0 || Number(painScore) > 10} onPress={() => setPainScore(String(Number(painScore) - 1))} />
        <Action label="More pain" disabled={disabledPain || !/^\d+$/.test(painScore) || Number(painScore) >= 10} onPress={() => setPainScore(String(Number(painScore) + 1))} />
      </View>
      <Text style={{ color: palette.muted }}>Pain tags</Text>
      <View style={styles.row}>{(["cramps", "headache", "back", "fatigue", "other"] as const).map((tag) => <Pressable key={tag} accessibilityRole="button" accessibilityLabel={`${painTags.includes(tag) ? "Remove" : "Add"} ${tag} pain tag`} accessibilityState={{ selected: painTags.includes(tag) }} onPress={() => setPainTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])} style={[styles.button, { backgroundColor: painTags.includes(tag) ? palette.accent : palette.surface, borderColor: palette.border, borderWidth: 1 }]}><Text style={[styles.buttonText, { color: painTags.includes(tag) ? palette.surface : palette.foreground }]}>{tag}</Text></Pressable>)}</View>
      <Text style={{ color: palette.foreground }}>Private note (optional)</Text>
      <TextInput accessibilityLabel="Private pain note, optional" maxLength={140} value={note} onChangeText={setNote} placeholder="Up to 140 characters" placeholderTextColor={palette.muted} style={[styles.input, { color: palette.foreground, backgroundColor: palette.surface, borderColor: palette.border }]} />
      <Action label="Save pain log" disabled={disabledPain || !selectedPainDate.trim()} onPress={savePainEntry} />
    </> : null}

    {error ? <Text accessibilityRole="alert" style={[styles.error, { color: palette.foreground }]}>{error}</Text> : null}
    {saved ? <Text accessibilityRole="alert" style={[styles.success, { color: palette.foreground }]}>{saved}</Text> : null}

    <Text accessibilityRole="header" style={[styles.heading, { color: palette.foreground }]}>Period history</Text>
    {periodHistory === undefined ? <Text style={{ color: palette.muted }}>Loading period history…</Text> : null}
    {periodHistory?.length === 0 ? <Text style={{ color: palette.muted }}>No period history recorded yet.</Text> : null}
    {periodHistory?.map((period) => <View key={period._id ?? period.startDate} style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Text style={{ color: palette.foreground }}>{period.startDate}{period.endDate ? ` – ${period.endDate}` : " – ongoing"}</Text>
      <Text style={{ color: palette.muted }}>{period.certainty} · {period.source === "partner_assist" ? `assisted by ${period.createdByName}` : period.source === "self" ? "self logged" : "legacy record"}{period.confirmationStatus === "unreviewed" ? " · needs review" : " · accepted"}</Text>
      {period.canCorrect && period._id && period.authorityVersion !== undefined ? editing === period._id ? <>
        <DateField label="Corrected period start date" value={editStartDate} onChange={setEditStartDate} palette={palette} disabled={disabledPeriod} maximumDate={today ?? undefined} />
        <DateField label="Corrected period end date" value={editEndDate} onChange={setEditEndDate} palette={palette} disabled={disabledPeriod} placeholder="End date (blank means open)" maximumDate={today ?? undefined} minimumDate={editStartDate || undefined} clearable />
        <Action label="Save correction" disabled={disabledPeriod} onPress={() => correct(period)} />
        <Action label="Cancel correction" disabled={busy} onPress={() => setEditing(null)} />
      </> : <Action label="Correct period" disabled={disabledPeriod} onPress={() => { setEditing(period._id!); setEditStartDate(period.startDate); setEditEndDate(period.endDate ?? ""); }} /> : null}
    </View>)}
    {role === "primary" ? <>
    <Text accessibilityRole="header" style={[styles.heading, { color: palette.foreground }]}>Pain history</Text>
    {painHistory === undefined ? <Text style={{ color: palette.muted }}>Loading pain history…</Text> : null}
    {painHistory?.length === 0 ? <Text style={{ color: palette.muted }}>No pain history recorded in this range.</Text> : null}
    {painHistory?.slice(-30).reverse().map((pain) => <View key={pain._id} style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}><Text style={{ color: palette.foreground }}>{pain.date} · pain {pain.painScore}/10</Text><Text style={{ color: palette.muted }}>{pain.tags.join(", ") || "No tags"}</Text></View>)}
    </> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({ content: { padding: 20, gap: 12 }, title: { fontSize: 24, fontWeight: "700" }, heading: { fontSize: 18, fontWeight: "700", marginTop: 16 }, input: { minHeight: 48, borderWidth: 1, borderRadius: 8, padding: 12 }, row: { flexDirection: "row", gap: 8, flexWrap: "wrap" }, button: { minHeight: 48, paddingHorizontal: 14, justifyContent: "center", backgroundColor: "#374151", borderRadius: 8 }, unselected: { backgroundColor: "transparent" }, buttonText: { color: "#FFFFFF", fontWeight: "600" }, disabled: { opacity: 0.45 }, notice: { padding: 12, backgroundColor: "#713F12", color: "#FFFFFF", borderRadius: 8 }, error: { color: "#991B1B", fontWeight: "600" }, success: { color: "#166534", fontWeight: "600" }, card: { borderWidth: 1, borderColor: "#9CA3AF", borderRadius: 8, padding: 12, gap: 8 } });
