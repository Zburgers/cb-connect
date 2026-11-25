#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(mobileRoot, "../..");
const profile = process.argv[2];
if (!["synthetic", "production"].includes(profile)) {
  throw new Error("Usage: node scripts/build-android-release.mjs synthetic|production");
}
const targets = JSON.parse(readFileSync(resolve(mobileRoot, "src/auth/targets.json"), "utf8"));
const target = targets[profile];
const prefix = profile === "production" ? "pk_live_" : "pk_test_";
const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const encoded = key.slice(prefix.length);
if (!key.startsWith(prefix) || !/^[A-Za-z0-9_-]+$/.test(encoded) || encoded.length % 4 === 1 ||
    Buffer.from(encoded, "base64url").toString("utf8") !== `${target.issuer}$` ||
    process.env.EXPO_PUBLIC_CONVEX_URL !== target.convexUrl) {
  throw new Error("Release public settings do not match the selected profile");
}
for (const name of ["CB_ANDROID_RELEASE_KEYSTORE", "CB_ANDROID_RELEASE_STORE_PASSWORD", "CB_ANDROID_RELEASE_ALIAS", "CB_ANDROID_RELEASE_KEY_PASSWORD"]) {
  if (!process.env[name]?.trim()) throw new Error(`Missing ${name}`);
}
if (!process.env.ANDROID_HOME || !process.env.JAVA_HOME) throw new Error("Select the documented Android SDK and JDK first");
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=all", "--", "apps/mobile", "packages/contracts"], { cwd: root, encoding: "utf8" }).trim();
if (dirty) throw new Error("Commit mobile source before building an identified release");
const env = { ...process.env, EXPO_NO_DOTENV: "1", EXPO_PUBLIC_MOBILE_ENVIRONMENT: profile };
const run = (file, args, cwd = mobileRoot) => execFileSync(file, args, { cwd, env, stdio: "inherit" });
run(process.execPath, ["scripts/patch-picker-dialog-security.mjs"]);
// Prebuild updates the ignored native project; do not remove an active QA install.
run("npx", ["expo", "prebuild", "--platform", "android", "--no-install"]);
run("./gradlew", ["assembleRelease", "-PreactNativeArchitectures=arm64-v8a,x86_64", "--no-daemon", "--console=plain"], resolve(mobileRoot, "android"));
const builtApk = resolve(mobileRoot, "android/app/build/outputs/apk/release/app-release.apk");
const signer = resolve(process.env.ANDROID_HOME, "build-tools/36.0.0/apksigner");
run(signer, ["verify", "--verbose", "--print-certs", builtApk]);
const outputDir = resolve(root, "build/mobile", profile, sourceSha.slice(0, 12));
mkdirSync(outputDir, { recursive: true });
const name = `cb-connect-${profile}-${sourceSha.slice(0, 12)}.apk`;
const outputApk = resolve(outputDir, name);
copyFileSync(builtApk, outputApk);
const sha256 = createHash("sha256").update(readFileSync(outputApk)).digest("hex");
writeFileSync(resolve(outputDir, `${name}.sha256`), `${sha256}  ${name}\n`);
writeFileSync(resolve(outputDir, "manifest.json"), JSON.stringify({
  sourceSha, profile, filename: name, sha256, clerkIssuer: target.issuer,
  convexUrl: target.convexUrl, architectures: ["arm64-v8a", "x86_64"],
  builtAt: new Date().toISOString(), qualification: "PENDING — inspect embedded config and run final APK checklist before delivery",
}, null, 2));
console.log(`Standalone signed APK: ${outputApk}\nSHA-256: ${sha256}`);
