import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./SanctuaryShell.tsx", import.meta.url), "utf8");

describe("SanctuaryShell session control", () => {
  it("offers an accessible sign-out action and reports only a generic failure", () => {
    expect(source).toContain('import { useAuth } from "@clerk/expo";');
    expect(source).toContain('accessibilityRole="button"');
    expect(source).toContain('accessibilityLabel={isSigningOut ? "Signing out" : "Sign out"}');
    expect(source).toContain("await signOut();");
    expect(source).toContain("Unable to sign out. Please try again.");
    expect(source).not.toContain("error.message");
  });
});
