import React, { useState, useEffect } from 'react';
import { User, Notification } from './types';
import { api } from './services/api';
import { LoginPage } from './components/auth/LoginPage';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { AdminDashboard } from './components/dashboard/AdminDashboard';
import { CustomerManagement, CustomersTab } from './components/customers/CustomerManagement';
import { CustomerPage } from './components/customers/CustomerPage';
import { CollectScreen } from './components/collect/CollectScreen';
import { MyDayView } from './components/collect/MyDayView';
import { ReportsView } from './components/reports/ReportsView';
import { StaffAndAreasView } from './components/field/StaffAndAreasView';
import { SettingsView } from './components/configuration/SettingsView';
import { UserManagementView } from './components/configuration/UserManagementView';
import { NotificationsView } from './components/notifications/NotificationsView';
import { Passbook } from './components/customer-portal/Passbook';
import { AdminView, AppView, CollectorView, CustomerView, HOME_VIEW } from './navigation/menus';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const cached = localStorage.getItem('krs_user');
    return cached ? JSON.parse(cached) : null;
  });

  const [currentView, setCurrentView] = useState<AppView>(() => (currentUser ? HOME_VIEW[currentUser.role] : 'home'));
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [focusAccountId, setFocusAccountId] = useState<string | null>(null);
  const [customersPreset, setCustomersPreset] = useState<{ tab?: CustomersTab; search?: string }>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!currentUser) return;
    setCurrentView(HOME_VIEW[currentUser.role]);
    loadNotifications();
  }, [currentUser?.id, currentUser?.role]);

  const loadNotifications = async () => {
    if (!currentUser) return;
    try {
      setNotifications(await api.getNotifications({ role: currentUser.role, customer_id: currentUser.customer_id }));
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setCurrentView(HOME_VIEW[user.role]);
  };

  const handleLogout = () => {
    localStorage.removeItem('krs_token');
    localStorage.removeItem('krs_user');
    setCurrentUser(null);
    setSelectedCustomerId(null);
    setFocusAccountId(null);
  };

  /** Menu navigation: always starts the chosen screen fresh. */
  const navigate = (view: AppView) => {
    setSelectedCustomerId(null);
    setFocusAccountId(null);
    setCustomersPreset({});
    setCurrentView(view);
  };

  const openCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setCurrentView('customer-page');
  };

  const openCollect = (accountId?: string) => {
    setFocusAccountId(accountId ?? null);
    setCurrentView('collect');
  };

  const openCustomers = (tab?: CustomersTab, search?: string) => {
    setCustomersPreset({ tab, search });
    setSelectedCustomerId(null);
    setCurrentView('customers');
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, is_read: true } : n)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const collectScreen = () => (
    <CollectScreen
      currentUser={currentUser}
      focusAccountId={focusAccountId}
      onClearFocus={() => setFocusAccountId(null)}
      onOpenCustomer={currentUser.role === 'ADMIN' ? openCustomer : undefined}
    />
  );
  const notificationsScreen = () => (
    <NotificationsView currentRole={currentUser.role} customerId={currentUser.customer_id} />
  );

  const adminScreens: Record<AdminView, () => React.ReactNode> = {
    'home': () => (
      <AdminDashboard onOpenCollect={() => openCollect()} onOpenCustomers={tab => openCustomers(tab)} />
    ),
    'collect': collectScreen,
    'customers': () => (
      <CustomerManagement
        key={`${customersPreset.tab ?? ''}|${customersPreset.search ?? ''}`}
        initialTab={customersPreset.tab}
        initialSearch={customersPreset.search}
        onOpenCustomer={openCustomer}
        onCollect={openCollect}
      />
    ),
    'customer-page': () => selectedCustomerId ? (
      <CustomerPage
        customerId={selectedCustomerId}
        currentUser={currentUser}
        onBack={() => openCustomers()}
        onCollect={openCollect}
      />
    ) : adminScreens['customers'](),
    'reports': () => <ReportsView onOpenCustomer={openCustomer} />,
    'staff': () => <StaffAndAreasView />,
    'users': () => <UserManagementView />,
    'settings': () => <SettingsView />,
    'notifications': notificationsScreen,
  };

  const collectorScreens: Record<CollectorView, () => React.ReactNode> = {
    'collect': collectScreen,
    'my-day': () => <MyDayView currentUser={currentUser} />,
    'notifications': notificationsScreen,
  };

  const customerScreens: Record<CustomerView, () => React.ReactNode> = {
    'passbook': () => <Passbook currentUser={currentUser} />,
    'notifications': notificationsScreen,
  };

  const renderScreen = () => {
    switch (currentUser.role) {
      case 'ADMIN':
        return (adminScreens[currentView as AdminView] ?? adminScreens.home)();
      case 'COLLECTOR':
        return (collectorScreens[currentView as CollectorView] ?? collectorScreens.collect)();
      default:
        return (customerScreens[currentView as CustomerView] ?? customerScreens.passbook)();
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex flex-col font-sans selection:bg-gold-500 selection:text-navy-950">
      <Navbar
        currentUser={currentUser}
        onLogout={handleLogout}
        onGoHome={() => navigate(HOME_VIEW[currentUser.role])}
        onSearch={currentUser.role === 'ADMIN' ? query => openCustomers('all', query) : undefined}
        notifications={notifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        onViewAllNotifications={() => navigate('notifications')}
        onOpenMenu={() => setMobileMenuOpen(true)}
        showMenuButton={currentUser.role !== 'CUSTOMER'}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentRole={currentUser.role}
          currentView={currentView === 'customer-page' ? 'customers' : currentView}
          onNavigate={navigate}
          onLogout={handleLogout}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />

        <main className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 lg:p-8 pb-24 lg:pb-8 bg-gradient-to-b from-navy-950 via-navy-900 to-navy-950">
          <div className="max-w-6xl mx-auto">{renderScreen()}</div>
        </main>
      </div>

      <MobileBottomNav
        currentRole={currentUser.role}
        currentView={currentView === 'customer-page' ? 'customers' : currentView}
        onNavigate={navigate}
        onOpenMenu={() => setMobileMenuOpen(true)}
      />
    </div>
  );
}

export default App;
