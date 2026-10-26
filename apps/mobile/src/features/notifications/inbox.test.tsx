import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./Inbox.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../../app/(app)/notifications.tsx", import.meta.url), "utf8");

describe("mobile notification inbox contract", () => {
  it("uses bounded reactive pagination and supports read, dismiss, and continuation", () => {
    expect(source).toContain("usePaginatedQuery(api.queries.notifications.getMyInbox");
    expect(source).toContain("initialNumItems: 20");
    expect(source).toContain("markMyInboxItemRead");
    expect(source).toContain("dismissMyInboxItem");
    expect(source).toContain("items.loadMore(20)");
    expect(source).toContain('router.push("/(app)/settings")');
    expect(source).toContain("Section: {presentation.route === \"settings\" ? \"Settings\" : \"Messages\"}");
    expect(source).toContain('accessibilityLabel={`Mark ${presentation.title} as read`}');
    expect(source).toContain('accessibilityLabel={`Dismiss ${presentation.title}`}');
  });

  it("does not query inbox content unless the server-derived active role is available", () => {
    expect(route).toContain('access === "primary" || access === "partner" ? <Inbox />');
    expect(source).not.toMatch(/console\.(log|error|warn)|error\.message/i);
  });
});
