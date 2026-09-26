import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAuthEnvironment } from "../e2e/support/authEnvironment";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv") as {
  parse(source: string | Buffer): Record<string, string>;
};
const separatorIndex = process.argv.indexOf("--");
const command = process.argv[separatorIndex + 1];
if (separatorIndex < 0 || !command) {
  throw new Error("Usage: with-auth-test-env -- <command> [args...]");
}

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = resolve(repositoryRoot, ".env.auth-test.local");
const config = dotenv.parse(readFileSync(configPath));
const environment: NodeJS.ProcessEnv = {
  ...process.env,
  ...Object.fromEntries(
    [
      "CLERK_TEST_ENVIRONMENT_NAME",
      "CLERK_TEST_SECRET_KEY",
      "NEXT_PUBLIC_CLERK_TEST_PUBLISHABLE_KEY",
      "CLERK_TEST_FRONTEND_API_URL",
      "CONVEX_TEST_DEPLOY_KEY",
      "CONVEX_TEST_DEPLOYMENT",
      "NEXT_PUBLIC_TEST_CONVEX_URL",
      "NEXT_PUBLIC_TEST_CONVEX_SITE_URL",
      "CB_CONNECT_RELEASE_RUN_ID",
      "CB_CONNECT_RELEASE_AUTH_DIR",
      "CB_CONNECT_RELEASE_EVIDENCE_DIR",
      "PLAYWRIGHT_BASE_URL",
      "PLAYWRIGHT_EXECUTABLE_PATH",
    ]
      .filter((key) => config[key] !== undefined)
      .map((key) => [key, config[key]]),
  ),
  CB_CONNECT_RELEASE_RUN_ID:
    config.CB_CONNECT_RELEASE_RUN_ID?.trim() ||
    `local-${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${randomUUID().slice(0, 8)}`,
};

for (const key of [
  "CLERK_SECRET_KEY",
  "CLERK_FRONTEND_API_URL",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_CONVEX_URL",
  "CONVEX_DEPLOYMENT",
  "CONVEX_DEPLOY_KEY",
]) {
  delete environment[key];
}

if (
  config.CONVEX_TEST_DEPLOY_KEY?.startsWith(
    "dev:hallowed-hummingbird-284|",
  ) !== true
) {
  throw new Error("Missing approved target-bound test Convex credential");
}
if (
  config.NEXT_PUBLIC_TEST_CONVEX_SITE_URL !==
  "https://hallowed-hummingbird-284.convex.site"
) {
  throw new Error("Test Convex site URL does not match the approved deployment");
}

loadAuthEnvironment(environment);
environment.CONVEX_DEPLOY_KEY = config.CONVEX_TEST_DEPLOY_KEY;
environment.CB_CONNECT_CONVEX_CREDENTIAL_CLASS = "test";
delete environment.CONVEX_DEPLOYMENT;

const result = spawnSync(command, process.argv.slice(separatorIndex + 2), {
  cwd: repositoryRoot,
  env: environment,
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
