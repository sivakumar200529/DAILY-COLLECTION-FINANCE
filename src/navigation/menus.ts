import React from 'react';
import {
  Home,
  Users,
  CalendarCheck,
  FileText,
  UserCheck,
  Settings,
  Wallet,
  ClipboardList,
  Bell,
} from 'lucide-react';
import { Role } from '../types';

/**
 * Every screen of each role, and which of them appear in the menu and the phone's bottom bar.
 * Views not in a menu (customer-page, notifications) are opened from inside other screens.
 * App.tsx maps each view to its component; the Record types there make a missing screen a
 * compile error.
 */
export type AdminView = 'home' | 'collect' | 'customers' | 'customer-page' | 'reports' | 'staff' | 'settings' | 'notifications';
export type CollectorView = 'collect' | 'my-day' | 'notifications';
export type CustomerView = 'passbook' | 'notifications';
export type AppView = AdminView | CollectorView | CustomerView;

export interface MenuItem {
  id: AppView;
  labelKey: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ADMIN_MENU: MenuItem[] = [
  { id: 'home', labelKey: 'navHome', label: 'Home', icon: Home },
  { id: 'collect', labelKey: 'navCollect', label: 'Collect', icon: CalendarCheck },
  { id: 'customers', labelKey: 'customers', label: 'Customers', icon: Users },
  { id: 'reports', labelKey: 'reports', label: 'Reports', icon: FileText },
  { id: 'staff', labelKey: 'navStaffAreas', label: 'Staff & areas', icon: UserCheck },
  { id: 'settings', labelKey: 'settings', label: 'Settings', icon: Settings },
];

const COLLECTOR_MENU: MenuItem[] = [
  { id: 'collect', labelKey: 'navCollect', label: 'Collect', icon: CalendarCheck },
  { id: 'my-day', labelKey: 'navMyDay', label: 'My day', icon: ClipboardList },
];

const CUSTOMER_MENU: MenuItem[] = [
  { id: 'passbook', labelKey: 'navPassbook', label: 'Passbook', icon: Wallet },
  { id: 'notifications', labelKey: 'navMessages', label: 'Messages', icon: Bell },
];

export const MENUS: Record<Role, MenuItem[]> = {
  ADMIN: ADMIN_MENU,
  COLLECTOR: COLLECTOR_MENU,
  CUSTOMER: CUSTOMER_MENU,
};

/** First screen after login. */
export const HOME_VIEW: Record<Role, AppView> = {
  ADMIN: 'home',
  COLLECTOR: 'collect',
  CUSTOMER: 'passbook',
};

/** Phone bottom bar: `center` is the big round action button; `more` opens the full menu. */
export const BOTTOM_TABS: Record<Role, { id: AppView; center?: boolean }[]> = {
  ADMIN: [{ id: 'home' }, { id: 'customers' }, { id: 'collect', center: true }, { id: 'reports' }],
  COLLECTOR: [{ id: 'collect', center: true }, { id: 'my-day' }],
  CUSTOMER: [{ id: 'passbook' }, { id: 'notifications' }],
};

/** Roles whose bottom bar ends with a "More" button that opens the side menu. */
export const HAS_MORE_MENU: Record<Role, boolean> = { ADMIN: true, COLLECTOR: true, CUSTOMER: false };

export function menuItem(role: Role, id: AppView): MenuItem | undefined {
  return MENUS[role].find(item => item.id === id);
}
