import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./Settings.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../../app/(app)/settings.tsx", import.meta.url), "utf8");

describe("mobile settings privacy and accessibility", () => {
  it("keeps pause, context, and sharing controls primary-private", () => {
    expect(source).toContain("{isPrimary ? (");
    expect(source).toContain("Private prediction controls");
    expect(source).toContain("Start private context at");
    expect(source).toContain("Sharing");
    expect(source).toContain("updateSharing(args)");
    expect(source).toContain('getPredictionSegmentOptions, isPrimary ? {} : "skip"');
    expect(route).toContain('access === "primary" || access === "partner" ? <Settings />');
  });

  it("uses the role-specific preference contract and accessible switches", () => {
    expect(source).toContain("getVisibleNotificationPurposes");
    expect(source).toContain('accessibilityRole="switch"');
    expect(source).toContain('accessibilityRole="button"');
    expect(source).toContain("Push notifications are not available yet.");
    expect(source).not.toContain("Gate 6");
  });

  it("does not offer account erasure while D-012 is unresolved or expose mutation errors", () => {
    expect(source).toContain("Account deletion is unavailable until the retention and deletion policy is approved.");
    expect(source).not.toMatch(/error\.message|console\.(log|error|warn)/i);
  });
});
