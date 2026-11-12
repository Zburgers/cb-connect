import { describe, expect, it, vi } from "vitest";

const { secureStoreTokenCache } = vi.hoisted(() => ({
  secureStoreTokenCache: {
    getToken: vi.fn(),
    saveToken: vi.fn(),
    clearToken: vi.fn(),
  },
}));

vi.mock("@clerk/expo/token-cache", () => ({ tokenCache: secureStoreTokenCache }));

import { tokenCache } from "./tokenCache";

describe("Clerk token cache boundary", () => {
  it("re-exports Clerk's Expo SecureStore token cache", () => {
    expect(tokenCache).toBe(secureStoreTokenCache);
  });
});
