import React, { useState } from 'react';
import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
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

const COLLAPSED_KEY = 'krs_sidebar_collapsed';

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * The role's menu (from navigation/menus.ts): a fixed column on desktop that can be collapsed to its
 * icons (remembered on this computer), a drawer on phones.
 */
export const Sidebar: React.FC<SidebarProps> = ({
  currentRole,
  currentView,
  onNavigate,
  onLogout,
  mobileMenuOpen,
  setMobileMenuOpen,
}) => {
  const { t } = useLanguage();
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      try {
        localStorage.setItem(COLLAPSED_KEY, prev ? '0' : '1');
      } catch {
        // Not remembered; the menu still collapses.
      }
      return !prev;
    });
  };

  const handleItemClick = (id: AppView) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  /** Labels hide only in the collapsed desktop column; the phone drawer always shows them. */
  const label = collapsed ? 'lg:hidden' : '';

  return (
    <>
      {mobileMenuOpen && (
        <div onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-40 bg-navy-950/80 backdrop-blur-sm lg:hidden" />
      )}

      <aside
        className={`no-print fixed lg:static top-0 bottom-0 left-0 z-50 w-64 ${collapsed ? 'lg:w-[76px]' : ''} bg-navy-950/95 lg:bg-navy-950/85 border-r border-gold-500/20 flex flex-col justify-between transition-[transform,width] duration-300 shadow-2xl lg:shadow-none ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-5 space-y-1.5">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? t('expandMenu', 'Show menu names') : t('collapseMenu', 'Collapse menu')}
            title={collapsed ? t('expandMenu', 'Show menu names') : t('collapseMenu', 'Collapse menu')}
            className={`hidden lg:flex w-full items-center gap-3 py-2.5 mb-1 rounded-2xl text-sm font-bold text-slate-400 hover:bg-slate-850/70 hover:text-white cursor-pointer ${collapsed ? 'justify-center' : 'px-4'}`}
          >
            {collapsed ? <PanelLeftOpen className="w-5 h-5 flex-shrink-0" /> : <PanelLeftClose className="w-5 h-5 flex-shrink-0" />}
            <span className={`truncate ${label}`}>{t('collapseMenu', 'Collapse menu')}</span>
          </button>
          {MENUS[currentRole].map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            const text = t(item.labelKey, item.label);
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                title={collapsed ? text : undefined}
                aria-label={text}
                className={`w-full flex items-center gap-3 py-3.5 rounded-2xl text-base font-bold transition-all cursor-pointer ${collapsed ? 'px-4 lg:justify-center lg:px-0' : 'px-4'} ${
                  isActive
                    ? 'bg-gradient-to-r from-gold-500 to-amber-600 text-navy-950 shadow-md shadow-gold-500/25'
                    : 'text-slate-200 hover:bg-slate-850/70 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-navy-950' : 'text-gold-400'}`} />
                <span className={`truncate ${label}`}>{text}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800/80">
          <button
            onClick={onLogout}
            title={collapsed ? t('logout', 'Sign Out') : undefined}
            aria-label={t('logout', 'Sign Out')}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold text-rose-300 hover:bg-rose-500/10 border border-rose-500/30 cursor-pointer"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className={label}>{t('logout', 'Sign Out')}</span>
          </button>
        </div>
      </aside>
    </>
  );
};
