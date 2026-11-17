import React from "react";
import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  hookIndex: 0,
  states: [] as unknown[],
  renderedProfileId: "" as string,
  queryIndex: 0,
  mutationIndex: 0,
  profile: {
    _id: "primary-one",
    role: "primary",
    timeZone: "Asia/Kolkata",
    preferredName: "Naki",
    gender: undefined as "male" | "female" | "other" | "prefer_not_to_say" | undefined,
    partnerType: undefined as "boyfriend" | "girlfriend" | "spouse" | "partner" | "other" | undefined,
  },
  cycleSettings: { cycleLength: 28, periodLength: 5, predictionPaused: false } as { cycleLength: number; periodLength: number; predictionPaused: boolean } | undefined,
  preferences: [] as Array<{ purpose: string; inAppEnabled: boolean; localReminderTime?: string }>,
  saveCalls: [] as unknown[],
  saveFails: false,
  profileSaveStale: false,
  profileSavePending: false,
  resolveProfileSave: undefined as (() => void) | undefined,
  cycleSaveCalls: [] as unknown[],
  cycleSaveFails: false,
  cycleSaveStale: false,
  colorScheme: "light" as "light" | "dark",
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: (effect: () => void) => effect(),
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
  useQuery: (_reference: unknown, argument?: unknown) => {
    const index = runtime.queryIndex++;
    if (index === 1) return argument === "skip" ? undefined : {};
    return [runtime.profile, undefined, runtime.preferences, runtime.cycleSettings, null][index];
  },
  useMutation: () => {
    const index = runtime.mutationIndex++;
    if (index === 2) return async (args: unknown) => {
      runtime.saveCalls.push(args);
      if (runtime.profileSavePending) {
        await new Promise<void>((resolve) => { runtime.resolveProfileSave = resolve; });
      }
      if (runtime.profileSaveStale) throw new ConvexError({ code: "STALE_PROFILE_PREFERENCES" });
      if (runtime.saveFails) throw new Error("profile save failed");
      runtime.profile = { ...runtime.profile, ...(args as object) };
      return null;
    };
    if (index === 3) return async (args: unknown) => {
      runtime.cycleSaveCalls.push(args);
      if (runtime.cycleSaveStale) throw new ConvexError({ code: "STALE_CYCLE_SETTINGS" });
      if (runtime.cycleSaveFails) throw new Error("cycle save failed");
      if (runtime.cycleSettings) runtime.cycleSettings = { ...runtime.cycleSettings, ...(args as object) };
      return null;
    };
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
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Platform: { OS: "ios" },
  useWindowDimensions: () => ({ width: 390, height: 844, fontScale: 1, scale: 1 }),
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  Switch: "Switch",
  Text: "Text",
  TextInput: "TextInput",
  useColorScheme: () => runtime.colorScheme,
  View: "View",
}));
vi.mock("../../theme/ThemePreferenceProvider", () => ({
  useThemePreference: () => ({ mode: "system", ready: true, setMode: async () => undefined }),
}));

import { Settings } from "./Settings";
import { formatReminderTime, parseReminderTime } from "./reminderTime";

type Element = React.ReactElement<Record<string, unknown>>;

