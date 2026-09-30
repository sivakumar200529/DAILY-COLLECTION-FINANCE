import React, { useState } from 'react';
import { Role } from '../../types';
import { 
  Home, 
  Users, 
  Wallet, 
  CalendarCheck, 
  Receipt as ReceiptIcon, 
  UserCheck, 
  MapPin, 
  FileText, 
  FileCheck, 
  Bell, 
  Settings, 
  LogOut, 
  FileSpreadsheet, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Shield
} from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import { ThemeLanguageSwitch } from '../common/ThemeLanguageSwitch';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  highlight?: boolean;
}

interface SidebarProps {
  currentRole: Role;
  currentView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRole,
  currentView,
  onNavigate,
  onLogout,
  mobileMenuOpen,
  setMobileMenuOpen,
}) => {
  const { t } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);

  // All existing menu items strictly preserved
  const adminNavItems: NavItem[] = [
    { id: 'dashboard', label: t('dashboard', 'Dashboard'), icon: Home },
    { id: 'customers', label: t('customers', 'Customers'), icon: Users },
    { id: 'accounts', label: t('accounts', 'Collection Accounts'), icon: Wallet },
    { id: 'daily-collections', label: t('dailyCollections', 'Daily Collections'), icon: CalendarCheck, badge: t('live', 'Live') },
    { id: 'receipts', label: t('receipts', 'Receipts'), icon: ReceiptIcon },
    { id: 'collectors', label: t('collectors', 'Collectors'), icon: UserCheck },
    { id: 'areas', label: t('areas', 'Areas'), icon: MapPin },
    { id: 'monthly-report', label: t('monthlyReport', 'Monthly Excel Register'), icon: FileSpreadsheet, highlight: true },
    { id: 'reports', label: t('reports', 'Reports'), icon: FileText },
    { id: 'notifications', label: t('notifications', 'Notifications'), icon: Bell },
    { id: 'settings', label: t('settings', 'Settings'), icon: Settings },
  ];

  const customerNavItems: NavItem[] = [
    { id: 'customer-dashboard', label: t('dashboard', 'Dashboard'), icon: Home },
    { id: 'my-collection', label: t('myCollection', 'My Collection'), icon: Wallet },
    { id: 'payment-history', label: t('paymentHistory', 'Payment History'), icon: CalendarCheck },
    { id: 'my-receipts', label: t('myReceipts', 'My Receipts'), icon: ReceiptIcon },
    { id: 'my-documents', label: t('myDocuments', 'My Documents'), icon: FileCheck },
    { id: 'notifications', label: t('notifications', 'Notifications'), icon: Bell },
    { id: 'my-profile', label: t('myProfile', 'My Profile'), icon: Users },
  ];

  const collectorNavItems: NavItem[] = [
    { id: 'daily-collections', label: t('dailyCollections', 'Daily Collections'), icon: CalendarCheck, badge: t('live', 'Live'), highlight: true },
    { id: 'daily-register', label: t('dailyRegister', 'Daily Register'), icon: FileSpreadsheet },
    { id: 'monthly-report', label: t('monthlyMatrix', 'Monthly Matrix Register'), icon: FileSpreadsheet },
    { id: 'reports', label: t('collectionReports', 'Collection Reports'), icon: FileText },
    { id: 'receipts', label: t('receiptsMaster', 'Receipts Master'), icon: ReceiptIcon },
    { id: 'notifications', label: t('notifications', 'Notifications'), icon: Bell },
  ];

  const navItems = 
    currentRole === 'CUSTOMER' 
      ? customerNavItems 
      : currentRole === 'COLLECTOR' 
      ? collectorNavItems 
      : adminNavItems;

  const handleItemClick = (id: string) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-navy-950/80 backdrop-blur-sm lg:hidden animate-in fade-in"
        />
      )}

      {/* Sidebar Aside */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 ${
          collapsed ? 'lg:w-20' : 'w-64 lg:w-64'
        } bg-navy-950/95 lg:bg-navy-950/85 border-r border-gold-500/20 flex flex-col justify-between transition-all duration-300 ease-in-out shadow-2xl lg:shadow-none ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto px-3 py-4">
          
          {/* Header Tag / Collapsible Trigger */}
          <div className="flex items-center justify-between mb-3 px-1">
            {!collapsed && (
              <div className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-gold-500/10 via-amber-500/10 to-transparent border border-gold-500/20 flex-1 mr-2">
                <span className="text-[10px] font-black tracking-widest text-gold-400 uppercase block font-sans">
                  {currentRole === 'CUSTOMER' 
                    ? t('customerSelfService', 'Customer Portal') 
                    : currentRole === 'COLLECTOR' 
                    ? t('fieldAgentBanner', 'Field Agent Hub') 
                    : t('adminOperations', 'Admin Command')}
                </span>
                <span className="text-[11px] font-semibold text-slate-300 truncate block">
                  {currentRole === 'CUSTOMER' 
                    ? t('repaymentProgress', 'Passbook & Pay') 
                    : currentRole === 'COLLECTOR' 
                    ? t('doorstepCollectionBanner', 'Doorstep Collections') 
                    : t('appTagline', 'Financial Operations')}
                </span>
              </div>
            )}

            {/* Desktop Collapse Toggle */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg bg-navy-900 border border-slate-800 text-slate-400 hover:text-gold-400 hover:border-gold-500/40 transition-all cursor-pointer"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1 mt-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center ${
                    collapsed ? 'justify-center px-2 py-3' : 'justify-between px-3 py-2.5'
                  } rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer group relative ${
                    isActive
                      ? 'bg-gradient-to-r from-gold-500 to-amber-600 text-navy-950 font-black shadow-md shadow-gold-500/25'
                      : item.highlight
                      ? 'text-gold-300 hover:bg-gold-500/15 border border-gold-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-850/70'
                  }`}
                >
                  <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
                    <Icon className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-navy-950 stroke-[2.5]' : item.highlight ? 'text-gold-400' : 'text-slate-400 group-hover:text-gold-400'
                    }`} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!collapsed && item.badge && !isActive && (
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                      {item.badge}
                    </span>
                  )}
                  {!collapsed && item.highlight && !isActive && (
                    <Sparkles className="w-3.5 h-3.5 text-gold-400" />
                  )}

                  {/* Active Indicator Bar on Edge */}
                  {isActive && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-navy-950" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Area with Theme/Language Switcher & Logout */}
        <div className="p-3 border-t border-slate-800/80 bg-navy-900/60 space-y-2.5">
          {!collapsed && (
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {t('preferences', 'Settings')}
              </span>
              <ThemeLanguageSwitch variant="compact" />
            </div>
          )}

          <button
            onClick={onLogout}
            className={`w-full flex items-center justify-center gap-2 ${
              collapsed ? 'p-2' : 'px-3 py-2'
            } rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors border border-rose-500/20 cursor-pointer`}
            title={t('logout', 'Sign Out')}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>{t('logout', 'Sign Out')}</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
