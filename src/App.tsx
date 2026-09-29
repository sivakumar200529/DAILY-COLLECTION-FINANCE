import React, { useState, useEffect } from 'react';
import { User, Role, Notification } from './types';
import { api } from './services/api';
import { LoginPage } from './components/auth/LoginPage';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { AdminDashboard } from './components/dashboard/AdminDashboard';
import { CustomerManagement } from './components/customers/CustomerManagement';
import { CustomerProfile360 } from './components/customers/CustomerProfile360';
import { DailyCollectionScreen } from './components/collections/DailyCollectionScreen';
import { DailyCollectionRegisterView } from './components/collections/DailyCollectionRegisterView';
import { CollectionAccountsView } from './components/accounts/CollectionAccountsView';
import { CollectionPlansView } from './components/plans/CollectionPlansView';
import { MonthlyExcelReportView } from './components/reports/MonthlyExcelReportView';
import { ReceiptsMasterView } from './components/collections/ReceiptsMasterView';
import { CollectorsView } from './components/collectors/CollectorsView';
import { AreasView } from './components/areas/AreasView';
import { KYCDocumentsView } from './components/documents/KYCDocumentsView';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';
import { NotificationsView } from './components/notifications/NotificationsView';
import { CustomerDashboard } from './components/customer-portal/CustomerDashboard';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const cached = localStorage.getItem('krs_user');
    return cached ? JSON.parse(cached) : null;
  });

  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [preselectedAccountId, setPreselectedAccountId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Sync initial view when role changes
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'CUSTOMER') {
        setCurrentView('customer-dashboard');
      } else if (currentUser.role === 'COLLECTOR') {
        setCurrentView('daily-collections');
      } else {
        setCurrentView('dashboard');
      }
      loadNotifications();
    }
  }, [currentUser?.id, currentUser?.role]);

  const loadNotifications = async () => {
    if (!currentUser) return;
    try {
      const list = await api.getNotifications({
        role: currentUser.role,
        customer_id: currentUser.customer_id,
      });
      setNotifications(list);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  const handleLoginSuccess = (user: User, token: string) => {
    setCurrentUser(user);
    if (user.role === 'CUSTOMER') {
      setCurrentView('customer-dashboard');
    } else if (user.role === 'COLLECTOR') {
      setCurrentView('daily-collections');
    } else {
      setCurrentView('dashboard');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('krs_token');
    localStorage.removeItem('krs_user');
    setCurrentUser(null);
    setCurrentView('dashboard');
    setSelectedCustomerId(null);
  };

  const handleSelectCustomer = (custId: string) => {
    setSelectedCustomerId(custId);
    setCurrentView('customer-profile');
  };

  const handleOpenQuickCollect = (accountId?: string) => {
    if (accountId) setPreselectedAccountId(accountId);
    setCurrentView('daily-collections');
  };

  const handleGlobalSearch = (query: string) => {
    const q = query.trim().toUpperCase();
    if (currentUser?.role === 'COLLECTOR') {
      setCurrentView('daily-collections');
      return;
    }
    if (q.startsWith('DC') || q.startsWith('KRS')) {
      handleSelectCustomer(q);
    } else if (query.trim()) {
      setCurrentView('customers');
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  // If not logged in, render the luxury login screen
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex flex-col font-sans selection:bg-gold-500 selection:text-navy-950">
      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        onLogout={handleLogout}
        onNavigate={setCurrentView}
        onOpenQuickCollect={() => handleOpenQuickCollect()}
        onGlobalSearch={handleGlobalSearch}
        notifications={notifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      {/* Main Layout Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          currentRole={currentUser.role}
          currentView={currentView}
          onNavigate={(view) => {
            setCurrentView(view);
            if (view !== 'customer-profile') setSelectedCustomerId(null);
          }}
          onLogout={handleLogout}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />

        {/* Content View Container */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-gradient-to-b from-navy-950 via-navy-900 to-navy-950">
          {/* 3. CUSTOMER PORTAL VIEWS */}
          {currentUser.role === 'CUSTOMER' && (
            <>
              {currentView === 'notifications' ? (
                <NotificationsView currentRole={currentUser.role} customerId={currentUser.customer_id} />
              ) : (
                <CustomerDashboard currentUser={currentUser} onLogout={handleLogout} />
              )}
            </>
          )}

          {/* 2. COLLECTION AGENT VIEWS (CAN ONLY COLLECT FUNDS & VIEW RELATED REPORTS) */}
          {currentUser.role === 'COLLECTOR' && (
            <>
              {(currentView === 'daily-collections' || !['daily-register', 'monthly-report', 'receipts', 'reports', 'notifications'].includes(currentView)) && (
                <DailyCollectionScreen
                  onNavigateToCustomer={handleSelectCustomer}
                  onNavigateToRegister={() => setCurrentView('daily-register')}
                  preselectedAccountId={preselectedAccountId}
                  currentUser={currentUser}
                />
              )}

              {currentView === 'daily-register' && (
                <DailyCollectionRegisterView
                  onBack={() => setCurrentView('daily-collections')}
                />
              )}

              {currentView === 'monthly-report' && (
                <MonthlyExcelReportView />
              )}

              {currentView === 'receipts' && (
                <ReceiptsMasterView />
              )}

              {currentView === 'reports' && (
                <ReportsView />
              )}

              {currentView === 'notifications' && (
                <NotificationsView currentRole={currentUser.role} />
              )}
            </>
          )}

          {/* 1. MASTER ADMIN VIEWS (CAN DO ANYTHING: ALL OPTIONS & MANAGEMENT) */}
          {currentUser.role === 'ADMIN' && (
            <>
              {currentView === 'dashboard' && (
                <AdminDashboard
                  onNavigate={setCurrentView}
                  onOpenQuickCollect={() => handleOpenQuickCollect()}
                />
              )}

              {currentView === 'customers' && (
                <CustomerManagement
                  onSelectCustomer={handleSelectCustomer}
                  onOpenQuickCollect={handleOpenQuickCollect}
                />
              )}

              {currentView === 'customer-profile' && selectedCustomerId && (
                <CustomerProfile360
                  customerId={selectedCustomerId}
                  onBack={() => setCurrentView('customers')}
                  onOpenCollectForCustomer={handleOpenQuickCollect}
                />
              )}

              {currentView === 'accounts' && (
                <CollectionAccountsView
                  onSelectCustomer={handleSelectCustomer}
                  onOpenQuickCollect={handleOpenQuickCollect}
                />
              )}

              {currentView === 'daily-collections' && (
                <DailyCollectionScreen
                  onNavigateToCustomer={handleSelectCustomer}
                  onNavigateToRegister={() => setCurrentView('daily-register')}
                  preselectedAccountId={preselectedAccountId}
                  currentUser={currentUser}
                />
              )}

              {currentView === 'daily-register' && (
                <DailyCollectionRegisterView
                  onBack={() => setCurrentView('daily-collections')}
                />
              )}

              {currentView === 'monthly-report' && (
                <MonthlyExcelReportView />
              )}

              {currentView === 'receipts' && (
                <ReceiptsMasterView />
              )}

              {currentView === 'collectors' && (
                <CollectorsView />
              )}

              {currentView === 'areas' && (
                <AreasView />
              )}

              {currentView === 'documents' && (
                <KYCDocumentsView />
              )}

              {currentView === 'plans' && (
                <CollectionPlansView />
              )}

              {currentView === 'reports' && (
                <ReportsView />
              )}

              {currentView === 'notifications' && (
                <NotificationsView currentRole={currentUser.role} />
              )}

              {currentView === 'settings' && (
                <SettingsView />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
