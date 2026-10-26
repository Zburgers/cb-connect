import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, test } from "vitest";

import {
  canLoadPartnerCycleProjection,
  canRenderPartnerViews,
} from "./partnerAccess";

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

  test("mobile chat never exposes the global history clear mutation", () => {
    const source = readFileSync(resolve(mobileRoot, "src/features/chat/CoupleChat.tsx"), "utf8");
    expect(source).not.toMatch(/messages\.clear/);
  });
});
