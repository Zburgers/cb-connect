import { beforeEach, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { latestUnreadPartnerMessage, orderMessagesForDisplay } from "../partner/partnerAccess";

const runtime = vi.hoisted(() => ({
  hookIndex: 0,
  states: [] as unknown[],
  refs: [] as Array<{ current: unknown }>,
  mutationIndex: 0,
  mutations: [] as Array<(...args: never[]) => unknown>,
  connected: true,
  alert: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: <T,>(initial: T | (() => T)): [T, (value: T | ((previous: T) => T)) => void] => {
      const index = runtime.hookIndex++;
      if (runtime.states.length <= index) runtime.states[index] = typeof initial === "function" ? (initial as () => T)() : initial;
      return [runtime.states[index] as T, (value) => {
        runtime.states[index] = typeof value === "function" ? (value as (previous: T) => T)(runtime.states[index] as T) : value;
      }];
    },
    useRef: <T,>(initial: T) => {
      const index = runtime.hookIndex++;
      if (!runtime.refs[index]) runtime.refs[index] = { current: initial };
      return runtime.refs[index] as { current: T };
    },
    useCallback: <T,>(callback: T) => callback,
    useLayoutEffect: () => undefined,
  };
});

vi.mock("react-native", () => ({
  Alert: { alert: (...args: unknown[]) => runtime.alert(...args) },
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: { create: (styles: object) => styles, hairlineWidth: 1 },
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
}));

vi.mock("expo-router", () => ({ useFocusEffect: () => undefined }));
vi.mock("convex/react", () => ({
  usePaginatedQuery: () => ({ results: [], status: "Exhausted", loadMore: vi.fn() }),
  useMutation: () => runtime.mutations[runtime.mutationIndex++],
  useConvexConnectionState: () => ({ isWebSocketConnected: runtime.connected }),
}));

import React from "react";
import { CoupleChat } from "./CoupleChat";

const mobileRoot = process.cwd().endsWith("/apps/mobile")
  ? process.cwd()
  : resolve(process.cwd(), "apps/mobile");

type Element = React.ReactElement<Record<string, unknown>>;

function renderChat(): Element[] {
  runtime.hookIndex = 0;
  runtime.mutationIndex = 0;
  const tree = CoupleChat({ relationshipGeneration: "membership-7" });
  const elements: Element[] = [];
  const visit = (node: React.ReactNode): void => {
    for (const child of React.Children.toArray(node)) {
      if (!React.isValidElement(child)) continue;
      const element = child as Element;
      elements.push(element);
      visit(element.props.children as React.ReactNode);
    }
  };
  visit(tree);
  return elements;
}

function button(elements: Element[], label: string): { onPress: () => unknown } {
  const element = elements.find((item) => item.type === "Pressable" && item.props.accessibilityLabel === label);
  if (!element) throw new Error(`Missing button ${label}`);
  return element.props as { onPress: () => unknown };
}

function input(elements: Element[]): {
  value: string;
  selection: { start: number; end: number };
  onChangeText: (value: string) => void;
  onSelectionChange: (event: { nativeEvent: { selection: { start: number; end: number } } }) => void;
} {
  const element = elements.find((item) => item.type === "TextInput");
  if (!element) throw new Error("Missing message composer");
  return element.props as {
    value: string;
    selection: { start: number; end: number };
    onChangeText: (value: string) => void;
    onSelectionChange: (event: { nativeEvent: { selection: { start: number; end: number } } }) => void;
  };
}

beforeEach(() => {
  runtime.hookIndex = 0;
  runtime.states = [];
  runtime.refs = [];
  runtime.mutationIndex = 0;
  runtime.connected = true;
  runtime.alert.mockReset();
  runtime.mutations = [vi.fn().mockResolvedValue("message-1"), vi.fn().mockResolvedValue({}), vi.fn().mockResolvedValue({ clearedAt: 123 }), vi.fn().mockResolvedValue({}), vi.fn().mockResolvedValue({})];
});

describe("mobile private chat pagination and receipts", () => {
  test("older pages append before newer messages in display order", () => {
    const newestFirst = ["page-1-newest", "page-1-older", "page-2-newest", "page-2-older"];
    expect(orderMessagesForDisplay(newestFirst)).toEqual([
      "page-2-older",
      "page-2-newest",
      "page-1-older",
      "page-1-newest",
    ]);
  });

  test("receipt advances only through the latest unread incoming message", () => {
    const messages = [
      { id: "newest-incoming", isMine: false, readAt: null },
      { id: "older-incoming", isMine: false, readAt: null },
    ];
    expect(latestUnreadPartnerMessage(messages, true)?.id).toBe("newest-incoming");
  });

  test("a newer outgoing message does not acknowledge an older unread incoming message", () => {
    expect(latestUnreadPartnerMessage([
      { id: "newest-mine", isMine: true, readAt: null },
      { id: "older-incoming", isMine: false, readAt: null },
    ], true)).toBeNull();
  });

  test("already-read incoming messages do not trigger another receipt", () => {
    expect(latestUnreadPartnerMessage([{ isMine: false, readAt: 123 }], true)).toBeNull();
  });

  test("scroll position gates read receipts and the initial view scrolls to latest", () => {
    const unread = [{ isMine: false, readAt: null }];
    expect(latestUnreadPartnerMessage(unread, false)).toBeNull();
    expect(latestUnreadPartnerMessage(unread, true)).toBe(unread[0]);
    const source = readFileSync(resolve(mobileRoot, "src/features/chat/CoupleChat.tsx"), "utf8");
    expect(source).toMatch(/scrollToEnd\(\{ animated: false \}\)/);
    expect(source).toMatch(/useLayoutEffect/);
    expect(source).toContain('import { useFocusEffect } from "expo-router"');
    expect(source).toMatch(/useFocusEffect\(useCallback\(\(\) => \{/);
    expect(source).not.toMatch(/useIsFocused/);
    expect(source).toMatch(/remaining <= 2/);
    expect(source).toMatch(/!unread \|\| !isAtBottomRef\.current/);
    expect(source).not.toMatch(/selectable/);
  });

  test("dedicated chat page keeps every conversation generation isolated", () => {
    const source = readFileSync(resolve(mobileRoot, "src/app/(app)/chat.tsx"), "utf8");
    expect(source).toContain('access === "primary" || access === "partner"');
    expect(source).toContain('guard?.couple?.role === access');
    expect(source).toContain('couple.role === access');
    expect(source).toContain('key={couple.relationshipGeneration}');
    expect(source).not.toMatch(/messages\.clear/);
  });

  test("chat distinguishes private ownership and uses the active theme surfaces", () => {
    const source = readFileSync(resolve(mobileRoot, "src/features/chat/CoupleChat.tsx"), "utf8");
    expect(source).toContain('message.isMine ? "You" : message.senderName');
    expect(source).toContain("backgroundColor: message.isMine ? palette.highlight : palette.surface");
    expect(source).toContain("palette.border");
  });
});

describe("mobile private chat composer interactions", () => {
  test("quick-compose suggestions fill the draft without sending", () => {
    let elements = renderChat();

    const suggestions = elements.find((element) => element.type === "ScrollView" &&
      (element.props as { horizontal?: boolean }).horizontal);
    expect(suggestions?.props).toMatchObject({ keyboardShouldPersistTaps: "handled" });

    button(elements, "Compose Thinking of you.").onPress();
    elements = renderChat();

    expect(input(elements).value).toBe("Thinking of you.");
    expect(runtime.mutations[0]).not.toHaveBeenCalled();
  });

  test("sending a quick-compose suggestion submits only after Send is pressed", () => {
    let elements = renderChat();
    button(elements, "Compose Thinking of you.").onPress();
    elements = renderChat();
    button(elements, "Send message").onPress();

    expect(runtime.mutations[0]).toHaveBeenCalledWith({ body: "Thinking of you." });
  });

  test("emoji input replaces the selected draft text and advances the cursor", () => {
    let elements = renderChat();
    button(elements, "Compose Thinking of you.").onPress();
    elements = renderChat();
    input(elements).onSelectionChange({ nativeEvent: { selection: { start: 4, end: 7 } } });
    elements = renderChat();
    button(elements, "Add emoji").onPress();
    elements = renderChat();
    button(elements, "Insert 💗").onPress();
    elements = renderChat();

    expect(input(elements).value).toBe("Thin💗g of you.");
    expect(input(elements).selection).toEqual({ start: 6, end: 6 });
  });

  test("emoji input preserves the draft at the 500-character limit", () => {
    let elements = renderChat();
    input(elements).onChangeText("x".repeat(500));
    elements = renderChat();
    input(elements).onSelectionChange({ nativeEvent: { selection: { start: 500, end: 500 } } });
    elements = renderChat();
    button(elements, "Add emoji").onPress();
    elements = renderChat();
    button(elements, "Insert 💗").onPress();
    elements = renderChat();

    expect(input(elements).value).toBe("x".repeat(500));
  });

  test("canceling clear confirmation leaves the thread unchanged", () => {
    const elements = renderChat();
    button(elements, "Clear chat").onPress();
    const [, , actions] = runtime.alert.mock.calls[0] as [string, string, Array<{ text: string; onPress?: () => void }>];
    actions[0].onPress?.();

    expect(runtime.mutations[2]).not.toHaveBeenCalled();
  });

  test("confirmed clear submits the generation shown by the active chat", () => {
    const elements = renderChat();
    button(elements, "Clear chat").onPress();
    const [, , actions] = runtime.alert.mock.calls[0] as [string, string, Array<{ text: string; onPress?: () => void }>];
    actions[1].onPress?.();

    expect(runtime.mutations[2]).toHaveBeenCalledWith({ relationshipGeneration: "membership-7" });
  });

  test("clear confirmation rejects a connection lost while the alert is open", () => {
    const elements = renderChat();
    button(elements, "Clear chat").onPress();
    const [, , actions] = runtime.alert.mock.calls[0] as [string, string, Array<{ text: string; onPress?: () => void }>];
    runtime.connected = false;
    renderChat();
    actions[1].onPress?.();
    const afterConfirm = renderChat();

    expect(runtime.mutations[2]).not.toHaveBeenCalled();
    expect(JSON.stringify(afterConfirm.map((element) => element.props.children))).toContain("Reconnect before clearing chat.");
  });
});
