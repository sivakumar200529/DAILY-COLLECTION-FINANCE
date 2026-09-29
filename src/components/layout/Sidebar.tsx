import React from 'react';
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
  Layers,
  Sparkles
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

  // Navigation item configurations per prompt requirements 32 and 33
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
    { id: 'documents', label: t('documents', 'Documents'), icon: FileCheck },
    { id: 'plans', label: t('plans', 'Collection Plans'), icon: Layers },
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

  // Collection Agent navigation: Can ONLY collect funds and access related reports
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
          className="fixed inset-0 z-40 bg-navy-950/80 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar Aside */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 w-64 bg-navy-950/95 lg:bg-navy-950/70 border-r border-gold-500/20 flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto px-3.5 py-4">
          {/* Brand Watermark / Tag */}
          <div className="px-3 py-2 mb-3 rounded-xl bg-gradient-to-r from-gold-500/10 via-amber-500/10 to-transparent border border-gold-500/20">
            <span className="text-[10px] font-bold tracking-widest text-gold-400 uppercase block">
              {currentRole === 'CUSTOMER' 
                ? t('customerSelfService', 'Customer Self-Service') 
                : currentRole === 'COLLECTOR' 
                ? t('fieldAgentBanner', 'Field Collection Agent') 
                : t('adminOperations', 'Admin Operations')}
            </span>
            <span className="text-xs font-semibold text-slate-200">
              {currentRole === 'CUSTOMER' 
                ? t('repaymentProgress', 'Daily Repayments & Passbook') 
                : currentRole === 'COLLECTOR' 
                ? t('doorstepCollectionBanner', 'Doorstep Collections & Reports') 
                : t('appTagline', 'Daily Collection Control Hub')}
            </span>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-gold-500 to-amber-600 text-navy-950 font-bold shadow-md shadow-gold-500/20'
                      : item.highlight
                      ? 'text-gold-300 hover:bg-gold-500/15 border border-gold-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-850/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-navy-950' : item.highlight ? 'text-gold-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && !isActive && (
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold border border-emerald-500/30">
                      {item.badge}
                    </span>
                  )}
                  {item.highlight && !isActive && (
                    <Sparkles className="w-3.5 h-3.5 text-gold-400" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Area with Theme/Language Switcher & Logout */}
        <div className="p-3 border-t border-slate-800/80 bg-navy-900/40 space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold text-slate-400">
              {t('theme', 'Theme')} &amp; {t('language', 'Language')}
            </span>
            <ThemeLanguageSwitch variant="compact" />
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors border border-rose-500/20"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('logout', 'Sign Out')}</span>
          </button>
        </div>
      </aside>
    </>
  );
};
