import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { mobileColors } from "../../theme/tokens";
import { bloomType } from "../../theme/typography";
import { BloomText as Text } from "../../components/BloomText";
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
  const current = useRef({ disabled, onChange });
  useLayoutEffect(() => {
    current.current = { disabled, onChange };
    if (disabled) setOpen(false);
  }, [disabled, onChange]);
  useEffect(() => {
    if (!open || Platform.OS !== "android") return;
    return () => { void DateTimePickerAndroid.dismiss("date").catch(() => {}); };
  }, [open]);
  const pickerValue = parseDateOnly(value) ?? parseDateOnly(maximumDate ?? "") ?? new Date();
  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (!current.current.disabled && event.type === "set" && date) current.current.onChange(formatLocalDateOnly(date));
    if (Platform.OS === "android" || event.type !== "set") setOpen(false);
  };
  const openPicker = () => {
    if (current.current.disabled) return;
    setOpen(true);
    if (Platform.OS === "android") {
      // Open once per press. The declarative Android bridge reopens on callback
      // changes, which can reset an unconfirmed selection during a parent render.
      DateTimePickerAndroid.open({
        mode: "date",
        value: pickerValue,
        maximumDate: parseDateOnly(maximumDate ?? "") ?? undefined,
        minimumDate: parseDateOnly(minimumDate ?? "") ?? undefined,
        onChange: handleChange,
        onError: () => setOpen(false),
      });
    }
  };

  return (
    <View style={styles.container}>
      <Text allowFontScaling accessibilityRole="text" style={[bloomType.label, { color: palette.muted }]}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value || placeholder}`}
          disabled={disabled}
          onPress={openPicker}
          style={[styles.control, { backgroundColor: palette.surface, borderColor: palette.controlBorder }]}
        >
          <Text allowFontScaling style={[bloomType.body, { color: palette.foreground }]}>{value || placeholder}</Text>
          <Text allowFontScaling style={[bloomType.caption, { color: palette.muted }]}>Choose date</Text>
        </Pressable>
        {clearable && value ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${label}`} disabled={disabled} onPress={() => onChange("")} style={styles.clear}>
            <Text allowFontScaling style={[bloomType.button, { color: palette.accent }]}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      {open && !disabled && Platform.OS !== "android" ? (
        <View style={Platform.OS === "ios" ? [styles.iosPicker, { backgroundColor: palette.glass, borderColor: palette.controlBorder }] : undefined}>
          <DateTimePicker
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            value={pickerValue}
            maximumDate={parseDateOnly(maximumDate ?? "") ?? undefined}
            minimumDate={parseDateOnly(minimumDate ?? "") ?? undefined}
            onChange={handleChange}
          />
          {Platform.OS === "ios" ? (
            <Pressable accessibilityRole="button" onPress={() => {
              if (!current.current.disabled) current.current.onChange(formatLocalDateOnly(pickerValue));
              setOpen(false);
            }} style={styles.done}>
              <Text allowFontScaling style={[bloomType.button, { color: palette.accent }]}>Done</Text>
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
  control: { minHeight: 56, flex: 1, justifyContent: "center", gap: 2, borderWidth: 1, borderRadius: 18, paddingHorizontal: 16 },
  clear: { minHeight: 48, justifyContent: "center", paddingHorizontal: 8 },
  iosPicker: { borderWidth: 1, borderRadius: 18, overflow: "hidden", paddingBottom: 8 },
  done: { minHeight: 48, alignItems: "flex-end", justifyContent: "center", paddingHorizontal: 16 },
});
