import React from 'react';
import { Home, Menu } from 'lucide-react';
import { Role } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { AppView, BOTTOM_TABS, HAS_MORE_MENU, menuItem } from '../../navigation/menus';

interface MobileBottomNavProps {
  currentRole: Role;
  currentView: string;
  onNavigate: (view: AppView) => void;
  onOpenMenu: () => void;
}

/** Phone bottom bar, built from navigation/menus.ts. The centre tab is the big round action. */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentRole, currentView, onNavigate, onOpenMenu }) => {
  const { t } = useLanguage();

  return (
    <nav className="no-print lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-navy-950/95 backdrop-blur-xl border-t border-gold-500/25 px-2 py-1.5 shadow-[0_-8px_20px_rgba(0,0,0,0.4)]">
      <div className="flex items-center justify-around">
        {BOTTOM_TABS[currentRole].map(tab => {
          const item = menuItem(currentRole, tab.id);
          const Icon = item?.icon ?? Home;
          const label = item ? t(item.labelKey, item.label) : tab.id;
          const isActive = currentView === tab.id;

          if (tab.center) {
            return (
              <button
                key={tab.id}
                onClick={() => onNavigate(tab.id)}
                className="relative -top-4 flex flex-col items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-gold-500 to-amber-600 text-navy-950 shadow-lg shadow-gold-500/30 border-4 border-navy-950 active:scale-95 transition-transform"
                aria-label={label}
              >
                <Icon className="w-6 h-6 text-navy-950" />
                <span className="text-[10px] font-black leading-none mt-0.5">{label}</span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all active:scale-95 ${
                isActive ? 'text-gold-400' : 'text-slate-400'
              }`}
            >
              <Icon className="w-6 h-6 mb-0.5" />
              <span className="text-xs font-bold">{label}</span>
            </button>
          );
        })}

        {HAS_MORE_MENU[currentRole] && (
          <button onClick={onOpenMenu} className="flex flex-col items-center justify-center py-1.5 px-3 rounded-xl text-slate-400 active:scale-95">
            <Menu className="w-6 h-6 mb-0.5" />
            <span className="text-xs font-bold">{t('more', 'More')}</span>
          </button>
        )}
      </div>
    </nav>
  );
};
