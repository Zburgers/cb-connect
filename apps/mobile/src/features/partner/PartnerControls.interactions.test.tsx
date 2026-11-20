import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  cursor: 0,
  state: [] as unknown[],
  dependencies: [] as Array<unknown[] | undefined>,
  queries: [] as unknown[],
  mutationCursor: 0,
  mutations: [] as Array<(...args: unknown[]) => unknown>,
  scheme: "light",
  generatedCode: { code: "ABC123", expiresAt: 2_000 },
  clipboard: vi.fn().mockResolvedValue(true),
  share: vi.fn().mockResolvedValue({ action: "sharedAction" }),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = runtime.cursor++;
      if (runtime.state.length <= index) runtime.state[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
      return [runtime.state[index], (value: unknown) => {
        runtime.state[index] = typeof value === "function"
          ? (value as (oldValue: unknown) => unknown)(runtime.state[index])
          : value;
      }];
    },
    useRef: (initial: unknown) => ({ current: initial }),
    useLayoutEffect: (effect: () => void) => effect(),
    useEffect: (effect: () => void | (() => void), dependencies?: unknown[]) => {
      const index = runtime.cursor++;
      const previous = runtime.dependencies[index];
      const changed = !previous || !dependencies || dependencies.some((value, depIndex) => !Object.is(value, previous[depIndex]));
      if (changed) {
        runtime.dependencies[index] = dependencies;
        effect();
      }
    },
  };
});

vi.mock("react-native", () => ({
  Alert: { alert: vi.fn() },
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Platform: { OS: "android" },
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Share: { share: (...args: unknown[]) => runtime.share(...args) },
  StyleSheet: { create: (styles: object) => styles, hairlineWidth: 1 },
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
  useWindowDimensions: () => ({ fontScale: 1, width: 390, height: 844 }),
  useColorScheme: () => runtime.scheme,
}));

vi.mock("expo-clipboard", () => ({ setStringAsync: (...args: unknown[]) => runtime.clipboard(...args) }));
vi.mock("@react-native-community/datetimepicker", () => ({ default: "DateTimePicker" }));
vi.mock("@clerk/expo", () => ({ useAuth: () => ({ signOut: vi.fn() }) }));
vi.mock("convex/react", () => ({
  useAction: () => runtime.mutations[runtime.mutationCursor++],
  useMutation: () => runtime.mutations[runtime.mutationCursor++],
  useQuery: () => runtime.queries.shift(),
}));
vi.mock("../home/HomeNudges", () => ({ HomeNudges: () => null }));
vi.mock("../../components/BloomLocket", () => ({ BloomLocket: () => null }));

import React from "react";
import { PartnerControls } from "./PartnerControls";

type Element = React.ReactElement<Record<string, unknown>>;

const activeCouple: Record<string, unknown> = {
  isLinked: true,
  status: "active",
  relationshipGeneration: "partner-membership-1",
  connectedSinceDate: "2020-01-01",
  anniversary: null,
  sharingSettings: { pain: false, phase: true, periodWrite: false },
  partner: { name: "Partner", displayName: "Partner", nickname: null },
};

function render(
  couple: Record<string, unknown> = activeCouple,
  role: "primary" | "partner" = "primary",
  mutationOverrides: Partial<Record<number, (...args: unknown[]) => unknown>> = {},
  queryValues: unknown[] = [null, null],
) {
  runtime.mutations = [
    vi.fn().mockResolvedValue({}),
    vi.fn().mockResolvedValue({}),
    vi.fn().mockResolvedValue({ success: true }),
    vi.fn().mockResolvedValue({ success: true }),
  ];
  for (const [index, mutation] of Object.entries(mutationOverrides)) {
    if (mutation) runtime.mutations[Number(index)] = mutation;
  }
  runtime.queries = queryValues;
  let elements: Element[] = [];
  for (let pass = 0; pass < 2; pass += 1) {
    runtime.cursor = 0;
    runtime.mutationCursor = 0;
    const tree = PartnerControls({
      access: role,
      role,
      couple: couple as never,
      guard: { couple: { isLinked: couple.status === "active", role } } as never,
      isActive: couple.status === "active",
      revoking: false,
      onRevokeStart: vi.fn(),
      onRevokeFailure: vi.fn(),
    });
    elements = [];
    const visit = (node: React.ReactNode): void => {
      for (const child of React.Children.toArray(node)) {
        if (!React.isValidElement(child)) continue;
        const element = child as Element;
        elements.push(element);
        const nested = typeof element.type === "function"
          ? (element.type as (props: Record<string, unknown>) => React.ReactNode)(element.props)
          : element.props.children as React.ReactNode;
        visit(nested);
      }
    };
    visit(tree);
  }
  return elements;
}

function textInput(elements: Element[], label: string) {
  const element = elements.find((item) => item.type === "TextInput" && item.props.accessibilityLabel === label);
  if (!element) throw new Error(`Missing TextInput ${label}`);
  return element.props as { value: string; editable?: boolean; onChangeText: (value: string) => void };
}

