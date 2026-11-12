import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  access: "primary" as string,
  connection: true,
  account: { timeZone: "UTC" } as { timeZone?: string } | null | undefined,
  presence: undefined as { isPresent: boolean; expiresAt: number } | undefined,
  latest: null as null | { _id: string; senderName: string; message: string; emoji: string },
  queries: [] as unknown[],
  mutations: [] as ReturnType<typeof vi.fn>[],
  state: [] as unknown[],
  cursor: 0,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useContext: () => runtime.access,
    useEffect: () => undefined,
    useState: (initial: unknown) => {
      const index = runtime.cursor++;
      if (runtime.state.length <= index) runtime.state[index] = initial;
      return [runtime.state[index], (value: unknown) => {
        runtime.state[index] = typeof value === "function"
          ? (value as (oldValue: unknown) => unknown)(runtime.state[index])
          : value;
      }];
    },
  };
});

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: (styles: object) => styles },
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
}));

vi.mock("convex/react", () => ({
  useConvexConnectionState: () => ({ isWebSocketConnected: runtime.connection }),
  useQuery: () => runtime.queries.shift(),
  useMutation: () => runtime.mutations.shift(),
}));

import React from "react";
import { HomeNudges } from "./HomeNudges";
import { HomePainCheckIn } from "./HomePainCheckIn";
import { HomeSupport } from "./HomeSupport";

function find(
  node: React.ReactNode,
  predicate: (element: React.ReactElement) => boolean,
): React.ReactElement | undefined {
  for (const child of React.Children.toArray(node)) {
    if (!React.isValidElement(child)) continue;
    if (predicate(child)) return child;
    if (typeof child.type === "function") {
      const nested = find(
        (child.type as (props: Record<string, unknown>) => React.ReactNode)(
          child.props as Record<string, unknown>,
        ),
        predicate,
      );
      if (nested) return nested;
    }
    const nested = find(
      (child.props as { children?: React.ReactNode }).children,
      predicate,
    );
    if (nested) return nested;
  }
}

function textContent(node: React.ReactNode): string {
  return React.Children.toArray(node).map((child) => React.isValidElement(child)
    ? textContent((child.props as { children?: React.ReactNode }).children)
    : String(child)).join("");
}

function pressable(tree: React.ReactNode, label: string): React.ReactElement {
  const found = find(tree, (element) =>
    element.type === "Pressable" &&
    (element.props as { accessibilityLabel?: string }).accessibilityLabel === label,
  );
  if (!found) throw new Error(`Missing Pressable: ${label}`);
  return found;
}

function renderPain(currentPain: { score: number; tags?: readonly never[]; note?: string } | null = null) {
  runtime.cursor = 0;
  runtime.queries = [runtime.account];
  runtime.mutations = [savePain];
  return HomePainCheckIn({ currentPain, dark: false });
}

function renderNudges() {
  runtime.cursor = 0;
  runtime.queries = [runtime.presence, runtime.latest];
  runtime.mutations = [sendNudge, markSeen];
  return HomeNudges({ dark: false });
}

const savePain = vi.fn().mockResolvedValue({ logId: "pain", created: true });
const sendNudge = vi.fn().mockResolvedValue({ nudgeId: "sent" });
const markSeen = vi.fn().mockResolvedValue({ success: true });

