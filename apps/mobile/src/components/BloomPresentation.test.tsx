import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  scale: 1, width: 390, os: "android", version: 37, access: "primary",
  states: [false, false, false] as unknown[], cursor: 0,
  effects: [] as Array<() => unknown>, spring: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useContext: () => runtime.access,
  useState: () => [runtime.states[runtime.cursor++], vi.fn()],
  useRef: (current: unknown) => ({ current }),
  useEffect: (effect: () => unknown) => { runtime.effects.push(effect); },
}));
vi.mock("react-native", () => ({
  View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView", KeyboardAvoidingView: "KeyboardAvoidingView", ActivityIndicator: "ActivityIndicator", AppState: {},
  I18nManager: { isRTL: false },
  Platform: { get OS() { return runtime.os; }, get Version() { return runtime.version; } },
  useWindowDimensions: () => ({ width: runtime.width, height: 800, fontScale: runtime.scale }),
  StyleSheet: { create: <T,>(s: T) => s, absoluteFill: { position: "absolute", inset: 0 }, hairlineWidth: 1, flatten: (s: object[]) => Object.assign({}, ...s) },
  Animated: { View: "AnimatedView", ValueXY: class {
    value: unknown;
    constructor(value: unknown) { this.value = value; }
    stopAnimation() {}
    setValue(value: unknown) { this.value = value; }
    getTranslateTransform() { return [{ translate: this.value }]; }
  }, spring: (...args: unknown[]) => { runtime.spring(...args); return { start: vi.fn(), stop: vi.fn() }; } },
  Keyboard: { isVisible: () => false, addListener: () => ({ remove() {} }) },
  AccessibilityInfo: { isReduceMotionEnabled: async () => false, isReduceTransparencyEnabled: async () => false, addEventListener: () => ({ remove() {} }) },
}));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 24, left: 0, right: 0 }) }));
vi.mock("expo-blur", () => ({ BlurTargetView: "BlurTargetView", BlurView: "BlurView" }));
vi.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
vi.mock("expo-router", () => ({ Link: "Link" }));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: "Icon" }));
vi.mock("convex/react", () => ({ useQuery: vi.fn(), useMutation: vi.fn() }));
vi.mock("../features/home/HomeNudges", () => ({ HomeNudges: "HomeNudges" }));
vi.mock("../features/home/HomeSupport", () => ({ HomeSupport: "HomeSupport" }));
vi.mock("./BloomPhaseArtwork", async (original) => ({ ...await original<typeof import("./BloomPhaseArtwork")>(), BloomPhaseArtwork: "PhaseArtwork" }));

import { BloomTabBar, BloomTabLayout } from "./BloomTabBar";
import { BloomScreen } from "./BloomScreen";
import { BloomText } from "./BloomText";
import { mobileColors } from "../theme/tokens";
import { getBloomDockGeometry, getBloomScrollBottomPadding, isBloomDockRoute } from "./bloomDockModel";
import { CycleCardView, CycleDashboardView } from "../features/cycle/CycleDashboard";
import type { CycleDashboardData } from "../features/cycle/CycleDashboardModel";

type Element = React.ReactElement<Record<string, any>>;
function elements(node: React.ReactNode): Element[] {
  return React.Children.toArray(node).flatMap((child) => {
    if (!React.isValidElement(child)) return [];
    const el = child as Element;
    if (typeof el.type === "function") return elements((el.type as (props: Record<string, unknown>) => React.ReactNode)(el.props));
    return [el, ...elements(el.props.children)];
  });
}
function text(node: React.ReactNode): string {
  return React.Children.toArray(node).map((child) => React.isValidElement(child) ? text((child as Element).props.children) : String(child)).join(" ");
}
function fixture(names = ["index", "log", "chat", "partner", "settings", "notifications", "status"], selected = "index", prevented = false) {
  const routes = names.map((name) => ({ key: name + "-key", name }));
  const navigation = { emit: vi.fn(() => ({ defaultPrevented: prevented })), navigate: vi.fn() };
  const props = { state: { index: names.indexOf(selected), routes }, descriptors: Object.fromEntries(routes.map((route) => [route.key, { options: { title: route.name === "index" ? "Home" : route.name } }])), navigation, dark: false, palette: mobileColors.light, blurTarget: { current: null } };
  return { props: props as unknown as React.ComponentProps<typeof BloomTabBar>, navigation };
}
beforeEach(() => {
  runtime.scale = 1; runtime.width = 390; runtime.os = "android"; runtime.version = 37; runtime.access = "primary";
  runtime.states = [false, false, false]; runtime.cursor = 0; runtime.effects = []; runtime.spring.mockClear();
});

