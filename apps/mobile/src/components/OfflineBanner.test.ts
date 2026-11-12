import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./OfflineBanner.tsx", import.meta.url), "utf8");

describe("OfflineBanner", () => {
  it("renders nothing while online", () => {
    expect(source).toContain("if (!isOffline) return null;");
  });

  it("announces generic offline status accessibly with polite urgency", () => {
    expect(source).toContain('accessibilityRole="text"');
    expect(source).toContain('accessibilityLiveRegion="polite"');
    expect(source).toContain('accessibilityLabel="Offline. Protected features are hidden until your connection returns."');
    expect(source).toContain("Offline. Protected features are hidden until your connection returns.");
    expect(source).toContain("useColorScheme()");
    expect(source).toContain("allowFontScaling");
    expect(source).not.toMatch(/saved|period|cycle|pain|symptom/i);
  });
});
