import React, { useState } from 'react';
import { User, Notification } from '../../types';
import { 
  Bell, 
  Search, 
  PlusCircle, 
  LogOut, 
  Menu, 
  X, 
  CheckCheck,
  Shield, 
  UserCheck, 
  Clock, 
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { formatDate } from '../../utils/formatters';
import { KrsLogo } from '../common/KrsLogo';
import { useLanguage } from '../../context/LanguageContext';
import { ThemeLanguageSwitch } from '../common/ThemeLanguageSwitch';

interface NavbarProps {
  currentUser: User;
  onLogout: () => void;
  onNavigate: (view: string) => void;
  onOpenQuickCollect?: () => void;
  onGlobalSearch?: (query: string) => void;
  notifications: Notification[];
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onLogout,
  onNavigate,
  onOpenQuickCollect,
  onGlobalSearch,
  notifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  mobileMenuOpen,
  setMobileMenuOpen,
}) => {
  const { t } = useLanguage();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchVal, setSearchVal] = useState('');

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchVal(e.target.value);
    if (onGlobalSearch) {
      onGlobalSearch(e.target.value);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-navy-950/90 backdrop-blur-md border-b border-gold-500/20 px-4 lg:px-6 py-2.5 transition-all">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Mobile Toggle & Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div 
            onClick={() => onNavigate(
              currentUser.role === 'CUSTOMER' 
                ? 'customer-dashboard' 
                : currentUser.role === 'COLLECTOR' 
                ? 'daily-collections' 
                : 'dashboard'
            )}
            className="cursor-pointer group hover:opacity-95 transition-opacity"
          >
            <KrsLogo size="sm" showSubtitle={true} />
          </div>
        </div>

        {/* Center: Global Search Bar */}
        <div className="hidden md:flex flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4 text-gold-500/70" />
            </div>
            <input
              type="text"
              value={searchVal}
              onChange={handleSearchChange}
              placeholder={t('searchPlaceholder', 'Search Customer, Shop, Mobile, Account, Receipt #...')}
              className="w-full pl-9 pr-4 py-1.5 bg-navy-900/80 border border-slate-800 hover:border-gold-500/30 focus:border-gold-500 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-gold-500 transition-all"
            />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Theme & Language Switchers */}
          <ThemeLanguageSwitch variant="navbar" />

          {/* Quick Collect Payment Action (Admin / Collector) */}
          {currentUser.role !== 'CUSTOMER' && onOpenQuickCollect && (
            <button
              onClick={onOpenQuickCollect}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-bold text-xs shadow-md shadow-gold-500/20 transition-all duration-200"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t('collectPayment', 'Collect Payment')}</span>
            </button>
          )}

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-xl text-slate-300 hover:text-gold-300 hover:bg-slate-800/80 transition-all"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl glass-card border border-gold-500/30 shadow-2xl p-4 z-50 bg-navy-900">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-2">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-gold-400" />
                    <span className="text-sm font-bold text-white">{t('notifications', 'Notifications')}</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-gold-500/20 text-gold-300 text-[10px] font-semibold">
                        {unreadCount} {t('new', 'new')}
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={onMarkAllNotificationsRead}
                      className="text-[11px] text-slate-400 hover:text-gold-400 flex items-center gap-1"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      {t('markAllRead', 'Mark all read')}
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2">
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      {t('noNotifications', 'No notifications yet')}
                    </div>
                  ) : (
                    notifications.slice(0, 8).map(n => (
                      <div
                        key={n.id}
                        onClick={() => onMarkNotificationRead(n.id)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          n.is_read
                            ? 'bg-navy-950/40 border-slate-800/60 text-slate-400'
                            : 'bg-navy-950/90 border-gold-500/30 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-semibold text-xs ${n.is_read ? 'text-slate-300' : 'text-gold-300'}`}>
                            {n.title}
                          </span>
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(n.created_at)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-2 mt-2 border-t border-slate-800 text-center">
                  <button
                    onClick={() => {
                      setShowNotifications(false);
                      onNavigate('notifications');
                    }}
                    className="text-xs text-gold-400 hover:text-gold-300 font-semibold"
                  >
                    {t('viewAllNotifications', 'View All Notifications')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Pill */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2.5 p-1 pl-2 pr-3 rounded-full bg-navy-900 border border-slate-800 hover:border-gold-500/40 transition-all"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-gold-500 to-amber-600 flex items-center justify-center text-navy-950 font-bold text-xs">
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="text-left hidden sm:block">
                <span className="text-xs font-semibold text-white block leading-tight">
                  {currentUser.name}
                </span>
                <span className="text-[10px] font-medium text-gold-400">
                  {currentUser.role === 'ADMIN' ? t('masterAdmin', '👑 Master Admin') : currentUser.role === 'COLLECTOR' ? t('fieldAgent', '🚶 Field Agent') : t('customerPill', '👤 Customer')}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Profile Dropdown */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl glass-card border border-gold-500/30 shadow-2xl p-2 z-50 bg-navy-900">
                <div className="px-3 py-2 border-b border-slate-800 mb-1">
                  <p className="text-xs font-bold text-white">{currentUser.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{currentUser.email}</p>
                  <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold-500/10 border border-gold-500/20 text-[10px] text-gold-400 font-medium">
                    {currentUser.role === 'ADMIN' ? (
                      <>
                        <Shield className="w-3 h-3 text-gold-400" />
                        <span>{t('adminTitle', 'Admin (Can Do Anything)')}</span>
                      </>
                    ) : currentUser.role === 'COLLECTOR' ? (
                      <>
                        <UserCheck className="w-3 h-3 text-emerald-400" />
                        <span>{t('agentTitle', 'Agent (Collect & Reports)')}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 text-blue-400" />
                        <span>{t('customerSelfService', 'Customer Self-Service')}</span>
                      </>
                    )}
                  </div>
                </div>

                {currentUser.role === 'ADMIN' && (
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      onNavigate('settings');
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
                  >
                    ⚙️ {t('systemSettings', 'System Settings')}
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onLogout();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition-colors mt-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {t('logout', 'Logout')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
