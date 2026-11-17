import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  authLoading: false,
  authenticated: true,
  online: true,
  scheme: "light",
  queries: [] as unknown[],
  queryValues: [] as unknown[],
  mutations: [] as unknown[],
  state: [] as unknown[],
  stateCursor: 0,
  ensureUser: vi.fn(async () => undefined),
  updateRole: vi.fn(async () => undefined),
  updateTimeZone: vi.fn(async () => undefined),
  logPeriodStart: vi.fn(async () => undefined),
  updateCycleSettings: vi.fn(async () => undefined),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: () => undefined,
    useRef: (current: unknown) => ({ current }),
    useState: (initial: unknown) => {
      const index = runtime.stateCursor++;
      if (runtime.state.length <= index) runtime.state[index] = initial;
      return [runtime.state[index], (next: unknown) => {
        runtime.state[index] = typeof next === "function"
          ? (next as (previous: unknown) => unknown)(runtime.state[index])
          : next;
      }];
    },
  };
});

vi.mock("react-native", () => ({
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Platform: { OS: "android" },
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: { absoluteFill: {}, create: (styles: object) => styles },
  Text: "Text",
  View: "View",
  useColorScheme: () => runtime.scheme,
  useWindowDimensions: () => ({ fontScale: 1, width: 390 }),
}));

vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
vi.mock("expo-router", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@react-native-community/datetimepicker", () => ({ default: "DateTimePicker" }));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: runtime.authLoading, isAuthenticated: runtime.authenticated }),
  useConvexConnectionState: () => ({ isWebSocketConnected: runtime.online }),
  useMutation: () => runtime.mutations.shift(),
  useQuery: () => runtime.queries.shift(),
}));

import { BloomScreen } from "../../components/BloomScreen";
import { BloomPanel } from "../../components/BloomPanel";
import { DateField } from "../logging/DateField";
import { OnboardingScreen } from "./OnboardingScreen";

function setup({ me, periods = [], settings = { cycleLength: 28, periodLength: 5 }, capabilities = { cycleFactsV1: true }, online = true, loading = false }: {
  me?: unknown;
  periods?: unknown;
  settings?: unknown;
  capabilities?: unknown;
  online?: boolean;
  loading?: boolean;
} = {}) {
  runtime.authLoading = loading;
  runtime.authenticated = true;
  runtime.online = online;
  runtime.scheme = "light";
  runtime.queryValues = [me, periods, settings, capabilities];
  runtime.mutations = [runtime.ensureUser, runtime.updateRole, runtime.updateTimeZone, runtime.logPeriodStart, runtime.updateCycleSettings];
  runtime.state = [];
  runtime.stateCursor = 0;
  return render();
}

function render() {
  runtime.stateCursor = 0;
  runtime.queries = [...runtime.queryValues];
  runtime.mutations = [runtime.ensureUser, runtime.updateRole, runtime.updateTimeZone, runtime.logPeriodStart, runtime.updateCycleSettings];
  return OnboardingScreen({ onComplete: vi.fn() });
}

type Element = React.ReactElement<Record<string, unknown>>;

function visit(node: React.ReactNode, collect: (element: Element) => void): void {
  for (const child of React.Children.toArray(node)) {
    if (!React.isValidElement(child)) continue;
    const element = child as Element;
    collect(element);
    if (typeof element.type === "function") {
      visit((element.type as (props: Record<string, unknown>) => React.ReactNode)(element.props), collect);
    } else {
      visit(element.props.children as React.ReactNode, collect);
    }
  }
}

function presentation(tree: React.ReactNode) {
  const visible: string[] = [];
  const controls: string[] = [];
  visit(tree, (element) => {
    if (element.type === "Text") {
      const role = element.props.accessibilityRole;
      const value = React.Children.toArray(element.props.children as React.ReactNode).map(String).join("").trim();
      if (value) visible.push(`${role === "header" ? "heading" : role === "alert" ? "alert" : "text"}: ${value.replace(/\s+/g, " ")}`);
    }
    if (element.type === "Pressable") {
      const label = String(element.props.accessibilityLabel ?? "");
      const state = element.props.accessibilityState as { selected?: boolean; disabled?: boolean } | undefined;
      if (label) controls.push(`${label} [${state?.selected ? "selected" : "not selected"}; ${state?.disabled || element.props.disabled ? "disabled" : "enabled"}]`);
    }
    if (element.type === BloomScreen) {
      visible.push(`screen: ${element.props.title}`);
      if (element.props.eyebrow) visible.push(`eyebrow: ${element.props.eyebrow}`);
    }
    if (element.type === BloomPanel && element.props.accessibilityLabel) visible.push(`section: ${element.props.accessibilityLabel}`);
    if (element.type === DateField) visible.push(`date field: ${element.props.label}`);
  });
  return [...visible, ...controls];
}

function find(node: React.ReactNode, predicate: (element: Element) => boolean): Element | undefined {
  let result: Element | undefined;
  visit(node, (element) => { if (!result && predicate(element)) result = element; });
  return result;
}

describe("Onboarding presentation", () => {
  beforeEach(() => {
    runtime.ensureUser.mockReset().mockResolvedValue(undefined);
    runtime.updateRole.mockReset().mockResolvedValue(undefined);
    runtime.updateTimeZone.mockReset().mockResolvedValue(undefined);
    runtime.logPeriodStart.mockReset().mockResolvedValue(undefined);
    runtime.updateCycleSettings.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it("presents role selection with the two distinct setup paths", () => {
    expect(presentation(setup({ me: null }))).toMatchSnapshot();
  });

  it("presents primary cycle setup with certainty and a disabled save until a date is chosen", () => {
    expect(presentation(setup({ me: { role: "primary" }, periods: [], settings: { cycleLength: 28, periodLength: 5 } }))).toMatchSnapshot();
  });

  it("explains legacy date storage without offering certainty that cannot be retained", () => {
    const view = presentation(setup({ me: { role: "primary" }, capabilities: { cycleFactsV1: false } }));
    expect(view).toMatchSnapshot();
    expect(JSON.stringify(view)).not.toContain("Approximate start date");
    expect(JSON.stringify(view)).toContain("Dates are saved without certainty labels");
  });

  it("waits for authoritative capabilities before offering the date form", () => {
    setup({ me: { role: "primary" } });
    runtime.queryValues[3] = undefined;
    const tree = render();
    expect(find(tree, (element) => element.props.accessibilityLabel === "Start tracking")).toBeUndefined();
    expect(find(tree, (element) => element.type === DateField)).toBeUndefined();
  });

  it("presents the partner completion path without primary cycle fields", () => {
    expect(presentation(setup({ me: { role: "partner" } }))).toMatchSnapshot();
  });

  it("presents account loading as a polite progress state", () => {
    expect(presentation(setup({ me: undefined, loading: true }))).toMatchSnapshot();
  });

  it("reports a truthful partial save when settings succeeded but the period receipt failed", async () => {
    runtime.updateCycleSettings.mockResolvedValue(undefined);
    runtime.logPeriodStart.mockRejectedValueOnce(new Error("write failed"));
    let tree = setup({ me: { role: "primary" }, periods: [], settings: { cycleLength: 28, periodLength: 5 } });
    const date = find(tree, (element) => element.type === DateField && element.props.label === "When did your last period start?");
    (date?.props.onChange as (value: string) => void)("2026-11-10");
    tree = render();
    const save = find(tree, (element) => element.type === "Pressable" && element.props.accessibilityLabel === "Start tracking");
    await (save?.props.onPress as () => Promise<void>)();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(presentation(render())).toMatchSnapshot();
  });
});