describe("Bloom dock navigation and materials", () => {
  it("shows guarded destinations without hidden status/inbox tabs and emits cancellable native tab events", () => {
    const { props, navigation } = fixture();
    const tabs = elements(BloomTabBar(props)).filter((el) => el.props.accessibilityRole === "tab");
    expect(tabs.map((el) => el.props.accessibilityLabel)).toEqual(["Home", "log", "chat", "partner", "settings"]);
    tabs[0].props.onPress();
    expect(navigation.navigate).not.toHaveBeenCalled();
    tabs[1].props.onPress();
    expect(navigation.emit).toHaveBeenLastCalledWith({ type: "tabPress", target: "log-key", canPreventDefault: true });
    expect(navigation.navigate).toHaveBeenCalledWith("log", undefined);
    tabs[1].props.onLongPress();
    expect(navigation.emit).toHaveBeenLastCalledWith({ type: "tabLongPress", target: "log-key" });
  });
  it("respects prevented presses and the actual guarded route set", () => {
    const { props, navigation } = fixture(["index", "log", "partner", "settings"], "index", true);
    const tabs = elements(BloomTabBar(props)).filter((el) => el.props.accessibilityRole === "tab");
    expect(tabs).toHaveLength(4);
    expect(tabs.map((el) => el.props.accessibilityLabel)).not.toContain("chat");
    tabs[1].props.onPress();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
  it("captures scene content below a sibling dock, and removes the dock immediately for guarded states", () => {
    const { props } = fixture();
    const tree = BloomTabLayout({ ...props, children: <ViewFixture />, showDock: true }) as Element;
    const children = React.Children.toArray((tree.props.children as Element).props.children) as Element[];
    expect(children[0].type).toBe("BlurTargetView");
    expect(children[1].type).toBe(BloomTabBar);
    expect(children[1].props.blurTarget).toBe(children[0].props.ref);
    expect(elements(BloomTabLayout({ ...props, children: <ViewFixture />, showDock: false })).some((el) => el.props.testID === "bloom-glass-dock")).toBe(false);
  });
  it("uses a translucent native blur and native-driver spring in normal mode", () => {
    const tree = elements(BloomTabBar(fixture().props));
    expect(tree.find((el) => el.type === "BlurView")?.props.blurTarget).toBeDefined();
    expect(tree.find((el) => el.type === "BlurView")?.props.blurMethod).toBe("dimezisBlurViewSdk31Plus");
    expect(mobileColors.light.dockTint).toContain("0.18");
    expect(mobileColors.dark.dockTint).toContain("0.18");
    runtime.effects.at(-1)!();
    expect(runtime.spring.mock.calls[0][1]).toMatchObject({ useNativeDriver: true, damping: 28 });
  });
  it.each(["older Android", "reduced transparency"])("uses a solid fallback for %s", (reason) => {
    if (reason === "older Android") runtime.version = 30;
    else runtime.states[1] = true;
    const tree = elements(BloomTabBar(fixture().props));
    expect(tree.some((el) => el.type === "BlurView")).toBe(false);
    const dock = tree.find((el) => el.props.testID === "bloom-glass-dock")!;
    expect(dock.props.style.at(-1).backgroundColor).toBe(mobileColors.light.surface);
  });
  it("does not animate under reduced motion or cover a visible keyboard", () => {
    runtime.states[0] = true;
    BloomTabBar(fixture().props); runtime.effects.at(-1)!();
    expect(runtime.spring).not.toHaveBeenCalled();
    runtime.cursor = 0;
    expect(BloomTabBar({ ...fixture().props, keyboardVisible: true })).toBeNull();
  });
  it.each([320, 390, 430])("reserves reachable content space at width %s and all qualified font scales", (width) => {
    for (const scale of [1, 1.3, 2, 3]) {
      const dock = getBloomDockGeometry(width, scale, 5);
      expect(dock.itemWidth).toBeGreaterThanOrEqual(48);
      expect(getBloomScrollBottomPadding(scale, width)).toBeGreaterThan(dock.height + 50);
    }
    expect(isBloomDockRoute("notifications")).toBe(false);
    expect(isBloomDockRoute("status")).toBe(false);
  });
  it("keeps all enlarged labels and selected state rather than clipping them", () => {
    runtime.scale = 2;
    const tree = elements(BloomTabBar(fixture(undefined, "settings").props));
    const tabs = tree.filter((el) => el.props.accessibilityRole === "tab");
    expect(tabs).toHaveLength(5);
    expect(tabs.at(-1)!.props.accessibilityState).toEqual({ selected: true });
    expect(tree.filter((el) => el.type === "Text").every((el) => el.props.allowFontScaling && !el.props.numberOfLines)).toBe(true);
    const screen = elements(BloomScreen({ palette: mobileColors.light, title: "Settings", children: "Last action" }));
    expect(screen.find((el) => el.type === "ScrollView")!.props.contentContainerStyle[1].paddingBottom).toBe(getBloomScrollBottomPadding(2));
  });
  it.each([[1, 1, 5], [2, 3, 2]])("keeps declared dock rows at fractional Pixel 7 width and font scale %s", (scale, rowCount, firstRowCount) => {
    runtime.width = 411.428571;
    runtime.scale = scale;
    const tablist = elements(BloomTabBar(fixture().props)).find((el) => el.props.accessibilityRole === "tablist")!;
    const rows = React.Children.toArray(tablist.props.children) as Element[];
    expect(rows).toHaveLength(rowCount);
    expect(React.Children.count(rows[0].props.children)).toBe(firstRowCount);
    expect(rows.every((row) => row.props.style.flexWrap === "nowrap")).toBe(true);
  });
});

function ViewFixture() { return React.createElement("SceneContent"); }
const emptyData: CycleDashboardData = { hasData: false, isPartnerView: false, cycleStateV1: null, cycleStateV1Exposed: false, partnerPredictionV2Exposed: false, partnerPredictionV2CanEnsureSnapshot: false };
describe("Bloom Home presentation", () => {
  it.each(["Menstruation", "Follicular", "Ovulation", "Luteal", "Calendar estimates are paused", "Timing is uncertain", "Not enough information"])("retains public state copy and health caveats for %s", (title) => {
    const card = { title, status: title === "Menstruation" ? "Recorded" : "Calendar estimate", details: ["Server-provided detail"], ...(title === "Ovulation" ? { disclaimer: "Calendar timing is an estimate and does not confirm ovulation." } : {}) };
    const light = elements(CycleCardView({ card, palette: mobileColors.light, hero: true }));
    const dark = elements(CycleCardView({ card, palette: mobileColors.dark, hero: true }));
    expect(light.filter((el) => el.type === "Text").map((el) => text(el.props.children))).toEqual([card.status, title, ...card.details, ...(card.disclaimer ? [card.disclaimer] : [])]);
    expect(light.some((el) => el.type === "PhaseArtwork")).toBe(["Menstruation", "Follicular", "Ovulation", "Luteal"].includes(title));
    expect({ light: light.map((el) => ({ type: el.type, role: el.props.accessibilityRole, phase: el.props.phase, copy: el.type === "Text" ? text(el.props.children) : undefined })), darkSurface: dark.find((el) => el.type === "View")!.props.style[1] }).toMatchSnapshot();
  });
  it.each(["primary", "partner", "unlinked_primary"])("keeps existing role destinations for %s", (access) => {
    runtime.access = access;
    const nodes = elements(CycleDashboardView({ model: { role: access === "partner" ? "partner" : "primary", state: null, prediction: null, message: "Cycle details are not available yet." }, data: emptyData, palette: mobileColors.light }));
    const labels = nodes.map((el) => el.props.accessibilityLabel).filter(Boolean);
    expect(labels.includes("Open private chat")).toBe(access !== "unlinked_primary");
    expect(labels.includes("Invite a partner (optional)")).toBe(access === "unlinked_primary");
    expect(nodes.some((el) => el.type === "Text" && text(el.props.children).includes("Cycle details are not available yet."))).toBe(true);
  });
  it("keeps native font scaling on the shared text primitive", () => {
    const node = BloomText({ children: "A long native label" }) as Element;
    expect(node.props.allowFontScaling).toBe(true);
    expect(node.props.maxFontSizeMultiplier).toBeUndefined();
  });
});
