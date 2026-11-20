import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { Inbox } from "./Inbox";

const inboxMocks = vi.hoisted(() => ({
  available: false as boolean | undefined,
  paginationArgs: undefined as unknown,
  results: [] as unknown[],
  mutationCalls: [] as unknown[],
  pressables: [] as Array<{ label?: string; onPress?: () => void }>,
  routes: [] as string[],
}));

vi.mock("convex/react", () => ({
  useQuery: () => inboxMocks.available,
  usePaginatedQuery: (_query: unknown, args: unknown) => {
    inboxMocks.paginationArgs = args;
    return { results: inboxMocks.results, status: "Exhausted", loadMore: () => undefined };
  },
  useMutation: () => async (args: unknown) => {
    inboxMocks.mutationCalls.push(args);
    return null;
  },
}));

vi.mock("expo-router", () => ({ useRouter: () => ({ push: (route: string) => inboxMocks.routes.push(route) }) }));

vi.mock("react-native", async () => {
  const { createElement } = await import("react");
  const native = (tag: string) => ({
    children,
    accessibilityRole,
    accessibilityLabel,
  }: {
    children?: React.ReactNode;
    accessibilityRole?: string;
    accessibilityLabel?: string;
  }) => createElement(tag, { role: accessibilityRole, "aria-label": accessibilityLabel }, children);
  return {
    ActivityIndicator: ({ accessibilityLabel }: { accessibilityLabel?: string }) =>
      createElement("span", { "aria-label": accessibilityLabel }),
    KeyboardAvoidingView: native("section"),
    Platform: { OS: "android" },
    Pressable: ({ children, accessibilityLabel, onPress }: {
      children?: React.ReactNode;
      accessibilityLabel?: string;
      onPress?: () => void;
    }) => {
      inboxMocks.pressables.push({ label: accessibilityLabel, onPress });
      return createElement("button", { "aria-label": accessibilityLabel }, children);
    },
    ScrollView: native("main"),
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
    Text: native("span"),
    useColorScheme: () => "light",
    View: native("div"),
    useWindowDimensions: () => ({ fontScale: 1, width: 390, height: 844 }),
  };
});

const source = readFileSync(new URL("./Inbox.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../../app/(app)/notifications.tsx", import.meta.url), "utf8");

