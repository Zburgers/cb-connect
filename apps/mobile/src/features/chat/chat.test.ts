import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { latestUnreadPartnerMessage, orderMessagesForDisplay } from "../partner/partnerAccess";

const mobileRoot = process.cwd().endsWith("/apps/mobile")
  ? process.cwd()
  : resolve(process.cwd(), "apps/mobile");

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
    expect(source).toMatch(/remaining <= 2/);
    expect(source).toMatch(/!unread \|\| !isAtBottomRef\.current/);
    expect(source).not.toMatch(/selectable/);
  });
});
