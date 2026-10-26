import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { Inbox } from "./Inbox";

const inboxMocks = vi.hoisted(() => ({
  available: false as boolean | undefined,
  paginationArgs: undefined as unknown,
  results: [] as unknown[],
}));

vi.mock("convex/react", () => ({
  useQuery: () => inboxMocks.available,
  usePaginatedQuery: (_query: unknown, args: unknown) => {
    inboxMocks.paginationArgs = args;
    return { results: inboxMocks.results, status: "Exhausted", loadMore: () => undefined };
  },
  useMutation: () => async () => null,
}));

vi.mock("expo-router", () => ({ useRouter: () => ({ push: () => undefined }) }));

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
    Pressable: native("button"),
    ScrollView: native("main"),
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
    Text: native("span"),
    useColorScheme: () => "light",
    View: native("div"),
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
    expect(markup).toContain("The in-app inbox is unavailable right now.");
    expect(markup).not.toContain("Message activity");

    inboxMocks.available = true;
    markup = renderToStaticMarkup(<Inbox />);
    expect(inboxMocks.paginationArgs).toEqual({});
    expect(markup).toContain("Message activity");
    expect(markup).toContain("Messages unavailable");

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
    expect(source).toContain("Messages unavailable");
    expect(source).toContain("Push is not available until Gate 6");
    expect(source).toContain("device permission and channel availability are separate");
    expect(source).toContain('accessibilityLabel={`Mark ${presentation.title} as read`}');
    expect(source).toContain('accessibilityLabel={`Dismiss ${presentation.title}`}');
  });

  it("does not query inbox content unless the server-derived active role is available", () => {
    expect(route).toContain('access === "primary" || access === "partner" ? <Inbox />');
    expect(route).toContain('accessibilityRole="alert"');
    expect(route).toContain('accessibilityRole="header"');
    expect(route).toContain("In-app notifications are unavailable right now.");
    expect(source).not.toMatch(/console\.(log|error|warn)|error\.message/i);
  });
});
