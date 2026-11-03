import React, { useState } from 'react';
import { Bell, Search, Menu, CheckCheck, Clock, Settings } from 'lucide-react';
import { Notification } from '../../types';
import { formatDate } from '../../utils/formatters';
import { KrsLogo } from '../common/KrsLogo';
import { useLanguage } from '../../context/LanguageContext';

interface NavbarProps {
  onGoHome: () => void;
  /** Office only: search customers by name, shop, mobile or ID (runs on Enter). */
  onSearch?: (query: string) => void;
  notifications: Notification[];
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  onViewAllNotifications: () => void;
  onOpenMenu: () => void;
  showMenuButton: boolean;
  /** The ⚙️ sheet: details, language, light/dark, sign out. */
  onOpenSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onGoHome,
  onSearch,
  notifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onViewAllNotifications,
  onOpenMenu,
  showMenuButton,
  onOpenSettings,
}) => {
  const { t } = useLanguage();
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchVal, setSearchVal] = useState('');

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch && searchVal.trim()) onSearch(searchVal.trim());
  };

  return (
    <header className="sticky top-0 z-30 bg-navy-950/90 backdrop-blur-md border-b border-gold-500/20 px-3 sm:px-6 py-2.5 no-print">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {showMenuButton && (
            <button
              onClick={onOpenMenu}
              className="lg:hidden p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800"
              aria-label={t('menu', 'Menu')}
            >
              <Menu className="w-6 h-6" />
            </button>
          )}
          <button type="button" onClick={onGoHome} className="flex-shrink-0" aria-label={t('navHome', 'Home')}>
            {/* With the menu button there is no room for the name on a phone. */}
            {showMenuButton && <span className="sm:hidden"><KrsLogo size="sm" variant="badge-only" /></span>}
            <span className={showMenuButton ? 'hidden sm:inline-flex' : 'inline-flex'}><KrsLogo size="sm" showSubtitle={false} /></span>
          </button>
        </div>

        {onSearch && (
          <form onSubmit={submitSearch} className="hidden md:flex flex-1 max-w-md mx-2">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-gold-500/70 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
                placeholder={t('searchCustomers', 'Search name, shop or mobile')}
                className="w-full pl-10 pr-4 py-2.5 bg-navy-900/90 border border-slate-800 focus:border-gold-500 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none"
              />
            </div>
          </form>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2.5 rounded-xl text-slate-300 hover:text-gold-300 hover:bg-slate-800/80"
              aria-label={t('notifications', 'Messages')}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl glass-card border border-gold-500/30 shadow-2xl p-4 z-50 bg-navy-900">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-2">
                  <span className="text-sm font-bold text-white">{t('notifications', 'Messages')}</span>
                  {unreadCount > 0 && (
                    <button onClick={onMarkAllNotificationsRead} className="text-xs text-slate-400 hover:text-gold-400 flex items-center gap-1">
                      <CheckCheck className="w-4 h-4" />
                      {t('markAllRead', 'Mark all read')}
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto space-y-2">
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-sm text-slate-400">{t('noNotifications', 'No messages yet')}</div>
                  ) : (
                    notifications.slice(0, 8).map(n => (
                      <div
                        key={n.id}
                        onClick={() => onMarkNotificationRead(n.id)}
                        className={`p-3 rounded-xl border text-sm cursor-pointer ${
                          n.is_read ? 'bg-navy-950/40 border-slate-800/60 text-slate-400' : 'bg-navy-950/90 border-gold-500/30 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`font-semibold ${n.is_read ? 'text-slate-300' : 'text-gold-300'}`}>{n.title}</span>
                          <span className="text-[11px] text-slate-500 flex items-center gap-1 flex-shrink-0">
                            <Clock className="w-3 h-3" />
                            {formatDate(n.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 line-clamp-2">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="pt-2 mt-2 border-t border-slate-800 text-center">
                  <button
                    onClick={() => { setShowNotifications(false); onViewAllNotifications(); }}
                    className="text-sm text-gold-400 hover:text-gold-300 font-bold"
                  >
                    {t('viewAllNotifications', 'See all messages')}
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => { setShowNotifications(false); onOpenSettings(); }}
            className="p-2.5 rounded-xl text-slate-300 hover:text-gold-300 hover:bg-slate-800/80"
            aria-label={t('settings', 'Settings')}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
