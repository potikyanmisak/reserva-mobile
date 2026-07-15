import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { en, am, ru } from "../translations";

type Language = "en" | "am" | "ru";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  loading: boolean;
}

const translations: Record<Language, any> = { en, am, ru };

const LanguageContext = createContext<LanguageContextType | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>("en");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initLang = async () => {
      try {
        const storedLang = await AsyncStorage.getItem("reserva_lang");
        if (storedLang) setLanguageState(storedLang as Language);
      } catch (e) {
        console.error("Lang init error:", e);
      } finally {
        setLoading(false);
      }
    };
    initLang();
  }, []);

  const setLanguage = async (lang: Language) => {
    await AsyncStorage.setItem("reserva_lang", lang);
    setLanguageState(lang);
  };

  const t = (path: string): string => {
    const keys = path.split(".");
    
    const getVal = (translationsObj: any, keyPath: string[]) => {
      let current = translationsObj;
      for (const key of keyPath) {
        if (current && typeof current === 'object' && key in current) {
          current = current[key];
        } else {
          return undefined;
        }
      }
      return typeof current === 'string' ? current : undefined;
    };

    const val = getVal(translations[language], keys);
    if (val !== undefined) return val;

    // Fallback to English
    const fallbackVal = getVal(translations["en"], keys);
    if (fallbackVal !== undefined) return fallbackVal;

    return path;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, loading }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
};
