export const themeModes = ["system", "light", "dark"] as const;
export type ThemeMode = (typeof themeModes)[number];

export function isThemeMode(value: string | null): value is ThemeMode {
  return themeModes.some((mode) => mode === value);
}

export function toAppearanceScheme(mode: ThemeMode): "light" | "dark" | "unspecified" {
  return mode === "system" ? "unspecified" : mode;
}
