import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../../../scripts/patch-picker-dialog-security.mjs", import.meta.url));
const installed = fileURLToPath(new URL("../../../node_modules/@react-native-community/datetimepicker", import.meta.url));
const javaPath = "android/src/main/java/com/reactcommunity/rndatetimepicker";
const files = ["RNDatePickerDialogFragment.java", "RNTimePickerDialogFragment.java"];
let fixture: string;
const read = (name: string) => readFileSync(join(fixture, javaPath, name), "utf8");
const run = () => execFileSync(process.execPath, [script, fixture], { encoding: "utf8", stdio: "pipe" });

describe("native picker privacy patch installation", () => {
  beforeEach(() => {
    fixture = mkdtempSync(join(tmpdir(), "cb-picker-privacy-"));
    mkdirSync(join(fixture, javaPath), { recursive: true });
    copyFileSync(join(installed, "package.json"), join(fixture, "package.json"));
    for (const name of files) {
      const source = readFileSync(join(installed, javaPath, name), "utf8");
      // CI's postinstall may already have protected the dependency. Restore
      // only this temporary fixture to the upstream input for the apply test.
      const original = source.replace(/    \/\/ CB Connect: child dialogs inherit the protected owner window\.[\s\S]*?(?=    return instance;)/, "");
      writeFileSync(join(fixture, javaPath, name), original);
    }
  });
  afterEach(() => rmSync(fixture, { recursive: true, force: true }));

  it("protects both dialogs before showing and remains idempotent", () => {
    expect(run()).toContain("2 patched");
    const protectedSources = files.map(read);
    for (const source of protectedSources) {
      expect(source).toContain("activity.getWindow().getAttributes().flags");
      expect(source.indexOf("instance.getWindow().addFlags")).toBeLessThan(source.indexOf("return instance;"));
    }
    expect(run()).toContain("0 patched");
    expect(files.map(read)).toEqual(protectedSources);
  });

  it("refuses a dependency version change without touching either source", () => {
    const before = files.map(read);
    writeFileSync(join(fixture, "package.json"), JSON.stringify({ version: "9.1.1" }));
    expect(run).toThrow("Review the Android picker privacy patch");
    expect(files.map(read)).toEqual(before);
  });

  it("refuses unexpected source before partially patching the other dialog", () => {
    writeFileSync(join(fixture, javaPath, files[1]), `${read(files[1])}\n// upstream drift\n`);
    const before = files.map(read);
    expect(run).toThrow("Unexpected Android picker source");
    expect(files.map(read)).toEqual(before);
  });
});
