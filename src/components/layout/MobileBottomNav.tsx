import React from 'react';
import { Role } from '../../types';
import { 
  Home, 
  Users, 
  CalendarCheck, 
  FileSpreadsheet, 
  Receipt as ReceiptIcon, 
  Settings, 
  Wallet,
  Menu
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface MobileTabItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isCenterAction?: boolean;
  isMenuTrigger?: boolean;
}

interface MobileBottomNavProps {
  currentRole: Role;
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenMenu: () => void;
  onOpenQuickCollect?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentRole,
  currentView,
  onNavigate,
  onOpenMenu,
  onOpenQuickCollect
}) => {
  const { t } = useLanguage();

  const adminTabs: MobileTabItem[] = [
    { id: 'dashboard', label: t('dashboard', 'Dashboard'), icon: Home },
    { id: 'customers', label: t('customers', 'Customers'), icon: Users },
    { id: 'daily-collections', label: t('collect', 'Collect'), icon: CalendarCheck, isCenterAction: true },
    { id: 'monthly-report', label: t('matrix', 'Matrix'), icon: FileSpreadsheet },
    { id: 'menu', label: t('more', 'More'), icon: Menu, isMenuTrigger: true },
  ];

  const collectorTabs: MobileTabItem[] = [
    { id: 'daily-collections', label: t('dailyCollections', 'Collections'), icon: CalendarCheck, isCenterAction: true },
    { id: 'daily-register', label: t('register', 'Register'), icon: FileSpreadsheet },
    { id: 'monthly-report', label: t('matrix', 'Matrix'), icon: FileSpreadsheet },
    { id: 'receipts', label: t('receipts', 'Receipts'), icon: ReceiptIcon },
    { id: 'menu', label: t('more', 'More'), icon: Menu, isMenuTrigger: true },
  ];

  const customerTabs: MobileTabItem[] = [
    { id: 'customer-dashboard', label: t('passbook', 'Passbook'), icon: Wallet },
    { id: 'notifications', label: t('alerts', 'Alerts'), icon: Home },
    { id: 'menu', label: t('profile', 'Profile'), icon: Menu, isMenuTrigger: true },
  ];

  const tabs: MobileTabItem[] = currentRole === 'CUSTOMER' ? customerTabs : currentRole === 'COLLECTOR' ? collectorTabs : adminTabs;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-navy-950/95 backdrop-blur-xl border-t border-gold-500/25 px-2 py-1.5 shadow-[0_-8px_20px_rgba(0,0,0,0.4)]">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentView === tab.id;

          if (tab.isCenterAction) {
            return (
              <button
                key={tab.id}
                onClick={() => onNavigate(tab.id)}
                className="relative -top-3.5 flex flex-col items-center justify-center p-3 rounded-full bg-gradient-to-r from-gold-500 to-amber-600 text-navy-950 shadow-lg shadow-gold-500/30 border-2 border-navy-950 active:scale-95 transition-transform"
                title={tab.label}
              >
                <Icon className="w-5 h-5 text-navy-950 stroke-[2.5]" />
                <span className="sr-only">{tab.label}</span>
              </button>
            );
          }

          if (tab.isMenuTrigger) {
            return (
              <button
                key={tab.id}
                onClick={onOpenMenu}
                className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-slate-400 hover:text-gold-400 active:scale-95 transition-all"
              >
                <Icon className="w-4 h-4 mb-0.5" />
                <span className="text-[10px] font-semibold tracking-tight">{tab.label}</span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all active:scale-95 ${
                isActive
                  ? 'text-gold-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'text-gold-400' : 'text-slate-400'}`} />
              <span className="text-[10px] font-semibold tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
