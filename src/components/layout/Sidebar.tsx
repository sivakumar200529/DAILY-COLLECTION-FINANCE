import React from 'react';
import { LogOut } from 'lucide-react';
import { Role } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { AppView, MENUS } from '../../navigation/menus';

interface SidebarProps {
  currentRole: Role;
  currentView: string;
  onNavigate: (view: AppView) => void;
  onLogout: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

/** The role's menu (from navigation/menus.ts): a fixed column on desktop, a drawer on phones. */
export const Sidebar: React.FC<SidebarProps> = ({
  currentRole,
  currentView,
  onNavigate,
  onLogout,
  mobileMenuOpen,
  setMobileMenuOpen,
}) => {
  const { t } = useLanguage();

  const handleItemClick = (id: AppView) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {mobileMenuOpen && (
        <div onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-40 bg-navy-950/80 backdrop-blur-sm lg:hidden" />
      )}

      <aside
        className={`no-print fixed lg:static top-0 bottom-0 left-0 z-50 w-64 bg-navy-950/95 lg:bg-navy-950/85 border-r border-gold-500/20 flex flex-col justify-between transition-transform duration-300 shadow-2xl lg:shadow-none ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-1.5">
          {MENUS[currentRole].map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-base font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-gold-500 to-amber-600 text-navy-950 shadow-md shadow-gold-500/25'
                    : 'text-slate-200 hover:bg-slate-850/70 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-navy-950' : 'text-gold-400'}`} />
                <span className="truncate">{t(item.labelKey, item.label)}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800/80">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold text-rose-300 hover:bg-rose-500/10 border border-rose-500/30 cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            <span>{t('logout', 'Sign Out')}</span>
          </button>
        </div>
      </aside>
    </>
  );
};
