import { defineConfig } from "vitest/config";

// Do not inherit the web app's Edge Runtime test configuration.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
