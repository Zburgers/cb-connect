import { beforeEach, describe, expect, it, vi } from "vitest";

const capture = vi.hoisted(() => ({
  preventScreenCaptureAsync: vi.fn().mockResolvedValue(undefined),
  enableAppSwitcherProtectionAsync: vi.fn().mockResolvedValue(undefined),
  allowScreenCaptureAsync: vi.fn().mockResolvedValue(undefined),
  disableAppSwitcherProtectionAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("expo-screen-capture", () => capture);
vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  View: () => null,
}));

import { protectAppPrivacy } from "./appPrivacy";

describe("mobile privacy protection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requests capture blocking for protected app content on Android", async () => {
    const release = await protectAppPrivacy("android");

    expect(capture.preventScreenCaptureAsync).toHaveBeenCalledWith("cb-connect-sensitive-screens");
    expect(capture.enableAppSwitcherProtectionAsync).not.toHaveBeenCalled();

    release();
    expect(capture.allowScreenCaptureAsync).toHaveBeenCalledWith("cb-connect-sensitive-screens");
  });

  it("requests capture blocking and app-switcher blur before protected content", async () => {
    const release = await protectAppPrivacy("ios");

    expect(capture.preventScreenCaptureAsync).toHaveBeenCalledWith("cb-connect-sensitive-screens");
    expect(capture.enableAppSwitcherProtectionAsync).toHaveBeenCalledWith(1);

    release();
    expect(capture.allowScreenCaptureAsync).toHaveBeenCalledWith("cb-connect-sensitive-screens");
    expect(capture.disableAppSwitcherProtectionAsync).toHaveBeenCalledOnce();
  });

  it("does not advance to protected content when platform protection setup fails", async () => {
    capture.preventScreenCaptureAsync.mockRejectedValueOnce(new Error("native privacy control unavailable"));

    await expect(protectAppPrivacy("android")).rejects.toThrow("native privacy control unavailable");
    expect(capture.allowScreenCaptureAsync).not.toHaveBeenCalled();
  });
});
