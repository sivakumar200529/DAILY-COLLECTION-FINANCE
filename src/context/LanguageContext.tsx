import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, getTranslation } from '../utils/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
  isTamil: boolean;
  /** False until the person has picked a language on this device (the login screen asks first). */
  hasChosenLanguage: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function readSavedLanguage(): Language | null {
  try {
    const saved = localStorage.getItem('krs_language');
    if (saved === 'ta' || saved === 'en') return saved;
  } catch {
    // storage unavailable (private mode etc.)
  }
  return null;
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => readSavedLanguage() ?? 'en');
  const [hasChosenLanguage, setHasChosenLanguage] = useState<boolean>(() => readSavedLanguage() !== null);

  useEffect(() => {
    document.documentElement.lang = language;
    if (!hasChosenLanguage) return;
    try {
      localStorage.setItem('krs_language', language);
    } catch {
      // ignore
    }
  }, [language, hasChosenLanguage]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    setHasChosenLanguage(true);
  };

  const toggleLanguage = () => setLanguage(language === 'en' ? 'ta' : 'en');

  const t = (key: string, fallback?: string): string => {
    return getTranslation(key, language, fallback);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t, isTamil: language === 'ta', hasChosenLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
