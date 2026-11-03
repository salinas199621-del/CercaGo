import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeId = "turquoise" | "navy" | "orange" | "emerald" | "dark";

export const themeOptions: Array<{ id: ThemeId; label: string; swatch: string }> = [
  { id: "turquoise", label: "Turquesa", swatch: "#00A896" },
  { id: "navy", label: "Azul marino", swatch: "#2457A6" },
  { id: "orange", label: "Naranja vibrante", swatch: "#F07832" },
  { id: "emerald", label: "Verde esmeralda", swatch: "#16865B" },
  { id: "dark", label: "Modo oscuro", swatch: "#1F2937" },
];

export interface AppTheme {
  id: ThemeId;
  primary: string;
  primaryDark: string;
  background: string;
  surface: string;
  ink: string;
  muted: string;
  border: string;
  soft: string;
  accent: string;
}

const themes: Record<ThemeId, AppTheme> = {
  turquoise: { id: "turquoise", primary: "#00A896", primaryDark: "#028090", background: "#F7F8FA", surface: "#FFFFFF", ink: "#191B22", muted: "#777D89", border: "#EEF0F3", soft: "#E7F7F5", accent: "#FF6B35" },
  navy: { id: "navy", primary: "#2457A6", primaryDark: "#173B78", background: "#F5F7FB", surface: "#FFFFFF", ink: "#172033", muted: "#6E7788", border: "#E5EAF2", soft: "#EAF0FB", accent: "#FF8A4C" },
  orange: { id: "orange", primary: "#F07832", primaryDark: "#CC5422", background: "#FCF8F5", surface: "#FFFFFF", ink: "#2B211D", muted: "#81736C", border: "#F0E7E1", soft: "#FFF0E6", accent: "#028090" },
  emerald: { id: "emerald", primary: "#16865B", primaryDark: "#116A48", background: "#F5F9F6", surface: "#FFFFFF", ink: "#17251D", muted: "#718078", border: "#E4ECE6", soft: "#E7F4EC", accent: "#F07832" },
  dark: { id: "dark", primary: "#20B7A7", primaryDark: "#078477", background: "#111827", surface: "#1F2937", ink: "#F9FAFB", muted: "#AAB4C2", border: "#374151", soft: "#243B43", accent: "#FF8A4C" },
};

const themeStorageKey = "cercago-theme-v1";
interface AppearanceValue {
  theme: AppTheme;
  setTheme: (theme: ThemeId) => Promise<void>;
}

const AppearanceContext = createContext<AppearanceValue | null>(null);

export function AppearanceProvider({ children }: React.PropsWithChildren) {
  const [themeId, setThemeId] = useState<ThemeId>("turquoise");

  useEffect(() => {
    AsyncStorage.getItem(themeStorageKey)
      .then((saved) => {
        if (saved && Object.hasOwn(themes, saved)) setThemeId(saved as ThemeId);
      })
      .catch((error) => console.error("No se pudo cargar el tema guardado", error));
  }, []);

  const setTheme = useCallback(async (nextTheme: ThemeId) => {
    setThemeId(nextTheme);
    try {
      await AsyncStorage.setItem(themeStorageKey, nextTheme);
    } catch (error) {
      console.error("No se pudo guardar el tema seleccionado", error);
      throw error;
    }
  }, []);

  const value = useMemo(() => ({ theme: themes[themeId], setTheme }), [themeId, setTheme]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error("useAppearance debe usarse dentro de AppearanceProvider");
  return value;
}
