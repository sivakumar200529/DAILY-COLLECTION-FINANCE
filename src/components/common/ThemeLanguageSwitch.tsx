import React from 'react';
import { Globe, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

/** Top-bar button that switches between Tamil and English (always visible). */
export const LanguageButton: React.FC = () => {
  const { language, toggleLanguage, isTamil } = useLanguage();
  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={`px-3 py-2 rounded-xl border flex items-center gap-1.5 text-sm font-bold transition-all ${
        isTamil
          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
          : 'bg-navy-900/90 border-slate-700/80 text-slate-200 hover:border-gold-500/40'
      }`}
      title={isTamil ? 'Switch to English' : 'தமிழுக்கு மாறுக'}
    >
      <Globe className="w-4 h-4 text-gold-400" />
      <span>{language === 'en' ? 'தமிழ்' : 'English'}</span>
    </button>
  );
};

/** Two large buttons: தமிழ் / English. Used on first open and in Settings. */
export const LanguageChoice: React.FC<{ onChosen?: () => void }> = ({ onChosen }) => {
  const { language, setLanguage, hasChosenLanguage } = useLanguage();
  const option = (value: 'ta' | 'en', label: string) => {
    const active = hasChosenLanguage && language === value;
    return (
      <button
        type="button"
        onClick={() => {
          setLanguage(value);
          onChosen?.();
        }}
        className={`py-4 rounded-2xl border-2 text-lg font-black transition-all ${
          active ? 'bg-gold-500 border-gold-500 text-navy-950' : 'bg-navy-950 border-slate-700 text-white hover:border-gold-500/60'
        }`}
      >
        {label}
      </button>
    );
  };
  return (
    <div className="grid grid-cols-2 gap-3">
      {option('ta', 'தமிழ்')}
      {option('en', 'English')}
    </div>
  );
};

/** Row for the profile menu: dark / light screen. */
export const ThemeToggle: React.FC = () => {
  const { toggleTheme, isDark } = useTheme();
  const { t } = useLanguage();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-slate-200 hover:bg-slate-800/80 flex items-center gap-2"
    >
      {isDark ? <Sun className="w-4 h-4 text-gold-400" /> : <Moon className="w-4 h-4" />}
      {isDark ? t('lightScreen', 'Light screen') : t('darkScreen', 'Dark screen')}
    </button>
  );
};