describe("mobile notification inbox contract", () => {
  it("skips disabled pagination and hides stale results across OFF → ON → OFF", () => {
    inboxMocks.results = [{
      itemId: "stale-item",
      eventType: "partner_message.v1",
      templateVersion: "g4-static-v1",
      route: "messages",
      state: "current",
      createdAt: 1,
    }];

    inboxMocks.available = false;
    let markup = renderToStaticMarkup(<Inbox />);
    expect(inboxMocks.paginationArgs).toBe("skip");
    expect(markup).toContain("In-app inbox access is unavailable for this account right now.");
    expect(markup).toContain("does not reflect device notification permission or push channel availability");
    expect(markup).not.toContain("Message activity");

    inboxMocks.available = true;
    markup = renderToStaticMarkup(<Inbox />);
    expect(inboxMocks.paginationArgs).toEqual({});
    expect(markup).toContain("Message activity");
    expect(markup).toContain("Open messages");
    expect(markup).toContain("Unread");
    expect(markup).toContain("PRIVATE UPDATES");

    inboxMocks.available = false;
    markup = renderToStaticMarkup(<Inbox />);
    expect(inboxMocks.paginationArgs).toBe("skip");
    expect(markup).not.toContain("Message activity");
  });

  it("uses bounded reactive pagination and supports read, dismiss, and continuation", () => {
    expect(source).toContain("api.queries.notifications.getMyInboxAvailability");
    expect(source).toContain('available === true ? {} : "skip"');
    expect(source).toContain("available === true\n    ? items.results.filter");
    expect(source).toContain("initialNumItems: 20");
    expect(source).toContain("markMyInboxItemRead");
    expect(source).toContain("dismissMyInboxItem");
    expect(source).toContain("items.loadMore(20)");
    expect(source).toContain('router.push("/(app)/settings")');
    expect(source).toContain('router.push("/(app)/partner")');
    expect(source).toContain('router.push("/(app)/chat")');
    expect(source).toContain("You’re all caught up.");
    expect(source).toContain("Saving…");
    expect(source).not.toContain("Gate 6");
    expect(source).toContain('accessibilityLabel={`Mark ${presentation.title} as read`}');
    expect(source).toContain('accessibilityLabel={`Dismiss ${presentation.title}`}');
    expect(source).toContain('() => markRead({ itemId: item.itemId })');
    expect(source).toContain('() => dismiss({ itemId: item.itemId })');
    expect(source).toContain('presentation.destination === "settings"');
    expect(source).toContain('router.push("/(app)/settings")');
    expect(source).toContain('router.push("/(app)/partner")');
    expect(source).toContain('accessibilityLabel={`Open messages for ${presentation.title}`}');
    expect(source).toContain(">Open messages</Text>");
    expect(source).toContain('available === true && items.status !== "LoadingFirstPage" && visibleItems.length === 0');
  });

  it("calls the existing read and dismiss mutations and opens the matching destinations", () => {
    inboxMocks.available = true;
    inboxMocks.results = [
      {
        itemId: "message-item",
        eventType: "partner_message.v1",
        templateVersion: "g4-static-v1",
        route: "messages",
        state: "current",
        createdAt: 1,
      },
      {
        itemId: "nudge-item",
        eventType: "partner_nudge.v1",
        templateVersion: "g4-static-v1",
        route: "messages",
        state: "current",
        createdAt: 2,
      },
      {
        itemId: "connection-item",
        eventType: "partner_linked.v1",
        templateVersion: "g4-static-v1",
        route: "settings",
        state: "current",
        createdAt: 3,
      },
    ];
    inboxMocks.mutationCalls = [];
    inboxMocks.pressables = [];
    inboxMocks.routes = [];
    renderToStaticMarkup(<Inbox />);

    inboxMocks.pressables.find(({ label }) => label === "Mark Message activity as read")?.onPress?.();
    expect(inboxMocks.mutationCalls[0]).toEqual({ itemId: "message-item" });

    inboxMocks.pressables.find(({ label }) => label === "Dismiss Message activity")?.onPress?.();
    expect(inboxMocks.mutationCalls[1]).toEqual({ itemId: "message-item" });

    inboxMocks.pressables.find(({ label }) => label === "Open messages for Message activity")?.onPress?.();
    inboxMocks.pressables.find(({ label }) => label === "Open partner for A nudge is ready")?.onPress?.();
    inboxMocks.pressables.find(({ label }) => label === "Open settings for Connection update")?.onPress?.();
    expect(inboxMocks.routes).toEqual(["/(app)/chat", "/(app)/partner", "/(app)/settings"]);
  });

  it("keeps read state explicit and action controls reachable in large-text layouts", () => {
    inboxMocks.available = true;
    inboxMocks.results = [{ itemId: "read-item", eventType: "partner_message.v1", templateVersion: "g4-static-v1", route: "messages", state: "current", createdAt: 1, readAt: 2 }];
    const markup = renderToStaticMarkup(<Inbox />);
    expect(markup).toContain("Read");
    expect(markup).toContain("aria-label=\"Dismiss Message activity\"");
    expect(markup).toMatchSnapshot();
    expect(source).toContain("allowFontScaling");
    expect(source).toContain("minHeight: 48");
  });

  it("does not query inbox content unless the server-derived active role is available", () => {
    expect(route).toContain('access === "primary" || access === "partner" || access === "unlinked_primary" ? <Inbox />');
    expect(route).toContain('accessibilityRole="alert"');
    expect(route).toContain('accessibilityRole="header"');
    expect(route).toContain("In-app notifications are unavailable right now.");
    expect(source).not.toMatch(/console\.(log|error|warn)|error\.message/i);
  });
});
