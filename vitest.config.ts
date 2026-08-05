import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: [
      "convex/**/*.test.ts",
      "app/**/*.test.ts",
      "lib/**/*.test.ts",
      "e2e/**/*.test.ts",
    ],
  },
});
