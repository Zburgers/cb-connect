import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { mobileColors } from "../../theme/tokens";
import { formatLocalDateOnly, parseDateOnly } from "./dateOnly";

type DateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  palette: typeof mobileColors.light | typeof mobileColors.dark;
  disabled?: boolean;
  placeholder?: string;
  maximumDate?: string;
  minimumDate?: string;
  clearable?: boolean;
};

export function DateField({
  label,
  value,
  onChange,
  palette,
  disabled = false,
  placeholder = "Choose a date",
  maximumDate,
  minimumDate,
  clearable = false,
}: DateFieldProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const pickerValue = parseDateOnly(value) ?? parseDateOnly(maximumDate ?? "") ?? new Date();
  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === "set" && date) onChange(formatLocalDateOnly(date));
    if (Platform.OS === "android" || event.type !== "set") setOpen(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value || placeholder}`}
          disabled={disabled}
          onPress={() => setOpen(true)}
          style={[styles.control, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <Text style={{ color: palette.foreground, fontSize: 16 }}>{value || placeholder}</Text>
          <Text style={{ color: palette.muted, fontSize: 14 }}>Choose date</Text>
        </Pressable>
        {clearable && value ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${label}`} disabled={disabled} onPress={() => onChange("")} style={styles.clear}>
            <Text style={{ color: palette.accent, fontWeight: "600" }}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      {open ? (
        <View style={Platform.OS === "ios" ? [styles.iosPicker, { backgroundColor: palette.glass, borderColor: palette.border }] : undefined}>
          <DateTimePicker
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            value={pickerValue}
            maximumDate={parseDateOnly(maximumDate ?? "") ?? undefined}
            minimumDate={parseDateOnly(minimumDate ?? "") ?? undefined}
            onChange={handleChange}
          />
          {Platform.OS === "ios" ? (
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.done}>
              <Text style={{ color: palette.accent, fontWeight: "700" }}>Done</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  control: { minHeight: 56, flex: 1, justifyContent: "center", gap: 2, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16 },
  clear: { minHeight: 48, justifyContent: "center", paddingHorizontal: 8 },
  iosPicker: { borderWidth: 1, borderRadius: 18, overflow: "hidden", paddingBottom: 8 },
  done: { minHeight: 48, alignItems: "flex-end", justifyContent: "center", paddingHorizontal: 16 },
});
