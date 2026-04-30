import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Available font options ───────────────────────────────────────────────────
export type FontOption = "Inter" | "Poppins";

export const FONT_OPTIONS: { key: FontOption; label: string; description: string }[] = [
  { key: "Inter", label: "Inter", description: "Moderna e limpa, ideal para leitura" },
  { key: "Poppins", label: "Poppins", description: "Arredondada e amigável, estilo contemporâneo" },
];

export type FontWeightKey = "regular" | "medium" | "semibold" | "bold";

const FONT_MAP: Record<FontOption, Record<FontWeightKey, string>> = {
  Inter: {
    regular: "Inter_400Regular",
    medium: "Inter_500Medium",
    semibold: "Inter_600SemiBold",
    bold: "Inter_700Bold",
  },
  Poppins: {
    regular: "Poppins_400Regular",
    medium: "Poppins_500Medium",
    semibold: "Poppins_600SemiBold",
    bold: "Poppins_700Bold",
  },
};

const STORAGE_KEY = "@appearance_font";

// ─── Context ──────────────────────────────────────────────────────────────────
interface AppearanceContextValue {
  fontOption: FontOption;
  setFontOption: (font: FontOption) => Promise<void>;
  getFont: (weight: FontWeightKey) => string;
  fonts: Record<FontWeightKey, string>;
}

const AppearanceContext = createContext<AppearanceContextValue>({
  fontOption: "Inter",
  setFontOption: async () => {},
  getFont: (w) => FONT_MAP.Inter[w],
  fonts: FONT_MAP.Inter,
});

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [fontOption, setFontState] = useState<FontOption>("Inter");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val && FONT_MAP[val as FontOption]) {
        setFontState(val as FontOption);
      }
    });
  }, []);

  const setFontOption = useCallback(async (font: FontOption) => {
    setFontState(font);
    await AsyncStorage.setItem(STORAGE_KEY, font);
  }, []);

  const getFont = useCallback((weight: FontWeightKey) => FONT_MAP[fontOption][weight], [fontOption]);

  return (
    <AppearanceContext.Provider value={{
      fontOption,
      setFontOption,
      getFont,
      fonts: FONT_MAP[fontOption],
    }}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  return useContext(AppearanceContext);
}
