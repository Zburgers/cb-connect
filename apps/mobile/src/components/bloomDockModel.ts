export const bloomDockNames = ["index", "log", "chat", "partner", "settings"] as const;

export function getBloomDockGeometry(width: number, fontScale: number, count: number) {
  const largeText = fontScale >= 1.6;
  const dockWidth = Math.max(0, Math.min(560, width - 32));
  const minItemWidth = largeText ? Math.max(48, Math.ceil(64 * fontScale)) : 48;
  const columns = Math.max(1, Math.min(count, largeText ? 2 : count, Math.max(1, Math.floor((dockWidth - 14) / minItemWidth))));
  const itemHeight = largeText ? Math.max(56, Math.ceil(20 * fontScale + 20)) : Math.max(64, Math.ceil(39 + 36 * fontScale));
  return { largeText, columns, width: dockWidth, itemWidth: Math.max(0, (dockWidth - 14) / columns), itemHeight, height: Math.ceil(count / columns) * itemHeight + 14 };
}

export function getBloomScrollBottomPadding(fontScale: number, width = 390): number {
  // Room for the largest guarded dock, safe area and a final reachable action.
  return getBloomDockGeometry(width, fontScale, 5).height + 80;
}

export function canUseBloomBlur(os: string, version: string | number, reduceTransparency: boolean): boolean {
  if (reduceTransparency) return false;
  return os !== "android" || Number(version) >= 31;
}

export function isBloomDockRoute(name: string): boolean {
  return bloomDockNames.some((value) => value === name);
}
