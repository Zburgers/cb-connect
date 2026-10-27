import { describe, expect, it } from "vitest";
import type { NotificationInboxItemDTO } from "@cb-connect/contracts";
import {
  getInboxPresentation,
  getVisibleNotificationPurposes,
  isInboxItemUnread,
} from "./presentation";

const item = (eventType: NotificationInboxItemDTO["eventType"], route: NotificationInboxItemDTO["route"]): NotificationInboxItemDTO => ({
  itemId: "inbox-item",
  eventType,
  templateVersion: "g4-static-v1",
  route,
  state: "current",
  createdAt: 1,
});

describe("notification presentation privacy", () => {
  it("shows only the frozen neutral relationship labels and matching routes", () => {
    expect(getInboxPresentation(item("partner_message.v1", "messages"))?.title).toBe("Message activity");
    expect(getInboxPresentation(item("partner_message.v1", "settings"))).toBeNull();
    expect(getInboxPresentation(item("late_status.v1", "periods"))).toBeNull();
    expect(getInboxPresentation(item("pain_check_in.v1", "pain"))).toBeNull();
    expect(getInboxPresentation({ ...item("partner_message.v1", "messages"), templateVersion: "g4-static-v3" })).toBeNull();
  });

  it("presents unread only until the server receipt has a read timestamp", () => {
    const message = item("partner_message.v1", "messages");
    expect(isInboxItemUnread(message)).toBe(true);
    expect(isInboxItemUnread({ ...message, readAt: 2 })).toBe(false);
  });

  it("keeps primary-only health notification preferences out of partner settings", () => {
    expect(getVisibleNotificationPurposes("partner")).not.toContain("pain_check_in");
    expect(getVisibleNotificationPurposes("partner")).not.toContain("late_status");
    expect(getVisibleNotificationPurposes("primary")).toContain("pain_check_in");
  });
});
