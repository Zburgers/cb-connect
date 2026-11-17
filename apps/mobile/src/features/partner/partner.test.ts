import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, test } from "vitest";

import {
  canLoadPartnerCycleProjection,
  canRenderPartnerViews,
} from "./partnerAccess";
import { getFreshPairingCode, normalizePairingCode, normalizeNickname, syncPartnerDrafts } from "./partnerDetails";

const mobileRoot = process.cwd().endsWith("/apps/mobile")
  ? process.cwd()
  : resolve(process.cwd(), "apps/mobile");

function pressableAccessibility(source: string) {
  const file = ts.createSourceFile("controls.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const elements: Array<{ role: boolean; label: boolean }> = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (node.tagName.getText(file) === "Pressable") {
        const names = node.attributes.properties.map((attribute) =>
          ts.isJsxAttribute(attribute) ? attribute.name.getText(file) : "",
        );
        elements.push({ role: names.includes("accessibilityRole"), label: names.includes("accessibilityLabel") });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return elements;
}

describe("mobile partner access and accessibility", () => {
  test.each([
    [" abc123 ", "ABC123"],
    [" abcd 1234 efgh ", "ABCD1234EFGH"],
    ["invalid", null],
    ["12345", null],
    ["1234567", null],
    ["1234567890123", null],
  ])("normalizes pairing input %j", (input, expected) => {
    expect(normalizePairingCode(input)).toBe(expected);
  });

  test("normalizes a viewer's private nickname without exceeding the server limit", () => {
    expect(normalizeNickname("  My   Partner  ")).toBe("My Partner");
    expect(normalizeNickname(" ")).toBe("");
    expect(normalizeNickname("x".repeat(41))).toBeNull();
  });

  test("expires generated and cached server pairing codes against the same clock", () => {
    const expired = { code: "ABC123", expiresAt: 1_000 };
    expect(getFreshPairingCode(expired, expired, 1_001)).toBeNull();
    expect(getFreshPairingCode(expired, { code: "DEF456", expiresAt: 2_000 }, 1_001)).toEqual({ code: "DEF456", expiresAt: 2_000 });
    expect(getFreshPairingCode(null, expired, 999)).toEqual(expired);
  });

  test("syncing a server date does not overwrite an unrelated nickname draft", () => {
    const draft = { connectedSinceDate: "2020-01-01", partnerNickname: "Unsaved nickname" };
    expect(syncPartnerDrafts(draft, { connectedSinceDate: "2021-02-02" })).toEqual({
      connectedSinceDate: "2021-02-02",
      partnerNickname: "Unsaved nickname",
    });
    expect(syncPartnerDrafts(draft, { partnerNickname: "Server nickname" })).toEqual({
      connectedSinceDate: "2020-01-01",
      partnerNickname: "Server nickname",
    });
  });

  test.each([
    ["primary", "primary", true, false, true],
    ["partner", "partner", true, false, true],
    ["unlinked", "partner", false, false, false],
    ["primary", "primary", false, false, false],
    ["primary", "primary", true, true, false],
  ] as const)("partner view access follows current relationship state", (access, role, active, revoking, expected) => {
    expect(canRenderPartnerViews(access, role, active, revoking)).toBe(expected);
  });

  test("partner cycle projection is queried only with active phase sharing", () => {
    expect(canLoadPartnerCycleProjection("partner", "partner", true, true)).toBe(true);
    expect(canLoadPartnerCycleProjection("partner", "partner", true, false)).toBe(false);
    expect(canLoadPartnerCycleProjection("unlinked", "partner", true, true)).toBe(false);
    expect(canLoadPartnerCycleProjection("partner", "primary", true, true)).toBe(false);
  });

  test("active private partner views are keyed and gated by the server relationship generation", () => {
    const source = readFileSync(resolve(mobileRoot, "src/features/partner/PartnerControls.tsx"), "utf8");
    expect(source).toMatch(/activeView && role && hasRelationshipGeneration\(couple\)/);
    expect(source).toMatch(/ActivePartnerView key=\{couple\.relationshipGeneration\}/);
  });

  test("partner controls expose native copy/share, relationship date and private nickname actions", () => {
    const source = readFileSync(resolve(mobileRoot, "src/features/partner/PartnerControls.tsx"), "utf8");
    expect(source).toContain("Clipboard.setStringAsync");
    expect(source).toContain("Share.share");
    expect(source).toContain("Relationship date");
    expect(source).toContain("Partner nickname");
    expect(source).toContain("updateConnectedSinceDate");
    expect(source).toContain("updatePartnerNickname");
    expect(source).toContain("Expires");
    expect(source).toContain("Pairing code expired.");
  });

  test.each([
    ["features/partner/PartnerControls.tsx", "partner controls"],
    ["features/chat/CoupleChat.tsx", "private chat"],
  ])("every %s action exposes an accessible role and label", (path) => {
    const source = readFileSync(resolve(mobileRoot, "src", path), "utf8");
    const elements = pressableAccessibility(source);
    expect(elements.length).toBeGreaterThan(0);
    expect(elements.every(({ role, label }) => role && label)).toBe(true);
    expect(source).toMatch(/accessibilityLabel=/);
  });

  test("mobile chat clears only with the current relationship generation", () => {
    const source = readFileSync(resolve(mobileRoot, "src/features/chat/CoupleChat.tsx"), "utf8");
    expect(source).toContain("api.mutations.messages.clear");
    expect(source).toContain("clearThread({ relationshipGeneration })");
    expect(source).toContain("Clear this chat?");
  });

  test("sharing controls explain consent scope and show the current server setting state", () => {
    const source = readFileSync(resolve(mobileRoot, "src/features/partner/PartnerControls.tsx"), "utf8");
    expect(source).toContain("Choose what your partner can see or add.");
    expect(source).toContain('value ? "On" : "Off"');
    expect(source).toContain("palette.highlight");
    expect(source).toContain("await sharing({ [key]: value })");
  });
});