function renderSettings(): Element[] {
  if (runtime.renderedProfileId !== runtime.profile._id) {
    runtime.states = [];
    runtime.renderedProfileId = runtime.profile._id;
  }
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

function textContent(value: unknown): string {
  if (Array.isArray(value)) return value.map(textContent).join("");
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function presentationDigest(elements: Element[]) {
  const label = (element: Element) => textContent(element.props.children);
  return {
    headings: elements.filter((element) => element.type === "Text" && element.props.accessibilityRole === "header").map(label),
    selectedAppearance: elements.find((element) => element.type === "Pressable" && element.props.accessibilityState && (element.props.accessibilityState as { checked?: boolean }).checked)?.props.accessibilityLabel,
    enumSelections: elements.filter((element) => element.type === "Pressable" && String(element.props.accessibilityLabel).startsWith("Gender:") && (element.props.accessibilityState as { checked?: boolean } | undefined)?.checked).map((element) => element.props.accessibilityLabel),
    profileSaveDisabled: pressable(elements, "Save profile preferences").props.disabled,
    profileInputEditable: elements.find((element) => element.type === "TextInput" && element.props.accessibilityLabel === "Preferred name")?.props.editable,
    profileDraft: elements.find((element) => element.type === "TextInput" && element.props.accessibilityLabel === "Preferred name")?.props.value,
    alert: elements.find((element) => element.type === "Text" && element.props.accessibilityRole === "alert")?.props.children,
  };
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
  runtime.profile = { _id: "primary-one", role: "primary", timeZone: "Asia/Kolkata", preferredName: "Naki", gender: undefined, partnerType: undefined };
  runtime.renderedProfileId = "";
  runtime.cycleSettings = { cycleLength: 28, periodLength: 5, predictionPaused: false };
  runtime.preferences = [{ purpose: "period_window_approaching", inAppEnabled: false }];
  runtime.saveCalls = [];
  runtime.saveFails = false;
  runtime.profileSaveStale = false;
  runtime.profileSavePending = false;
  runtime.resolveProfileSave = undefined;
  runtime.cycleSaveCalls = [];
  runtime.cycleSaveFails = false;
  runtime.cycleSaveStale = false;
  runtime.colorScheme = "light";
});

describe("native settings presentation", () => {
  it("snapshots primary light settings hierarchy and selected options", () => {
    expect(presentationDigest(renderSettings())).toMatchSnapshot();
  });

  it("snapshots partner dark settings hierarchy and selected options", () => {
    runtime.profile = { ...runtime.profile, _id: "partner-dark", role: "partner" };
    runtime.colorScheme = "dark";
    expect(presentationDigest(renderSettings())).toMatchSnapshot();
  });

  it("snapshots a recoverable save failure with the draft retained", async () => {
    runtime.saveFails = true;
    let elements = renderSettings();
    const input = elements.find((element) => element.type === "TextInput" && element.props.accessibilityLabel === "Preferred name");
    (input?.props.onChangeText as (value: string) => void)("Draft name");
    elements = renderSettings();
    (pressable(elements, "Save profile preferences").props.onPress as () => void)();
    await flushSave();
    expect(presentationDigest(renderSettings())).toMatchSnapshot();
  });

  it("snapshots pending profile save locking", () => {
    runtime.profileSavePending = true;
    let elements = renderSettings();
    const input = elements.find((element) => element.type === "TextInput" && element.props.accessibilityLabel === "Preferred name");
    (input?.props.onChangeText as (value: string) => void)("Draft name");
    elements = renderSettings();
    (pressable(elements, "Save profile preferences").props.onPress as () => void)();
    expect(presentationDigest(renderSettings())).toMatchSnapshot();
    runtime.resolveProfileSave?.();
  });

  it("uses the shared responsive Bloom screen and bordered panels", () => {
    const elements = renderSettings();
    expect(elements.some((element) => element.type === "KeyboardAvoidingView")).toBe(true);
    expect(elements.some((element) => element.type === "ScrollView")).toBe(true);
    expect(elements.filter((element) => element.type === "View" && element.props.accessible === false).length).toBeGreaterThan(0);
    expect(elements.some((element) => element.type === "Pressable" && element.props.accessibilityLabel === "Dark appearance")).toBe(true);
    expect(pressable(elements, "Save profile preferences").props.disabled).toBe(true);
  });

  it("keeps profile controls and enum choices available for partner accounts in dark appearance", () => {
    runtime.profile = { ...runtime.profile, _id: "partner-one", role: "partner" };
    runtime.renderedProfileId = "";
    runtime.colorScheme = "dark";
    const elements = renderSettings();
    expect(elements.some((element) => element.type === "Text" && textContent(element.props.children) === "Appearance")).toBe(true);
    expect(pressable(elements, "Gender: Prefer not to say").props.accessibilityState).toMatchObject({ checked: true });
    expect(elements.some((element) => element.type === "Text" && textContent(element.props.children) === "Cycle settings")).toBe(false);
    expect(elements.some((element) => element.type === "Text" && textContent(element.props.children) === "Sharing")).toBe(false);
  });
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

  it("edits cycle and period length within backend bounds and reads saved values back", async () => {
    let elements = renderSettings();
    expect(elements.some((element) => element.type === "Text" && element.props.children === "Cycle settings" )).toBe(true);
    (pressable(elements, "Increase cycle length").props.onPress as () => void)();
    (pressable(renderSettings(), "Decrease period length").props.onPress as () => void)();
    elements = renderSettings();
    expect(elements.some((element) => element.type === "Text" && textContent(element.props.children) === "Cycle length: 29 days")).toBe(true);
    expect(elements.some((element) => element.type === "Text" && textContent(element.props.children) === "Period length: 4 days")).toBe(true);
    (pressable(elements, "Save cycle settings").props.onPress as () => void)();
    await flushSave();
    expect(runtime.cycleSaveCalls).toEqual([{
      cycleLength: 29,
      periodLength: 4,
      expectedCurrent: { cycleLength: 28, periodLength: 5 },
    }]);
    elements = renderSettings();
    expect(elements.some((element) => element.type === "Text" && textContent(element.props.children) === "Cycle length: 29 days")).toBe(true);
  });

  it("keeps cycle setting drafts after save failure and blocks partner cycle edits", async () => {
    runtime.cycleSaveFails = true;
    let elements = renderSettings();
    (pressable(elements, "Increase cycle length").props.onPress as () => void)();
    (pressable(renderSettings(), "Save cycle settings").props.onPress as () => void)();
    await flushSave();
    elements = renderSettings();
    expect(elements.some((element) => element.type === "Text" && textContent(element.props.children) === "Cycle length: 29 days")).toBe(true);
    expect(elements.some((element) => element.type === "Text" && textContent(element.props.children) === "Unable to update settings. Try again.")).toBe(true);

    runtime.profile = { ...runtime.profile, role: "partner" };
    elements = renderSettings();
    expect(elements.some((element) => element.type === "Text" && element.props.children === "Cycle settings")).toBe(false);
    expect(elements.some((element) => element.type === "Pressable" && element.props.accessibilityLabel === "Save cycle settings")).toBe(false);
  });

  it("disables cycle length controls at the backend minimum and maximum", () => {
    runtime.cycleSettings = { cycleLength: 40, periodLength: 2, predictionPaused: false };
    const elements = renderSettings();
    expect(pressable(elements, "Increase cycle length").props.disabled).toBe(true);
    expect(pressable(elements, "Decrease period length").props.disabled).toBe(true);
    expect(pressable(elements, "Decrease cycle length").props.disabled).toBe(false);
    expect(pressable(elements, "Increase period length").props.disabled).toBe(false);
  });

  it("waits for saved cycle settings before enabling length controls", () => {
    runtime.cycleSettings = undefined;
    const elements = renderSettings();
    expect(elements.some((element) => element.type === "ActivityIndicator" && element.props.accessibilityLabel === "Loading cycle settings")).toBe(true);
    expect(elements.some((element) => element.type === "Pressable" && element.props.accessibilityLabel === "Increase cycle length")).toBe(false);
  });

  it("saves inclusive identity preferences while preserving the preferred name", async () => {
    const elements = renderSettings();
    expect(elements.filter((element) => element.type === "Pressable").map((element) => element.props.accessibilityLabel)).toEqual(expect.arrayContaining([
      "Gender: Prefer not to say", "Gender: Female", "Gender: Male", "Gender: Other",
      "Relationship term: Partner", "Relationship term: Boyfriend", "Relationship term: Girlfriend", "Relationship term: Spouse", "Relationship term: Other",
    ]));
    expect(elements.some((element) => element.type === "Pressable" && element.props.accessibilityLabel === "Gender: Other")).toBe(true);
    expect(elements.some((element) => element.type === "Pressable" && element.props.accessibilityLabel === "Relationship term: Spouse")).toBe(true);
    const relationship = pressable(elements, "Relationship term: Girlfriend");
    (relationship.props.onPress as () => void)();
    const gender = pressable(renderSettings(), "Gender: Prefer not to say");
    (gender.props.onPress as () => void)();
    const saveProfile = pressable(renderSettings(), "Save profile preferences");
    (saveProfile.props.onPress as () => void)();
    await flushSave();
    expect(runtime.saveCalls.at(-1)).toEqual({
      preferredName: "Naki", gender: "prefer_not_to_say", partnerType: "girlfriend",
      expectedCurrent: { preferredName: "Naki", gender: "prefer_not_to_say", partnerType: "partner" },
    });
  });

  it("rejects a stale cycle draft when another client changes the saved record", async () => {
    let elements = renderSettings();
    (pressable(elements, "Increase cycle length").props.onPress as () => void)();
    runtime.cycleSettings = { cycleLength: 31, periodLength: 5, predictionPaused: false };
    elements = renderSettings();
    (pressable(elements, "Save cycle settings").props.onPress as () => void)();
    await flushSave();
    expect(runtime.cycleSaveCalls).toHaveLength(0);
    expect(renderSettings().some((element) => element.type === "Text" && textContent(element.props.children) === "These cycle settings changed elsewhere. Reload before saving.")).toBe(true);
    (pressable(renderSettings(), "Reload cycle settings").props.onPress as () => void)();
    elements = renderSettings();
    expect(elements.some((element) => element.type === "Text" && textContent(element.props.children) === "Cycle length: 31 days")).toBe(true);
    expect(pressable(elements, "Save cycle settings").props.disabled).toBe(true);
  });

  it("recovers when the server rejects a cycle save that raced with another client", async () => {
    runtime.cycleSaveStale = true;
    let elements = renderSettings();
    (pressable(elements, "Increase cycle length").props.onPress as () => void)();
    (pressable(renderSettings(), "Save cycle settings").props.onPress as () => void)();
    await flushSave();

    elements = renderSettings();
    expect(elements.some((element) => element.type === "Text" && textContent(element.props.children) === "These cycle settings changed elsewhere. Reload before saving.")).toBe(true);
    expect(pressable(elements, "Save cycle settings").props.disabled).toBe(true);
    expect(pressable(elements, "Reload cycle settings").props.disabled).toBe(false);
  });

  it("preserves the profile draft and offers reload on a server-side conflict", async () => {
    runtime.profileSaveStale = true;
    (pressable(renderSettings(), "Relationship term: Girlfriend").props.onPress as () => void)();
    (pressable(renderSettings(), "Save profile preferences").props.onPress as () => void)();
    await flushSave();

    const elements = renderSettings();
    expect(pressable(elements, "Relationship term: Girlfriend").props.accessibilityState).toMatchObject({ checked: true });
    expect(pressable(elements, "Save profile preferences").props.disabled).toBe(true);
    expect(pressable(elements, "Reload profile preferences").props.disabled).toBe(false);
  });

  it("offers reload recovery when profile preferences changed on another client", () => {
    let elements = renderSettings();
    (pressable(elements, "Relationship term: Girlfriend").props.onPress as () => void)();
    runtime.profile = { ...runtime.profile, gender: "other" };
    elements = renderSettings();
    elements = renderSettings();
    expect(elements.some((element) => element.type === "Text" && textContent(element.props.children) === "Profile preferences changed elsewhere. Reload before saving.")).toBe(true);
    expect(pressable(elements, "Save profile preferences").props.disabled).toBe(true);
    (pressable(elements, "Reload profile preferences").props.onPress as () => void)();
    elements = renderSettings();
    expect(pressable(elements, "Save profile preferences").props.disabled).toBe(true);
    expect(pressable(elements, "Relationship term: Partner").props.accessibilityState).toMatchObject({ checked: true });
  });

  it("isolates profile and cycle drafts when the authenticated profile changes", () => {
    let elements = renderSettings();
    const nameInput = elements.find((element) => element.type === "TextInput" && element.props.accessibilityLabel === "Preferred name");
    (nameInput?.props.onChangeText as (value: string) => void)("First account draft");
    (pressable(renderSettings(), "Increase cycle length").props.onPress as () => void)();

    runtime.profile = {
      ...runtime.profile,
      _id: "primary-two",
    };
    runtime.cycleSettings = { cycleLength: 28, periodLength: 5, predictionPaused: false };
    elements = renderSettings();
    elements = renderSettings();

    expect(elements.some((element) => element.type === "TextInput" && element.props.value === "Naki")).toBe(true);
    expect(pressable(elements, "Save profile preferences").props.disabled).toBe(true);
    expect(elements.some((element) => element.type === "Text" && textContent(element.props.children) === "Cycle length: 28 days")).toBe(true);
    expect(pressable(elements, "Save cycle settings").props.disabled).toBe(true);
  });

  it("locks profile edits during a pending failed save and retains the draft", async () => {
    runtime.profileSavePending = true;
    runtime.saveFails = true;
    let elements = renderSettings();
    let input = elements.find((element) => element.type === "TextInput" && element.props.accessibilityLabel === "Preferred name");
    (input?.props.onChangeText as (value: string) => void)("Draft to keep");
    elements = renderSettings();
    (pressable(elements, "Save profile preferences").props.onPress as () => void)();
    elements = renderSettings();
    input = elements.find((element) => element.type === "TextInput" && element.props.accessibilityLabel === "Preferred name");
    expect(input?.props.editable).toBe(false);

    runtime.resolveProfileSave?.();
    await flushSave();
    elements = renderSettings();
    input = elements.find((element) => element.type === "TextInput" && element.props.accessibilityLabel === "Preferred name");
    expect(input?.props.value).toBe("Draft to keep");
    expect(elements.some((element) => element.type === "Text" && textContent(element.props.children) === "Unable to update settings. Try again.")).toBe(true);
  });
});
