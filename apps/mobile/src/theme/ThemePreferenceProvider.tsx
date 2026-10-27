import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance } from "react-native";
import * as SecureStore from "expo-secure-store";
import { isThemeMode, toAppearanceScheme, type ThemeMode } from "./themePreference";

const THEME_MODE_KEY = "cb-connect-theme-mode";

type ThemePreference = {
  mode: ThemeMode;
  ready: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
};

const ThemePreferenceContext = createContext<ThemePreference | null>(null);

export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void SecureStore.getItemAsync(THEME_MODE_KEY)
      .then((saved) => {
        if (!active || !isThemeMode(saved)) return;
        setModeState(saved);
        Appearance.setColorScheme(toAppearanceScheme(saved));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => { active = false; };
  }, []);

  const setMode = useCallback(async (next: ThemeMode) => {
    await SecureStore.setItemAsync(THEME_MODE_KEY, next);
    setModeState(next);
    Appearance.setColorScheme(toAppearanceScheme(next));
  }, []);

  const value = useMemo(() => ({ mode, ready, setMode }), [mode, ready, setMode]);
  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference() {
  const preference = useContext(ThemePreferenceContext);
  if (!preference) throw new Error("useThemePreference must be used within ThemePreferenceProvider");
  return preference;
}
