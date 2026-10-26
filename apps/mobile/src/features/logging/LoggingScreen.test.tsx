import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  access: "primary" as string,
  connection: true,
  periods: [] as unknown[],
  pain: [] as unknown[],
  queries: [] as unknown[],
  mutations: [] as unknown[],
  state: [] as unknown[],
  cursor: 0,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useContext: () => runtime.access,
    useMemo: (factory: () => unknown) => factory(),
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
  ScrollView: "ScrollView",
  StyleSheet: { create: (styles: object) => styles },
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
  useColorScheme: () => "light",
}));

vi.mock("convex/react", () => ({
  useConvexConnectionState: () => ({ isWebSocketConnected: runtime.connection }),
  useQuery: () => runtime.queries.shift(),
  useMutation: () => runtime.mutations.shift(),
}));

import React from "react";
import { LoggingScreen } from "./LoggingScreen";

const startSelf = vi.fn().mockResolvedValue({ eventId: "event-new" });
const endSelf = vi.fn().mockResolvedValue({ eventId: "event-open" });
const startAssist = vi.fn().mockResolvedValue({ eventId: "event-new" });
const endAssist = vi.fn().mockResolvedValue({ eventId: "event-open" });
const updateSelf = vi.fn().mockResolvedValue({ success: true as const });
const updateAssist = vi.fn().mockResolvedValue({ eventId: "event-corrected" });
const savePain = vi.fn().mockResolvedValue({ logId: "pain-log", created: true });

function render() {
  runtime.cursor = 0;
  runtime.queries = [runtime.periods, runtime.pain];
  runtime.mutations = [startSelf, endSelf, startAssist, endAssist, updateSelf, updateAssist, savePain];
  return LoggingScreen();
}

function find(node: React.ReactNode, predicate: (element: React.ReactElement) => boolean): React.ReactElement | undefined {
  for (const child of React.Children.toArray(node)) {
    if (!React.isValidElement(child)) continue;
    if (predicate(child)) return child;
    if (typeof child.type === "function") {
      const renderComponent = child.type as (props: Record<string, unknown>) => React.ReactNode;
      const nested = find(renderComponent(child.props as Record<string, unknown>), predicate);
      if (nested) return nested;
    }
    const nested = find((child.props as { children?: React.ReactNode }).children, predicate);
    if (nested) return nested;
  }
}

function button(tree: React.ReactNode, label: string) {
  const found = find(tree, (element) => element.type === "Pressable" && (element.props as { accessibilityLabel?: string }).accessibilityLabel === label);
  if (!found) throw new Error(`Missing button: ${label}`);
  return (found.props as { onPress: () => Promise<void> }).onPress;
}

function input(tree: React.ReactNode, label: string) {
  const found = find(tree, (element) => element.type === "TextInput" && (element.props as { accessibilityLabel?: string }).accessibilityLabel === label);
  if (!found) throw new Error(`Missing input: ${label}`);
  return (found.props as { onChangeText: (value: string) => void }).onChangeText;
}

function textContent(node: React.ReactNode): string {
  return React.Children.toArray(node).map((child) => React.isValidElement(child)
    ? textContent((child.props as { children?: React.ReactNode }).children)
    : String(child)).join("");
}

const openPeriod = [{
  _id: "event-open",
  authorityVersion: 1,
  startDate: "2026-10-20",
  certainty: "exact",
  source: "self",
  confirmationStatus: "confirmed",
  createdByName: "You",
  canCorrect: true,
}];

describe("LoggingScreen actions", () => {
  beforeEach(() => {
    runtime.access = "primary";
    runtime.connection = true;
    runtime.periods = [];
    runtime.pain = [];
    runtime.queries = [runtime.periods, runtime.pain];
    runtime.state = [];
    runtime.cursor = 0;
    for (const mutation of [startSelf, endSelf, startAssist, endAssist, updateSelf, updateAssist, savePain]) {
      mutation.mockReset().mockResolvedValue({ eventId: "event" });
    }
  });

  it("reports end confirmation and omits the device timezone when closing a saved open period", async () => {
    runtime.periods = openPeriod;
    runtime.queries = [runtime.periods, []];
    const tree = render();
    await button(tree, "Confirm end")();

    expect(endSelf).toHaveBeenCalledWith(expect.objectContaining({
      periodEventId: "event-open",
      endDate: expect.any(String),
      expectedAuthorityVersion: 1,
    }));
    expect(endSelf.mock.calls[0][0]).not.toHaveProperty("timeZone");
    expect(textContent(render())).toContain("Period end confirmed.");
  });

  it("reports a partial start/end write without claiming the end was saved", async () => {
    endSelf.mockRejectedValueOnce(new Error("EXACT_INTERVAL_OVERLAP"));
    const tree = render();
    input(tree, "Optional period end date, YYYY-MM-DD")("2026-10-24");
    const ready = render();
    await button(ready, "Save period")();

    expect(startSelf).toHaveBeenCalledOnce();
    expect(endSelf).toHaveBeenCalledOnce();
    expect(textContent(render())).toContain("The start was saved as open, but its end was not saved.");
  });

  it("does not replace the account timezone when the device timezone differs", async () => {
    const originalTimeZone = process.env.TZ;
    process.env.TZ = "Pacific/Kiritimati";
    try {
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("Pacific/Kiritimati");
      const savedAccountTimeZone = "America/Los_Angeles";
      expect(savedAccountTimeZone).not.toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);

      const tree = render();
      input(tree, "Pain log date, YYYY-MM-DD")("2026-01-02");
      input(render(), "Pain score from 0 to 10")("6");
      await button(render(), "Save pain log")();

      expect(savePain).toHaveBeenCalledWith({ date: "2026-01-02", painScore: 6, tags: [] });
      expect(savePain.mock.calls[0][0]).not.toHaveProperty("timeZone");
    } finally {
      if (originalTimeZone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimeZone;
    }
  });

  it("shows the stale correction failure and does not replace it with success", async () => {
    runtime.periods = openPeriod;
    runtime.queries = [runtime.periods, []];
    updateSelf.mockRejectedValueOnce(new Error("STALE_AUTHORITY_VERSION"));
    await button(render(), "Correct period")();
    await button(render(), "Save correction")();

    expect(textContent(render())).toContain("This entry changed. Refresh history before correcting it.");
    expect(textContent(render())).not.toContain("Period correction saved.");
  });
});
