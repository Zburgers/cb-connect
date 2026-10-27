import { describe, expect, it } from "vitest";
import { isThemeMode, toAppearanceScheme } from "./themePreference";

describe("theme preference", () => {
  it("accepts only the supported saved modes", () => {
    expect(isThemeMode("system")).toBe(true);
    expect(isThemeMode("light")).toBe(true);
    expect(isThemeMode("dark")).toBe(true);
    expect(isThemeMode(null)).toBe(false);
    expect(isThemeMode("sepia")).toBe(false);
  });

  it("restores the device appearance for System", () => {
    expect(toAppearanceScheme("system")).toBe("unspecified");
    expect(toAppearanceScheme("light")).toBe("light");
    expect(toAppearanceScheme("dark")).toBe("dark");
  });
});
