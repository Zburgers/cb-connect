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

import { mountAppPrivacyShield, protectAppPrivacy } from "./appPrivacy";

describe("mobile privacy protection", () => {
  beforeEach(() => vi.clearAllMocks());
  const captureKey = expect.stringMatching(/^cb-connect-sensitive-screens-\d+$/);

  it("requests capture blocking for protected app content on Android", async () => {
    const release = await protectAppPrivacy("android");

    expect(capture.preventScreenCaptureAsync).toHaveBeenCalledWith(captureKey);
    expect(capture.enableAppSwitcherProtectionAsync).not.toHaveBeenCalled();

    release();
    expect(capture.allowScreenCaptureAsync).toHaveBeenCalledWith(captureKey);
  });

  it("requests capture blocking and app-switcher blur before protected content", async () => {
    const release = await protectAppPrivacy("ios");

    expect(capture.preventScreenCaptureAsync).toHaveBeenCalledWith(captureKey);
    expect(capture.enableAppSwitcherProtectionAsync).toHaveBeenCalledWith(1);

    release();
    expect(capture.allowScreenCaptureAsync).toHaveBeenCalledWith(captureKey);
    await vi.waitFor(() => expect(capture.disableAppSwitcherProtectionAsync).toHaveBeenCalledOnce());
  });

  it("does not advance to protected content when platform protection setup fails", async () => {
    capture.preventScreenCaptureAsync.mockRejectedValueOnce(new Error("native privacy control unavailable"));

    await expect(protectAppPrivacy("android")).rejects.toThrow("native privacy control unavailable");
    expect(capture.allowScreenCaptureAsync).not.toHaveBeenCalled();
  });

  it("releases partially enabled iOS protection when switcher setup fails", async () => {
    capture.enableAppSwitcherProtectionAsync.mockRejectedValueOnce(new Error("switcher control unavailable"));

    await expect(protectAppPrivacy("ios")).rejects.toThrow("switcher control unavailable");
    expect(capture.allowScreenCaptureAsync).toHaveBeenCalledWith(captureKey);
    expect(capture.disableAppSwitcherProtectionAsync).toHaveBeenCalledOnce();
  });

  it("disposes stale iOS setup when a shield unmounts before a replacement mounts", async () => {
    let finishFirstSetup!: () => void;
    capture.enableAppSwitcherProtectionAsync.mockImplementationOnce(
      () => new Promise<void>((resolve) => { finishFirstSetup = resolve; }),
    );
    const oldReady = vi.fn();
    const oldFailure = vi.fn();
    const unmountOld = mountAppPrivacyShield("ios", oldReady, oldFailure);
    await vi.waitFor(() => expect(capture.enableAppSwitcherProtectionAsync).toHaveBeenCalledOnce());
    unmountOld();

    const currentReady = vi.fn();
    const currentFailure = vi.fn();
    const unmountCurrent = mountAppPrivacyShield("ios", currentReady, currentFailure);
    expect(capture.enableAppSwitcherProtectionAsync).toHaveBeenCalledOnce();

    finishFirstSetup();
    await vi.waitFor(() => expect(currentReady).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(capture.allowScreenCaptureAsync).toHaveBeenCalledOnce());
    const [oldKey, currentKey] = capture.preventScreenCaptureAsync.mock.calls.map(([key]) => key);
    expect(oldKey).not.toBe(currentKey);
    expect(capture.allowScreenCaptureAsync).toHaveBeenCalledWith(oldKey);
    expect(oldReady).not.toHaveBeenCalled();
    expect(oldFailure).not.toHaveBeenCalled();
    expect(capture.disableAppSwitcherProtectionAsync).not.toHaveBeenCalled();

    unmountCurrent();
    await vi.waitFor(() => expect(capture.allowScreenCaptureAsync).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(capture.disableAppSwitcherProtectionAsync).toHaveBeenCalledOnce());
  });
});
