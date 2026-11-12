import { useEffect, useState } from "react";
import { useConvexConnectionState, useMutation, useQuery } from "convex/react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../../convex/api";
import { mobileColors } from "../../theme/tokens";
import { isValidTimeZone, localDate } from "../logging/logging";
import type { PainTag } from "../cycle/CycleDashboardModel";
import { PAIN_NOTE_PRIVACY_COPY } from "./HomeModel";

const TAGS = [
  ["cramps", "Cramps"],
  ["headache", "Head pressure"],
  ["back", "Back ache"],
  ["fatigue", "Low energy"],
  ["other", "Something else"],
] as const;

const FEELINGS = [
  { label: "Clear", help: "Body feels mostly okay", score: 0 },
  { label: "Tender", help: "Noticeable but manageable", score: 3 },
  { label: "Heavy", help: "Needs a softer day", score: 6 },
  { label: "Rough", help: "Needs active care", score: 8 },
] as const;

type CurrentPain = {
  score: number;
  tags?: readonly PainTag[];
  note?: string;
} | null;

type PainHistoryRow = {
  date: string;
  painScore: number;
  tags?: readonly PainTag[];
  note?: string;
};

export function getPainCheckInSubmission(input: {
  sourceDate: string;
  currentDate: string;
  timeZone: string;
  score: number;
  tags: readonly PainTag[];
  note: string;
}):
  | { kind: "refresh"; date: string }
  | {
      kind: "save";
      args: {
        date: string;
        timeZone: string;
        painScore: number;
        tags: PainTag[];
        note?: string;
      };
    } {
  if (input.sourceDate !== input.currentDate) {
    return { kind: "refresh", date: input.currentDate };
  }
  return {
    kind: "save",
    args: {
      date: input.currentDate,
      timeZone: input.timeZone,
      painScore: input.score,
      tags: [...input.tags],
      ...(input.note ? { note: input.note } : {}),
    },
  };
}

function feelingLabel(score: number): string {
  if (score <= 1) return "Clear";
  if (score <= 4) return "Tender";
  if (score <= 7) return "Heavy";
  return "Rough";
}

export function HomePainCheckIn({
  dark,
}: {
  dark: boolean;
}): React.JSX.Element {
  const palette = dark ? mobileColors.dark : mobileColors.light;
  const online = useConvexConnectionState().isWebSocketConnected;
  const account = useQuery(api.queries.users.getMe, online ? {} : "skip");
  const [draftDate, setDraftDate] = useState<string | null>(null);
  const [dateChanged, setDateChanged] = useState(false);
  const timeZone = account?.timeZone;
  const today = isValidTimeZone(timeZone) ? localDate(new Date(), timeZone) : null;
  const sourceDate = draftDate ?? today;
  const painHistory = useQuery(
    api.queries.history.getPainHistory,
    online && sourceDate && isValidTimeZone(timeZone)
      ? { startDate: sourceDate, endDate: sourceDate }
      : "skip",
  ) as readonly PainHistoryRow[] | undefined;
  const record = painHistory?.find((row) => row.date === sourceDate);

  if (!online) {
    return (
      <View style={[styles.card, { backgroundColor: palette.glass, borderColor: palette.border }]}>
        <Text style={{ color: palette.muted }}>Offline. Nothing can be saved until your connection returns.</Text>
      </View>
    );
  }
  if (account === undefined) {
    return (
      <View style={[styles.card, { backgroundColor: palette.glass, borderColor: palette.border }]}>
        <Text style={{ color: palette.muted }}>Checking your account timezone…</Text>
      </View>
    );
  }
  if (!isValidTimeZone(timeZone)) {
    return (
      <View style={[styles.card, { backgroundColor: palette.glass, borderColor: palette.border }]}>
        <Text style={{ color: palette.muted }}>Account timezone is unavailable. Add it in Settings before saving.</Text>
      </View>
    );
  }
  if (!sourceDate || painHistory === undefined) {
    return (
      <View style={[styles.card, { backgroundColor: palette.glass, borderColor: palette.border }]}>
        <Text style={{ color: palette.muted }}>Loading today’s check-in…</Text>
      </View>
    );
  }

  return (
    <PainCheckInForm
      key={sourceDate}
      currentPain={record ? { score: record.painScore, tags: record.tags, note: record.note } : null}
      dark={dark}
      online={online}
      timeZone={timeZone}
      sourceDate={sourceDate}
      dateChanged={dateChanged}
      onDateRollover={(date) => {
        setDraftDate(date);
        setDateChanged(true);
      }}
    />
  );
}

