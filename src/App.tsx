import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { User, Notification } from './types';
import { api, SIGNED_OUT_EVENT } from './services/api';
import { LoginPage } from './components/auth/LoginPage';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { AdminDashboard } from './components/dashboard/AdminDashboard';
import { CustomerManagement, CustomersTab } from './components/customers/CustomerManagement';
import { CustomerPage } from './components/customers/CustomerPage';
import { CollectScreen } from './components/collect/CollectScreen';
import { CollectorHome } from './components/collector/CollectorHome';
import { AccountSettingsSheet } from './components/common/AccountSettingsSheet';
import { ReportsView, ReportTab } from './components/reports/ReportsView';
import { StaffAndAreasView } from './components/field/StaffAndAreasView';
import { SettingsView, SettingsTab } from './components/configuration/SettingsView';
import { UserManagementView } from './components/configuration/UserManagementView';
import { NotificationsView } from './components/notifications/NotificationsView';
import { CustomerHome } from './components/customer-portal/CustomerHome';
import { AdminView, AppView, CollectorView, CustomerView, HOME_VIEW } from './navigation/menus';
import { useLanguage } from './context/LanguageContext';

export function App() {
  const { t } = useLanguage();
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const cached = localStorage.getItem('krs_user');
    return cached ? JSON.parse(cached) : null;
  });

  const [currentView, setCurrentView] = useState<AppView>(() => (currentUser ? HOME_VIEW[currentUser.role] : 'home'));
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [focusAccountId, setFocusAccountId] = useState<string | null>(null);
  const [customersPreset, setCustomersPreset] = useState<{ tab?: CustomersTab; search?: string }>({});
  const [reportsTab, setReportsTab] = useState<ReportTab | undefined>(undefined);
  const [settingsTab, setSettingsTab] = useState<SettingsTab | undefined>(undefined);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  /** The ⚙️ sheet. Collectors and customers show it on their one screen (it needs their details). */
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!currentUser) return;
    setCurrentView(HOME_VIEW[currentUser.role]);
    loadNotifications();
  }, [currentUser?.id, currentUser?.role]);

  // A new installation (nothing set up, nobody added) starts in Settings, with the organisation.
  useEffect(() => {
    if (currentUser?.role !== 'ADMIN') return;
    Promise.all([api.getConfig(), api.getCustomers(), api.getCollectors()])
      .then(([config, customers, collectors]) => {
        if (!config.company.setup_completed && customers.length === 0 && collectors.length === 0) {
          setSettingsTab('organisation');
          setCurrentView('settings');
        }
      })
      .catch(() => undefined);
  }, [currentUser?.id, currentUser?.role]);

  // A sign-in the server no longer accepts goes back to the login page.
  useEffect(() => {
    const signedOut = () => handleLogout();
    window.addEventListener(SIGNED_OUT_EVENT, signedOut);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, signedOut);
  }, []);

  // Keeps this login's session showing as active in User Management while the app is open.
  useEffect(() => {
    if (!currentUser) return;
    const ping = () => api.heartbeat().catch(() => undefined);
    ping();
    const timer = setInterval(ping, 60000);
    return () => clearInterval(timer);
  }, [currentUser?.id]);

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
    api.logout().catch(() => undefined);
    localStorage.removeItem('krs_token');
    localStorage.removeItem('krs_user');
    setCurrentUser(null);
    setSelectedCustomerId(null);
    setFocusAccountId(null);
    setSettingsOpen(false);
  };

  /** Menu navigation: always starts the chosen screen fresh. */
  const navigate = (view: AppView) => {
    setSelectedCustomerId(null);
    setFocusAccountId(null);
    setCustomersPreset({});
    setReportsTab(undefined);
    setSettingsTab(undefined);
    setCurrentView(view);
  };

  const openReports = (tab: ReportTab) => {
    setReportsTab(tab);
    setCurrentView('reports');
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

  /** Collectors and customers have a single screen: no side menu or bottom bar. */
  const isOneScreen = currentUser.role !== 'ADMIN';

  const collectScreen = () => (
    <CollectScreen
      currentUser={currentUser}
      focusAccountId={focusAccountId}
      onClearFocus={() => setFocusAccountId(null)}
      onOpenCustomer={openCustomer}
      onOpenCollectorReports={() => openReports('collectors')}
    />
  );
  const notificationsScreen = () => (
    <NotificationsView currentRole={currentUser.role} customerId={currentUser.customer_id} />
  );

  const adminScreens: Record<AdminView, () => React.ReactNode> = {
    'home': () => (
      <AdminDashboard
        onOpenCollect={() => openCollect()}
        onOpenLoans={tab => openCustomers(tab)}
        onOpenReports={openReports}
        onOpenStaff={() => navigate('staff')}
        officeName={currentUser.name}
      />
    ),
    'collect': collectScreen,
    'customers': () => (
      <CustomerManagement
        key={`${customersPreset.tab ?? ''}|${customersPreset.search ?? ''}`}
        initialTab={customersPreset.tab}
        initialSearch={customersPreset.search}
        currentUser={currentUser}
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
    'reports': () => (
      <ReportsView key={reportsTab ?? ''} onOpenCustomer={openCustomer} officeName={currentUser.name} initialTab={reportsTab} />
    ),
    'staff': () => <StaffAndAreasView onOpenCustomer={openCustomer} />,
    'users': () => <UserManagementView />,
    'settings': () => <SettingsView key={settingsTab ?? ''} initialTab={settingsTab} />,
    'notifications': notificationsScreen,
  };

  /** The full message list of a one-screen app, with a way back to its screen. */
  const withBack = (content: React.ReactNode) => (
    <div className="max-w-2xl mx-auto space-y-3">
      <button
        type="button"
        onClick={() => navigate('home')}
        className="flex items-center gap-1.5 px-2 py-2 rounded-xl text-slate-200 hover:bg-slate-800 font-bold"
      >
        <ArrowLeft className="w-5 h-5" />
        {t('back', 'Back')}
      </button>
      {content}
    </div>
  );

  const collectorScreens: Record<CollectorView, () => React.ReactNode> = {
    'home': () => (
      <CollectorHome
        currentUser={currentUser}
        settingsOpen={settingsOpen}
        onCloseSettings={() => setSettingsOpen(false)}
        onLogout={handleLogout}
      />
    ),
    'notifications': () => withBack(notificationsScreen()),
  };

  const customerScreens: Record<CustomerView, () => React.ReactNode> = {
    'home': () => (
      <CustomerHome
        currentUser={currentUser}
        settingsOpen={settingsOpen}
        onCloseSettings={() => setSettingsOpen(false)}
        onLogout={handleLogout}
      />
    ),
    'notifications': () => withBack(notificationsScreen()),
  };

  const renderScreen = () => {
    switch (currentUser.role) {
      case 'ADMIN':
        return (adminScreens[currentView as AdminView] ?? adminScreens.home)();
      case 'COLLECTOR':
        return (collectorScreens[currentView as CollectorView] ?? collectorScreens.home)();
      default:
        return (customerScreens[currentView as CustomerView] ?? customerScreens.home)();
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex flex-col font-sans selection:bg-gold-500 selection:text-navy-950">
      <Navbar
        onGoHome={() => navigate(HOME_VIEW[currentUser.role])}
        onSearch={currentUser.role === 'ADMIN' ? query => openCustomers('all', query) : undefined}
        notifications={notifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        onViewAllNotifications={() => navigate('notifications')}
        onOpenMenu={() => setMobileMenuOpen(true)}
        showMenuButton={!isOneScreen}
        onOpenSettings={() => {
          if (isOneScreen) navigate('home');
          setSettingsOpen(true);
        }}
      />

      <div className="flex-1 flex overflow-hidden">
        {!isOneScreen && (
        <Sidebar
          currentRole={currentUser.role}
          currentView={currentView === 'customer-page' ? 'customers' : currentView}
          onNavigate={navigate}
          onLogout={handleLogout}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />
        )}

        <main className={`flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 lg:p-8 ${isOneScreen ? 'pb-8' : 'pb-24 lg:pb-8'} bg-gradient-to-b from-navy-950 via-navy-900 to-navy-950`}>
          <div className="max-w-6xl mx-auto">{renderScreen()}</div>
        </main>
      </div>

      {!isOneScreen && settingsOpen && (
        <AccountSettingsSheet
          details={[
            [t('name', 'Name'), currentUser.name],
            [t('mobile', 'Mobile'), currentUser.phone],
          ]}
          onLogout={handleLogout}
          onClose={() => setSettingsOpen(false)}
          changeViaOffice={false}
        />
      )}

      {!isOneScreen && (
        <MobileBottomNav
          currentRole={currentUser.role}
          currentView={currentView === 'customer-page' ? 'customers' : currentView}
          onNavigate={navigate}
          onOpenMenu={() => setMobileMenuOpen(true)}
        />
      )}
    </div>
  );
}

export default App;
