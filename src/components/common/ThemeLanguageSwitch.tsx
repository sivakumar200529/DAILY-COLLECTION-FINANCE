import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { Sun, Moon, Globe } from 'lucide-react';

interface ThemeLanguageSwitchProps {
  variant?: 'compact' | 'full' | 'navbar' | 'login';
  showLabels?: boolean;
}

export const ThemeLanguageSwitch: React.FC<ThemeLanguageSwitchProps> = ({
  variant = 'compact',
  showLabels = false,
}) => {
  const { theme, toggleTheme, isDark } = useTheme();
  const { language, toggleLanguage, t, isTamil } = useLanguage();

  if (variant === 'full') {
    return (
      <div className="space-y-4">
        {/* Theme Picker */}
        <div>
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            {t('theme', 'Theme')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => isDark ? null : toggleTheme()}
              className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                isDark
                  ? 'bg-gold-500/20 border-gold-500 text-gold-300 shadow-md shadow-gold-500/10'
                  : 'bg-navy-950 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <Moon className="w-4 h-4 text-gold-400" />
              <span>{t('darkTheme', 'Dark Theme')}</span>
            </button>
            <button
              type="button"
              onClick={() => !isDark ? null : toggleTheme()}
              className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                !isDark
                  ? 'bg-amber-500/20 border-amber-500 text-amber-800 shadow-md'
                  : 'bg-navy-950 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <Sun className="w-4 h-4 text-amber-500" />
              <span>{t('lightTheme', 'Light Theme')}</span>
            </button>
          </div>
        </div>

        {/* Language Picker */}
        <div>
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            {t('language', 'Language')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => language === 'en' ? null : toggleLanguage()}
              className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                language === 'en'
                  ? 'bg-gold-500/20 border-gold-500 text-gold-300 shadow-md shadow-gold-500/10'
                  : 'bg-navy-950 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <span>🇬🇧 English</span>
            </button>
            <button
              type="button"
              onClick={() => language === 'ta' ? null : toggleLanguage()}
              className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                language === 'ta'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-500/10'
                  : 'bg-navy-950 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <span>🇮🇳 தமிழ் (Tamil)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Compact / Navbar / Login layout
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* Language Toggle Button */}
      <button
        type="button"
        onClick={toggleLanguage}
        className={`px-2.5 py-1.5 rounded-xl border transition-all duration-200 flex items-center gap-1.5 text-xs font-bold shadow-sm ${
          isTamil
            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
            : 'bg-navy-900/90 border-slate-700/80 text-slate-300 hover:text-gold-300 hover:border-gold-500/40'
        }`}
        title={isTamil ? 'Switch to English' : 'தமிழுக்கு மாறுக (Switch to Tamil)'}
      >
        <Globe className="w-3.5 h-3.5 text-gold-400 flex-shrink-0" />
        <span className="font-semibold">
          {language === 'en' ? 'தமிழ்' : 'English'}
        </span>
      </button>

      {/* Theme Toggle Button */}
      <button
        type="button"
        onClick={toggleTheme}
        className={`p-1.5 sm:px-2 sm:py-1.5 rounded-xl border transition-all duration-200 flex items-center gap-1 text-xs font-bold shadow-sm ${
          isDark
            ? 'bg-navy-900/90 border-slate-700/80 text-gold-400 hover:text-gold-300 hover:border-gold-500/50 hover:bg-slate-800'
            : 'bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200'
        }`}
        title={isDark ? t('lightTheme', 'Switch to Light Theme') : t('darkTheme', 'Switch to Dark Theme')}
      >
        {isDark ? (
          <>
            <Sun className="w-4 h-4 text-gold-400" />
            {showLabels && <span className="hidden sm:inline text-xs">{t('lightTheme', 'Light')}</span>}
          </>
        ) : (
          <>
            <Moon className="w-4 h-4 text-slate-800" />
            {showLabels && <span className="hidden sm:inline text-xs">{t('darkTheme', 'Dark')}</span>}
          </>
        )}
      </button>
    </div>
  );
};