function pressable(elements: Element[], label: string) {
  const element = elements.find((item) => item.type === "Pressable" && item.props.accessibilityLabel === label);
  if (!element) throw new Error(`Missing Pressable ${label}`);
  return element.props as { onPress: () => unknown; disabled?: boolean };
}

function dateField(elements: Element[]) {
  const element = elements.find((item) => typeof elementTypeName(item.type) === "string" && elementTypeName(item.type) === "DateField");
  if (!element) throw new Error("Missing DateField");
  return element.props as { value: string; onChange: (value: string) => void; clearable?: boolean };
}

function elementTypeName(type: Element["type"]): string {
  return typeof type === "function" ? type.name : String(type);
}

describe("PartnerControls interactions", () => {
  beforeEach(() => {
    vi.useRealTimers();
    runtime.cursor = 0;
    runtime.mutationCursor = 0;
    runtime.state = [];
    runtime.dependencies = [];
    runtime.queries = [];
    runtime.scheme = "light";
    runtime.clipboard.mockReset().mockResolvedValue(true);
    runtime.share.mockReset().mockResolvedValue({ action: "sharedAction" });
  });

  it("preserves an unsaved nickname when the server relationship date changes", () => {
    let elements = render();
    dateField(elements).onChange("2020-02-02");
    textInput(elements, "Private partner nickname").onChangeText("My draft name");

    elements = render({ ...activeCouple, connectedSinceDate: "2020-03-03" });
    expect(textInput(elements, "Private partner nickname").value).toBe("My draft name");
    expect(dateField(elements).value).toBe("2020-03-03");
  });

  it("clears a relationship date through the same server-backed save path", async () => {
    let elements = render();
    expect(dateField(elements).clearable).toBe(true);
    dateField(elements).onChange("");
    elements = render();
    await pressable(elements, "Clear relationship date").onPress();
    expect(runtime.mutations[2]).toHaveBeenCalledWith({ connectedSinceDate: "" });
  });

  it("disables nickname edits while a save is pending", async () => {
    let elements = render();
    textInput(elements, "Private partner nickname").onChangeText("Saved nickname");
    let finishSave!: () => void;
    const pendingSave = new Promise<void>((resolve) => { finishSave = resolve; });
    elements = render(activeCouple, "primary", { 3: vi.fn(() => pendingSave) });

    pressable(elements, "Save nickname").onPress();
    elements = render();
    expect(textInput(elements, "Private partner nickname").editable).toBe(false);

    finishSave();
    await Promise.resolve();
    await Promise.resolve();
    elements = render();
    expect(textInput(elements, "Private partner nickname").editable).toBe(true);
  });

  it("presents primary sharing controls separately from the partner shared-cycle view", () => {
    const primary = render(activeCouple, "primary");
    expect(primary.some((element) => element.type === "Pressable" && element.props.accessibilityRole === "switch" && element.props.accessibilityLabel === "Cycle phase")).toBe(true);
    expect(primary.some((element) => element.type === "Text" && String(element.props.children).includes("Private to your account"))).toBe(true);

    const partner = render(activeCouple, "partner", {}, [null, undefined]);
    expect(partner.some((element) => element.type === "Text" && element.props.children === "Shared cycle update")).toBe(true);
    expect(partner.some((element) => element.type === "Pressable" && element.props.accessibilityRole === "switch")).toBe(false);
    expect({ primaryControls: primary.filter((element) => ["Pressable", "TextInput", "Text"].includes(String(element.type))).map((element) => ({ type: element.type, role: element.props.accessibilityRole, label: element.props.accessibilityLabel })).filter((item) => item.role || item.label), partnerControls: partner.filter((element) => ["Pressable", "TextInput", "Text"].includes(String(element.type))).map((element) => ({ type: element.type, role: element.props.accessibilityRole, label: element.props.accessibilityLabel })).filter((item) => item.role || item.label) }).toMatchSnapshot();
  });

  it("does not copy or share a cached pairing code after its expiry time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const pending = {
      ...activeCouple,
      isLinked: false,
      status: "pending",
      relationshipGeneration: undefined,
      activePairingCode: { code: "ABC123", expiresAt: 2_000 },
    };
    let elements = render(pending, "primary");
    runtime.mutations[0] = vi.fn().mockResolvedValue({ code: "ABC123", expiresAt: 2_000 });
    await pressable(elements, "Create a new pairing code").onPress();
    await Promise.resolve();
    await Promise.resolve();
    elements = render(pending, "primary");
    const copy = pressable(elements, "Copy pairing code").onPress;
    const share = pressable(elements, "Share pairing code").onPress;

    vi.advanceTimersByTime(1_001);
    await copy();
    await share();
    expect(runtime.clipboard).not.toHaveBeenCalled();
    expect(runtime.share).not.toHaveBeenCalled();

    elements = render(pending, "primary");
    expect(elements.some((element) => element.type === "Text" && String(element.props.children).includes("Pairing code expired."))).toBe(true);
    expect(elements.some((element) => element.type === "Pressable" && element.props.accessibilityLabel === "Copy pairing code")).toBe(false);
  });
});
