/// <reference types="vite/client" />

export const modules = import.meta.glob([
  "./**/*.{ts,js}",
  "!./**/*.test.ts",
  "!./test.fixtures.ts",
  "!./test.setup.ts",
]);
