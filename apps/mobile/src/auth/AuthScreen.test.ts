import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./AuthScreen.tsx", import.meta.url), "utf8");

describe("native hosted auth entry point", () => {
  it("awaits Clerk Expo hosted sign-in or sign-up so failures reach the screen", () => {
    expect(source).toContain('import { useHostedAuth } from "@clerk/expo/hosted-auth";');
    expect(source).toContain("const { startHostedAuth } = useHostedAuth();");
    expect(source).toContain(
      'await startHostedAuth({ mode: isSignIn ? "sign-in" : "sign-up" });',
    );
    expect(source).not.toMatch(/clerk\.openSign(?:In|Up)/);
  });
});
