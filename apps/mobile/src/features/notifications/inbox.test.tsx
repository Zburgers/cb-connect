import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./Inbox.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../../app/(app)/notifications.tsx", import.meta.url), "utf8");

describe("mobile notification inbox contract", () => {
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