function PainCheckInForm({
  currentPain,
  dark,
  online,
  timeZone,
  sourceDate,
  dateChanged,
  onDateRollover,
}: {
  currentPain: CurrentPain;
  dark: boolean;
  online: boolean;
  timeZone: string;
  sourceDate: string;
  dateChanged: boolean;
  onDateRollover: (date: string) => void;
}): React.JSX.Element {
  const palette = dark ? mobileColors.dark : mobileColors.light;
  const savePain = useMutation(api.mutations.painLog.createOrUpdatePainLog);
  const [score, setScore] = useState(currentPain?.score ?? 0);
  const [tags, setTags] = useState<PainTag[]>([
    ...(currentPain?.tags ?? []),
  ]);
  const [note, setNote] = useState(currentPain?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setScore(currentPain?.score ?? 0);
    setTags([...(currentPain?.tags ?? [])]);
    setNote(currentPain?.note ?? "");
  }, [currentPain]);

  async function submit() {
    if (!online || !isValidTimeZone(timeZone) || busy) return;
    const date = localDate(new Date(), timeZone);
    const submission = getPainCheckInSubmission({
      sourceDate,
      currentDate: date,
      timeZone,
      score,
      tags,
      note,
    });
    if (submission.kind === "refresh") {
      setSaved(false);
      setError(null);
      onDateRollover(submission.date);
      return;
    }
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      await savePain(submission.args);
      setSaved(true);
    } catch {
      setError("Could not save this check-in. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.glass, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.eyebrow, { color: palette.muted }]}>Body check-in</Text>
      <Text accessibilityRole="header" style={[styles.title, { color: palette.foreground }]}>
        How does today feel?
      </Text>
      <Text style={{ color: palette.muted }}>
        Choose the closest feeling first. The number stays here for accuracy, not as the main story.
      </Text>

      <View style={styles.grid}>
        {FEELINGS.map((feeling) => {
          const selected = feelingLabel(score) === feeling.label;
          return (
            <Pressable
              key={feeling.label}
              accessibilityRole="button"
              accessibilityLabel={`${feeling.label}: ${feeling.help}`}
              accessibilityState={{ selected }}
              onPress={() => setScore(feeling.score)}
              style={[
                styles.feeling,
                {
                  backgroundColor: selected ? palette.accent : palette.surface,
                  borderColor: selected ? palette.accent : palette.border,
                },
              ]}
            >
              <Text style={{ color: selected ? palette.surface : palette.foreground, fontWeight: "700" }}>
                {feeling.label}
              </Text>
              <Text style={{ color: selected ? palette.surface : palette.muted, fontSize: 12 }}>
                {feeling.help}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.intensityRow}>
        <View style={styles.flex}>
          <Text style={{ color: palette.foreground, fontWeight: "700" }}>Fine tune intensity</Text>
          <Text style={{ color: palette.muted }}>Saved as {score}/10 for your history.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Decrease pain intensity"
          accessibilityState={{ disabled: score <= 0 }}
          disabled={score <= 0}
          onPress={() => setScore((value) => Math.max(0, value - 1))}
          style={[styles.stepper, { backgroundColor: palette.highlight, borderColor: palette.border }]}
        >
          <Text style={{ color: palette.foreground }}>−</Text>
        </Pressable>
        <Text accessibilityLabel={`Pain intensity ${score} out of 10`} style={[styles.score, { color: palette.foreground }]}>
          {score}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Increase pain intensity"
          accessibilityState={{ disabled: score >= 10 }}
          disabled={score >= 10}
          onPress={() => setScore((value) => Math.min(10, value + 1))}
          style={[styles.stepper, { backgroundColor: palette.highlight, borderColor: palette.border }]}
        >
          <Text style={{ color: palette.foreground }}>+</Text>
        </Pressable>
      </View>

      <Text style={{ color: palette.foreground, fontWeight: "700" }}>
        What is asking for attention?
      </Text>
      <View style={styles.grid}>
        {TAGS.map(([value, label]) => {
          const selected = tags.includes(value);
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={`${selected ? "Remove" : "Add"} ${label}`}
              accessibilityState={{ selected }}
              onPress={() => setTags((current) => selected ? current.filter((tag) => tag !== value) : [...current, value])}
              style={[
                styles.tag,
                {
                  backgroundColor: selected ? palette.highlight : palette.surface,
                  borderColor: palette.border,
                },
              ]}
            >
              <Text style={{ color: palette.foreground }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={{ color: palette.foreground, fontWeight: "700" }}>
        Private note for your own history
      </Text>
      <Text style={{ color: palette.muted }}>{PAIN_NOTE_PRIVACY_COPY}</Text>
      <TextInput
        accessibilityLabel="Pain note, optional"
        maxLength={140}
        multiline
        onChangeText={setNote}
        placeholder="What would help you remember today?"
        placeholderTextColor={palette.muted}
        style={[styles.note, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.foreground }]}
        value={note}
      />
      <Text style={[styles.counter, { color: palette.muted }]}>{note.length}/140</Text>
      {!online ? (
        <Text style={{ color: palette.muted }}>
          Offline. Nothing can be saved until your connection returns.
        </Text>
      ) : null}
      {dateChanged ? (
        <Text accessibilityLiveRegion="polite" style={{ color: palette.foreground }}>
          The date changed. Today’s check-in is ready. Review it before saving.
        </Text>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={{ color: palette.foreground }}>{error}</Text> : null}
      {saved ? <Text accessibilityLiveRegion="polite" style={{ color: palette.foreground }}>Check-in saved.</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={busy ? "Saving check-in" : "Save today’s signal"}
        accessibilityState={{ disabled: busy || !online }}
        disabled={busy || !online}
        onPress={() => void submit()}
        style={[styles.save, { backgroundColor: palette.foreground, opacity: busy || !online ? 0.55 : 1 }]}
      >
        <Text style={{ color: palette.background, fontWeight: "700" }}>
          {busy ? "Saving…" : saved ? "Check-in saved" : "Save today’s signal"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 24, padding: 20, gap: 14 },
  eyebrow: { fontSize: 12, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase" },
  title: { fontSize: 26, lineHeight: 32, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  feeling: { minWidth: "47%", flexGrow: 1, borderRadius: 20, borderWidth: 1, padding: 14, gap: 5 },
  intensityRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  flex: { flex: 1 },
  stepper: { minWidth: 44, minHeight: 44, borderWidth: 1, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  score: { minWidth: 30, textAlign: "center", fontSize: 26, fontWeight: "700" },
  tag: { minHeight: 44, paddingHorizontal: 14, borderWidth: 1, borderRadius: 22, justifyContent: "center" },
  note: { minHeight: 80, borderWidth: 1, borderRadius: 20, padding: 12, textAlignVertical: "top" },
  counter: { alignSelf: "flex-end", marginTop: -10, fontSize: 12 },
  save: { minHeight: 50, borderRadius: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
});
