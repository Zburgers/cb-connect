import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";

type PickerProps = { value: Date; onChange?: (event: DateTimePickerEvent, date?: Date) => void };

const runtime = vi.hoisted(() => ({
  state: [] as unknown[],
  cursor: 0,
  effects: [] as Array<{ deps?: readonly unknown[]; cleanup?: () => void }>,
  nativeValue: undefined as Date | undefined,
  active: undefined as PickerProps | undefined,
  declarative: undefined as PickerProps | undefined,
  declarativeCleanup: undefined as (() => void) | undefined,
  open: vi.fn(),
  dismiss: vi.fn().mockResolvedValue(true),
}));

vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = runtime.cursor++;
      if (!(index in runtime.state)) runtime.state[index] = initial;
      return [runtime.state[index], (value: unknown) => { runtime.state[index] = value; }];
    },
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
      const index = runtime.cursor++;
      const old = runtime.effects[index];
      if (old && deps && old.deps?.length === deps.length && deps.every((value, i) => Object.is(value, old.deps?.[i]))) return;
      old?.cleanup?.();
      runtime.effects[index] = { deps, cleanup: effect() || undefined };
    },
  };
});

vi.mock("react-native", () => ({
  Platform: { OS: "android" }, Pressable: "Pressable", Text: "Text", View: "View",
  StyleSheet: { create: (styles: object) => styles },
}));

vi.mock("@react-native-community/datetimepicker", () => ({
  // The pinned Android component reopens/updates its native dialog when its
  // onChange identity or value timestamp changes. Model that bridge behavior.
  default: (props: PickerProps) => {
    const old = runtime.declarative;
    if (!old || old.onChange !== props.onChange || old.value.getTime() !== props.value.getTime()) runtime.open(props);
    runtime.declarative = props;
    runtime.declarativeCleanup = () => { runtime.dismiss(); };
    return null;
  },
  DateTimePickerAndroid: { open: (props: PickerProps) => runtime.open(props), dismiss: () => runtime.dismiss() },
}));

import React from "react";
import { DateField } from "./DateField";
import { parseDateOnly, formatLocalDateOnly } from "./dateOnly";
import { mobileColors } from "../../theme/tokens";

function visit(node: React.ReactNode): React.ReactElement[] {
  return React.Children.toArray(node).flatMap((child) => {
    if (!React.isValidElement(child)) return [];
    if (typeof child.type === "function") {
      const component = child.type as (props: Record<string, unknown>) => React.ReactNode;
      return visit(component(child.props as Record<string, unknown>));
    }
    return [child, ...visit((child.props as { children?: React.ReactNode }).children)];
  });
}

function render(onChange: (value: string) => void) {
  runtime.cursor = 0;
  return visit(DateField({ label: "Corrected period start date", value: "2026-11-18", maximumDate: "2026-11-18", onChange, palette: mobileColors.light }));
}

function open(onChange: (value: string) => void) {
  const control = render(onChange).find((node) => (node.props as { accessibilityLabel?: string }).accessibilityLabel === "Corrected period start date: 2026-11-18");
  (control!.props as { onPress: () => void }).onPress();
  render(onChange);
}

describe("Android DateField selection", () => {
  beforeEach(() => {
    runtime.state = []; runtime.cursor = 0; runtime.effects = [];
    runtime.active = undefined; runtime.nativeValue = undefined; runtime.declarative = undefined; runtime.declarativeCleanup = undefined;
    runtime.dismiss.mockClear();
    runtime.open.mockReset().mockImplementation((props: PickerProps) => {
      runtime.active = props;
      runtime.nativeValue = props.value;
    });
  });

  it("keeps the selected day through a parent render until confirmation", () => {
    const changed = vi.fn();
    open((value) => changed(value));
    runtime.nativeValue = parseDateOnly("2026-11-17")!;
    render((value) => changed(value));
    expect(formatLocalDateOnly(runtime.nativeValue!)).toBe("2026-11-17");
    expect(runtime.open).toHaveBeenCalledTimes(1);
    runtime.active!.onChange!({ type: "set", nativeEvent: { timestamp: runtime.nativeValue!.getTime(), utcOffset: 0 } }, runtime.nativeValue);
    expect(changed).toHaveBeenCalledExactlyOnceWith("2026-11-17");
  });

  it("does not apply a cancelled selection and dismisses on unmount", () => {
    const changed = vi.fn();
    open(changed);
    runtime.active!.onChange!({ type: "dismissed", nativeEvent: { timestamp: 0, utcOffset: 0 } }, parseDateOnly("2026-11-17")!);
    expect(changed).not.toHaveBeenCalled();
    for (const effect of runtime.effects) effect?.cleanup?.();
    runtime.declarativeCleanup?.();
    expect(runtime.dismiss).toHaveBeenCalledOnce();
  });
});
