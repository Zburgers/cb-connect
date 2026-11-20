import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  hookIndex: 0,
  states: [] as unknown[],
  queryIndex: 0,
  mutationIndex: 0,
  profile: { role: "primary", timeZone: "Asia/Kolkata", preferredName: "Naki" },
  preferences: [] as Array<{ purpose: string; inAppEnabled: boolean; localReminderTime?: string }>,
  saveCalls: [] as unknown[],
  saveFails: false,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: () => undefined,
    useState: <T,>(initial: T | (() => T)): [T, (value: T | ((previous: T) => T)) => void] => {
      const index = runtime.hookIndex++;
      if (runtime.states.length <= index) runtime.states[index] = typeof initial === "function" ? (initial as () => T)() : initial;
      return [runtime.states[index] as T, (value) => {
        runtime.states[index] = typeof value === "function" ? (value as (previous: T) => T)(runtime.states[index] as T) : value;
      }];
    },
  };
});

vi.mock("@clerk/expo", () => ({ useAuth: () => ({ signOut: async () => undefined }) }));
vi.mock("convex/react", () => ({
  useQuery: () => {
    const index = runtime.queryIndex++;
    return [runtime.profile, {}, runtime.preferences, { predictionPaused: false }, null][index];
  },
  useMutation: () => {
    const index = runtime.mutationIndex++;
    if (index !== 0) return async () => null;
    return async (args: unknown) => {
      runtime.saveCalls.push(args);
      if (runtime.saveFails) throw new Error("save failed");
      const preference = args as { inAppEnabled: boolean; localReminderTime?: string; purpose: string };
      runtime.preferences = [{ ...preference }];
      return preference;
    };
  },
}));
vi.mock("@react-native-community/datetimepicker", () => ({ default: "DateTimePicker" }));
vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  Switch: "Switch",
  Text: "Text",
  TextInput: "TextInput",
  useColorScheme: () => "light",
  View: "View",
}));
vi.mock("../../theme/ThemePreferenceProvider", () => ({
  useThemePreference: () => ({ mode: "system", ready: true, setMode: async () => undefined }),
}));

import { Settings } from "./Settings";
import { formatReminderTime, parseReminderTime } from "./reminderTime";

type Element = React.ReactElement<Record<string, unknown>>;

function renderSettings(): Element[] {
  runtime.hookIndex = 0;
  runtime.queryIndex = 0;
  runtime.mutationIndex = 0;
  const elements: Element[] = [];
  const visit = (node: React.ReactNode): void => {
    for (const child of React.Children.toArray(node)) {
      if (!React.isValidElement(child)) continue;
      const element = child as Element;
      if (typeof element.type === "function") {
        visit((element.type as (props: Element["props"]) => React.ReactNode)(element.props));
        continue;
      }
      elements.push(element);
      visit(element.props.children as React.ReactNode);
    }
  };
  visit(Settings());
  return elements;
}

function pressable(elements: Element[], label: string): Element {
  const found = elements.find((element) => element.type === "Pressable" && element.props.accessibilityLabel === label);
  if (!found) throw new Error(`Missing button ${label}`);
  return found;
}

function cycleWindowSwitch(elements: Element[]): Element {
  const found = elements.find((element) => element.type === "Switch" && element.props.accessibilityLabel === "Period window reminder");
  if (!found) throw new Error(`Missing cycle-window switch; found ${elements.filter((element) => element.type === "Switch").map((element) => String(element.props.accessibilityLabel)).join(", ")}`);
  return found;
}

function openAndChooseTime(elements: Element[], time: string): Element[] {
  const selector = elements.find((element) => element.type === "Pressable" && String(element.props.accessibilityLabel).startsWith("Reminder time for cycle window:"));
  if (!selector) throw new Error("Missing reminder-time selector");
  (selector.props.onPress as () => void)();
  elements = renderSettings();
  const picker = elements.find((element) => element.type === "DateTimePicker");
  if (!picker) throw new Error("Missing native time picker");
  const selected = parseReminderTime(time, runtime.profile.timeZone);
  if (!selected) throw new Error(`Could not construct ${time} in ${runtime.profile.timeZone}`);
  (picker.props.onChange as (event: { type: string }, date: Date) => void)({ type: "set" }, selected);
  return renderSettings();
}

async function flushSave(): Promise<void> {
  for (let index = 0; index < 6; index += 1) await Promise.resolve();
}

beforeEach(() => {
  runtime.hookIndex = 0;
  runtime.states = [];
  runtime.queryIndex = 0;
  runtime.mutationIndex = 0;
  runtime.profile = { role: "primary", timeZone: "Asia/Kolkata", preferredName: "Naki" };
  runtime.preferences = [{ purpose: "period_window_approaching", inAppEnabled: false }];
  runtime.saveCalls = [];
  runtime.saveFails = false;
});

describe("native reminder-time settings interactions", () => {
  it("saves the selected account-local time before enabling the default-off purpose", async () => {
    let elements = renderSettings();
    expect(cycleWindowSwitch(elements).props.disabled).toBe(true);

    elements = openAndChooseTime(elements, "10:30");
    expect(cycleWindowSwitch(elements).props.disabled).toBe(true);
    (pressable(elements, "Save reminder time").props.onPress as () => void)();
    await flushSave();

    expect(runtime.saveCalls[0]).toEqual({
      purpose: "period_window_approaching",
      inAppEnabled: false,
      localReminderTime: "10:30",
    });
    elements = renderSettings();
    expect(cycleWindowSwitch(elements).props.disabled).toBe(false);
    (cycleWindowSwitch(elements).props.onValueChange as (value: boolean) => void)(true);
    await flushSave();
    expect(runtime.saveCalls[1]).toEqual({
      purpose: "period_window_approaching",
      inAppEnabled: true,
      localReminderTime: "10:30",
    });
  });

  it("retains the selected draft and shows an error when saving fails", async () => {
    runtime.saveFails = true;
    let elements = openAndChooseTime(renderSettings(), "10:30");
    (pressable(elements, "Save reminder time").props.onPress as () => void)();
    await flushSave();

    elements = renderSettings();
    const selector = elements.find((element) => element.type === "Pressable" && String(element.props.accessibilityLabel).startsWith("Reminder time for cycle window:"));
    expect(selector?.props.accessibilityLabel).toBe("Reminder time for cycle window: 10:30");
    expect(elements.filter((element) => element.type === "Text").map((element) => element.props.children)).toContain("Unable to update settings. Try again.");
  });

  it("keeps the selected clock while the account timezone changes", () => {
    runtime.preferences = [{ purpose: "period_window_approaching", inAppEnabled: false, localReminderTime: "09:15" }];
    let elements = renderSettings();
    const selector = elements.find((element) => element.type === "Pressable" && String(element.props.accessibilityLabel).startsWith("Reminder time for cycle window:"));
    (selector?.props.onPress as () => void)();
    elements = renderSettings();
    let picker = elements.find((element) => element.type === "DateTimePicker");
    expect(picker?.props.timeZoneName).toBe("Asia/Kolkata");
    expect(formatReminderTime(picker?.props.value as Date, "Asia/Kolkata")).toBe("09:15");

    runtime.profile = { ...runtime.profile, timeZone: "America/Los_Angeles" };
    elements = renderSettings();
    picker = elements.find((element) => element.type === "DateTimePicker");
    expect(picker?.props.timeZoneName).toBe("America/Los_Angeles");
    expect(formatReminderTime(picker?.props.value as Date, "America/Los_Angeles")).toBe("09:15");
  });
});
