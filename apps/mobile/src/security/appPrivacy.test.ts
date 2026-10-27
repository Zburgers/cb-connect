import { beforeEach, describe, expect, it, vi } from "vitest";

const capture = vi.hoisted(() => ({
  preventScreenCaptureAsync: vi.fn().mockResolvedValue(undefined),
  enableAppSwitcherProtectionAsync: vi.fn().mockResolvedValue(undefined),
  allowScreenCaptureAsync: vi.fn().mockResolvedValue(undefined),
  disableAppSwitcherProtectionAsync: vi.fn().mockResolvedValue(undefined),
}));
const lifecycle = vi.hoisted(() => ({
  listener: undefined as ((state: "active" | "background" | "inactive") => void) | undefined,
  remove: vi.fn(),
}));

vi.mock("expo-screen-capture", () => capture);
vi.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: vi.fn((_event: string, listener: typeof lifecycle.listener) => {
      lifecycle.listener = listener;
      return { remove: lifecycle.remove };
    }),
  },
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

  it("opens the privacy shield only after Android capture protection is ready", async () => {
    let enableProtection!: () => void;
    capture.preventScreenCaptureAsync.mockImplementationOnce(
      () => new Promise<void>((resolve) => { enableProtection = resolve; }),
    );
    const onReady = vi.fn();
    const onFailure = vi.fn();

    mountAppPrivacyShield("android", onReady, onFailure);
    await vi.waitFor(() => expect(capture.preventScreenCaptureAsync).toHaveBeenCalledOnce());
    expect(onReady).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();

    enableProtection();
    await vi.waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("tracks inactive and background states for the privacy curtain", () => {
    const onAppActiveChange = vi.fn();
    const unmount = mountAppPrivacyShield("android", vi.fn(), vi.fn(), onAppActiveChange);
    lifecycle.listener?.("background");
    lifecycle.listener?.("inactive");
    lifecycle.listener?.("active");

    expect(onAppActiveChange.mock.calls).toEqual([[false], [false], [true]]);
    unmount();
    expect(lifecycle.remove).toHaveBeenCalledOnce();
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
