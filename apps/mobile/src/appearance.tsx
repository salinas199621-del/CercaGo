import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeId = "turquoise" | "navy" | "orange" | "emerald" | "dark";
type PaletteId = Exclude<ThemeId, "dark">;

export const themeOptions: Array<{ id: PaletteId; label: string; swatch: string }> = [
  { id: "turquoise", label: "Turquesa", swatch: "#00A896" },
  { id: "navy", label: "Azul marino", swatch: "#2457A6" },
  { id: "orange", label: "Naranja", swatch: "#F07832" },
  { id: "emerald", label: "Esmeralda", swatch: "#16865B" },
];

export const colorOptions = [
  "#00A896", "#2457A6", "#F07832", "#16865B", "#7C3AED", "#DB2777",
  "#DC2626", "#EA580C", "#CA8A04", "#65A30D", "#0891B2", "#4F46E5",
  "#334155", "#475569", "#111827", "#1E1E1E",
];

export interface AppTheme {
  id: ThemeId;
  darkMode: boolean;
  primary: string;
  primaryDark: string;
  header: string;
  headerText: string;
  background: string;
  surface: string;
  ink: string;
  muted: string;
  border: string;
  soft: string;
  accent: string;
}

const palettes: Record<PaletteId, Omit<AppTheme, "darkMode" | "header" | "headerText">> = {
  turquoise: { id: "turquoise", primary: "#00A896", primaryDark: "#028090", background: "#F7F8FA", surface: "#FFFFFF", ink: "#191B22", muted: "#777D89", border: "#EEF0F3", soft: "#E7F7F5", accent: "#FF6B35" },
  navy: { id: "navy", primary: "#2457A6", primaryDark: "#173B78", background: "#F5F7FB", surface: "#FFFFFF", ink: "#172033", muted: "#6E7788", border: "#E5EAF2", soft: "#EAF0FB", accent: "#FF8A4C" },
  orange: { id: "orange", primary: "#F07832", primaryDark: "#CC5422", background: "#FCF8F5", surface: "#FFFFFF", ink: "#2B211D", muted: "#81736C", border: "#F0E7E1", soft: "#FFF0E6", accent: "#028090" },
  emerald: { id: "emerald", primary: "#16865B", primaryDark: "#116A48", background: "#F5F9F6", surface: "#FFFFFF", ink: "#17251D", muted: "#718078", border: "#E4ECE6", soft: "#E7F4EC", accent: "#F07832" },
};

const themeStorageKey = "cercago-theme-v1";
interface AppearanceSettings {
  palette: PaletteId;
  darkMode: boolean;
  accentColor: string | null;
  headerColor: string | null;
}
interface AppearanceValue {
  theme: AppTheme;
  darkMode: boolean;
  accentColor: string;
  headerColor: string;
  setTheme: (theme: PaletteId) => Promise<void>;
  setDarkMode: (enabled: boolean) => Promise<void>;
  setAccentColor: (color: string) => Promise<void>;
  setHeaderColor: (color: string) => Promise<void>;
}

const defaults: AppearanceSettings = { palette: "turquoise", darkMode: false, accentColor: null, headerColor: null };
const AppearanceContext = createContext<AppearanceValue | null>(null);

function isColor(value: unknown): value is string {
  return typeof value === "string" && /^#[\da-f]{6}$/i.test(value);
}

function readableText(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return (red * 299 + green * 587 + blue * 114) / 1000 > 155 ? "#172033" : "#FFFFFF";
}

function darken(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  const red = Math.round(((value >> 16) & 255) * 0.78);
  const green = Math.round(((value >> 8) & 255) * 0.78);
  const blue = Math.round((value & 255) * 0.78);
  return `#${[red, green, blue].map((part) => part.toString(16).padStart(2, "0")).join("")}`;
}

export function AppearanceProvider({ children }: React.PropsWithChildren) {
  const [settings, setSettings] = useState<AppearanceSettings>(defaults);

  useEffect(() => {
    AsyncStorage.getItem(themeStorageKey)
      .then((saved) => {
        if (!saved) return;
        const parsed: unknown = JSON.parse(saved);
        if (typeof parsed === "string") {
          if (parsed === "dark") setSettings({ ...defaults, darkMode: true });
          else if (Object.hasOwn(palettes, parsed)) setSettings({ ...defaults, palette: parsed as PaletteId });
          return;
        }
        if (!parsed || typeof parsed !== "object") throw new Error("La configuración de apariencia guardada no es válida.");
        const value = parsed as Partial<AppearanceSettings>;
        if (value.palette && Object.hasOwn(palettes, value.palette) &&
          typeof value.darkMode === "boolean" &&
          (value.accentColor === null || isColor(value.accentColor)) &&
          (value.headerColor === null || isColor(value.headerColor))) {
          setSettings(value as AppearanceSettings);
        } else {
          throw new Error("La configuración de apariencia guardada no es válida.");
        }
      })
      .catch((error) => console.error("No se pudo cargar el tema guardado", error));
  }, []);

  const updateSettings = useCallback(async (next: AppearanceSettings) => {
    setSettings(next);
    try {
      await AsyncStorage.setItem(themeStorageKey, JSON.stringify(next));
    } catch (error) {
      console.error("No se pudo guardar la apariencia seleccionada", error);
      throw error;
    }
  }, []);

  const setTheme = useCallback((palette: PaletteId) => updateSettings({ ...settings, palette }), [settings, updateSettings]);
  const setDarkMode = useCallback((darkMode: boolean) => updateSettings({ ...settings, darkMode }), [settings, updateSettings]);
  const setAccentColor = useCallback((accentColor: string) => {
    if (!isColor(accentColor)) throw new Error("El color de acento no es válido.");
    return updateSettings({ ...settings, accentColor });
  }, [settings, updateSettings]);
  const setHeaderColor = useCallback((headerColor: string) => {
    if (!isColor(headerColor)) throw new Error("El color de la barra superior no es válido.");
    return updateSettings({ ...settings, headerColor });
  }, [settings, updateSettings]);

  const value = useMemo(() => {
    const base = palettes[settings.palette];
    const primary = settings.accentColor ?? base.primary;
    const header = settings.headerColor ?? (settings.darkMode ? "#121212" : base.primary);
    const theme: AppTheme = settings.darkMode
      ? {
        ...base,
        id: settings.palette,
        darkMode: true,
        primary,
        primaryDark: darken(primary),
        header,
        headerText: readableText(header),
        background: "#121212",
        surface: "#1E1E1E",
        ink: "#F5F5F5",
        muted: "#B0B0B0",
        border: "#333333",
        soft: "#292929",
      }
      : {
        ...base,
        darkMode: false,
        primary,
        primaryDark: darken(primary),
        header,
        headerText: readableText(header),
      };
    return {
      theme,
      darkMode: settings.darkMode,
      accentColor: primary,
      headerColor: header,
      setTheme,
      setDarkMode,
      setAccentColor,
      setHeaderColor,
    };
  }, [settings, setTheme, setDarkMode, setAccentColor, setHeaderColor]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error("useAppearance debe usarse dentro de AppearanceProvider");
  return value;
}