describe("Home native interactions", () => {
  beforeEach(() => {
    runtime.access = "primary";
    runtime.connection = true;
    runtime.account = { timeZone: "UTC" };
    runtime.presence = { isPresent: false, expiresAt: 0 };
    runtime.latest = null;
    runtime.state = [];
    runtime.cursor = 0;
    for (const mutation of [savePain, sendNudge, markSeen]) {
      mutation.mockReset().mockResolvedValue({ success: true });
    }
  });

  afterEach(() => vi.useRealTimers());

  it("saves, edits, and clears the private pain note", async () => {
    let tree = renderPain();
    expect(textContent(tree)).toContain("This note stays private.");
    const note = find(tree, (element) => element.type === "TextInput" &&
      (element.props as { accessibilityLabel?: string }).accessibilityLabel === "Pain note, optional");
    expect(note).toBeDefined();
    (note!.props as { onChangeText: (value: string) => void }).onChangeText("Need a quieter evening");
    tree = renderPain();
    await (pressable(tree, "Save today’s signal").props as { onPress: () => void }).onPress();
    await Promise.resolve();
    expect(savePain).toHaveBeenLastCalledWith(expect.objectContaining({ note: "Need a quieter evening" }));

    const edited = find(renderPain(), (element) => element.type === "TextInput" &&
      (element.props as { accessibilityLabel?: string }).accessibilityLabel === "Pain note, optional");
    (edited!.props as { onChangeText: (value: string) => void }).onChangeText("Updated privately");
    tree = renderPain();
    await (pressable(tree, "Save today’s signal").props as { onPress: () => void }).onPress();
    await Promise.resolve();
    expect(savePain).toHaveBeenLastCalledWith(expect.objectContaining({ note: "Updated privately" }));

    const cleared = find(renderPain(), (element) => element.type === "TextInput" &&
      (element.props as { accessibilityLabel?: string }).accessibilityLabel === "Pain note, optional");
    (cleared!.props as { onChangeText: (value: string) => void }).onChangeText("");
    tree = renderPain();
    await (pressable(tree, "Save today’s signal").props as { onPress: () => void }).onPress();
    await Promise.resolve();
    expect(savePain.mock.calls.at(-1)?.[0]).not.toHaveProperty("note");
  });

  it("keeps pain writes disabled when the account timezone is missing", async () => {
    runtime.account = {};
    const tree = renderPain();
    expect(textContent(tree)).toContain("Account timezone is unavailable");
    expect((pressable(tree, "Save today’s signal").props as { disabled: boolean }).disabled).toBe(true);
    await (pressable(tree, "Save today’s signal").props as { onPress: () => void }).onPress();
    expect(savePain).not.toHaveBeenCalled();
  });

  it("uses the account-local date at submission time across midnight", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T23:59:59.000Z"));
    const tree = renderPain();
    const save = pressable(tree, "Save today’s signal").props as { onPress: () => void };
    vi.setSystemTime(new Date("2026-10-28T00:00:01.000Z"));
    save.onPress();
    await Promise.resolve();
    expect(savePain).toHaveBeenCalledWith(expect.objectContaining({ date: "2026-10-28", timeZone: "UTC" }));
  });

  it("keeps phase nutrition hidden with current unapproved defaults", () => {
    runtime.cursor = 0;
    runtime.mutations = [vi.fn()];
    const tree = HomeSupport({
      dark: false,
      data: {
        hasData: true,
        isPartnerView: false,
        cycleStateV1: { status: "estimated" } as never,
        cycleStateV1Exposed: true,
        partnerPredictionV2Exposed: false,
        partnerPredictionV2CanEnsureSnapshot: false,
        nutritionTipsPhase: "follicular",
        nutritionTips: [{ _id: "tip", foodItem: "Oats", reasoning: "Gentle" }],
      },
    });
    expect(textContent(tree)).not.toContain("Gentle nourishment ideas");
    expect(textContent(tree)).not.toContain("Oats");
  });

  it("does not expose a private pain note to a partner when the server hides shared pain", () => {
    runtime.cursor = 0;
    runtime.mutations = [vi.fn()];
    const tree = HomeSupport({
      dark: false,
      data: {
        hasData: true,
        isPartnerView: true,
        cycleStateV1: null,
        cycleStateV1Exposed: false,
        partnerPredictionV2Exposed: false,
        partnerPredictionV2CanEnsureSnapshot: false,
        painData: null,
      },
    });
    expect(textContent(tree)).toContain("Pain signal is private");
    expect(textContent(tree)).not.toContain("private note");
    expect(textContent(tree)).not.toContain("Pain note, optional");
  });

  it("allows linked offline-partner nudges and keeps dismiss independently accessible", async () => {
    runtime.presence = { isPresent: true, expiresAt: Date.now() - 1 };
    runtime.latest = { _id: "nudge", senderName: "Sam", message: "Thinking of you", emoji: "💗" };
    const tree = renderNudges();
    expect(textContent(tree)).toContain("Your partner is away right now");
    const send = pressable(tree, "Send nudge: Thinking of you");
    expect((send.props as { disabled: boolean }).disabled).toBe(false);

    const dismiss = pressable(tree, "Dismiss nudge");
    expect((dismiss.props as { accessibilityRole?: string }).accessibilityRole).toBe("button");
    const receivedCard = find(tree, (element) => element.type === "View" &&
      Boolean((element.props as { accessibilityLabel?: string }).accessibilityLabel?.includes("nudged you")));
    expect(receivedCard).toBeUndefined();
    await (dismiss.props as { onPress: () => void }).onPress();
    expect(markSeen).toHaveBeenCalledWith({ nudgeId: "nudge" });
  });
});
