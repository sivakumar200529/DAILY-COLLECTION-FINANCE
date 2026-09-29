import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, getTranslation } from '../utils/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
  isTamil: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('krs_language');
      if (saved === 'ta' || saved === 'en') return saved;
    } catch {
      // ignore
    }
    return 'en'; // default English
  });

  useEffect(() => {
    try {
      localStorage.setItem('krs_language', language);
      document.documentElement.lang = language;
    } catch {
      // ignore
    }
  }, [language]);

  const toggleLanguage = () => {
    setLanguageState(prev => (prev === 'en' ? 'ta' : 'en'));
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string, fallback?: string): string => {
    return getTranslation(key, language, fallback);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t, isTamil: language === 'ta' }}>
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
