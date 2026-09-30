import React, { useEffect, useState } from 'react';
import { DashboardStats } from '../../types';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Users, 
  Wallet, 
  CalendarCheck, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  ShieldCheck, 
  DollarSign, 
  CheckCircle2, 
  RefreshCw 
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigate: (view: string) => void;
  onOpenQuickCollect?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onNavigate,
}) => {
  const { t } = useLanguage();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const s = await api.getDashboardStats();
      setStats(s);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-400 font-semibold tracking-wider">{t('loadingDashboard', 'LOADING DASHBOARD...')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Top Banner: Daily Collection Management Hub */}
      <div className="relative overflow-hidden rounded-2xl p-5 md:p-6 bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 border border-gold-500/30 shadow-2xl">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-gold-500/20 border border-gold-500/40 text-[10px] font-bold text-gold-300 uppercase tracking-widest">
                {t('financialOperations', 'Financial Operations')}
              </span>
              <span className="text-xs text-slate-400 font-mono">{t('100DayCycle', '100-Day Daily Cycle')}</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
              {t('appName', 'DAILY COLLECTION')} <span className="text-gold-400">{t('managementHub', 'MANAGEMENT HUB')}</span>
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              {t('appTagline', 'Disbursing micro-growth capital to local shop owners with daily doorstep repayments, digital receipts, and real-time ledger accounting.')}
            </p>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 px-3 rounded-xl bg-navy-950/80 border border-slate-700 hover:border-gold-500/50 text-slate-300 hover:text-white transition-all text-xs flex items-center gap-1.5 shadow-sm cursor-pointer self-start sm:self-auto"
            title={t('Refresh Dashboard', 'Refresh Dashboard')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-gold-400' : ''}`} />
            <span>{t('sync', 'Sync')}</span>
          </button>
        </div>
      </div>

      {/* 9 Summary Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
        {/* 1. Total Customers */}
        <div 
          onClick={() => onNavigate('customers')}
          className="glass-card glass-card-hover p-4 rounded-2xl cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t('totalCustomers', 'Total Customers')}</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-extrabold text-white">
            {stats?.totalCustomers || 0}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">{t('activeShopsVendors', 'Active shops & vendors')}</span>
        </div>

        {/* 2. Active Collection Accounts */}
        <div 
          onClick={() => onNavigate('accounts')}
          className="glass-card glass-card-hover p-4 rounded-2xl cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t('activeAccounts', 'Active Accounts')}</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-extrabold text-white">
            {stats?.activeAccounts || 0}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">{t('underActive100DayCycles', 'Under active 100-day cycles')}</span>
        </div>

        {/* 3. Today's Expected Collection */}
        <div className="glass-card p-4 rounded-2xl border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider">{t('todayExpected', "Today's Expected")}</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-extrabold text-white">
            {formatCurrency(stats?.todayExpected)}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">{t('scheduledDueToday', 'Scheduled due today')}</span>
        </div>

        {/* 4. Today's Collected Amount */}
        <div className="glass-card p-4 rounded-2xl border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider">{t('todayCollected', "Today's Collected")}</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-extrabold text-emerald-400">
            {formatCurrency(stats?.todayCollected)}
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-emerald-300">
            <span className="font-bold">{stats?.todayCollectionRate}%</span>
            <span>{t('collectionRate', 'collection rate')}</span>
          </div>
        </div>

        {/* 5. Today's Pending Amount */}
        <div className="glass-card p-4 rounded-2xl border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">{t('todayPending', "Today's Pending")}</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-extrabold text-amber-400">
            {formatCurrency(stats?.todayPending)}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">{t('pendingFieldVisits', 'Pending field visits')}</span>
        </div>

        {/* 6. Monthly Collection */}
        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t('monthlyCollection', 'Monthly Collection')}</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-extrabold text-white">
            {formatCurrency(stats?.monthlyCollection)}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">{t('currentCalendarMonth', 'Current calendar month')}</span>
        </div>

        {/* 7. Total Outstanding */}
        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t('totalOutstanding', 'Total Outstanding')}</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-extrabold text-white">
            {formatCurrency(stats?.totalOutstanding)}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">{t('remainingBalanceInField', 'Remaining balance in field')}</span>
        </div>

        {/* 8. Total Finance Margin */}
        <div className="glass-card p-4 rounded-2xl bg-gradient-to-br from-gold-900/20 via-navy-900 to-navy-900 border border-gold-500/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-gold-400 uppercase tracking-wider">{t('financeMargin', 'Finance Margin')}</span>
            <div className="p-2 rounded-xl bg-gold-500/20 text-gold-300">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black text-gold-400">
            {formatCurrency(stats?.totalFinanceMargin)}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">{t('netMarginYield', 'Net interest/margin yield')}</span>
        </div>

        {/* 9. Overdue Customers */}
        <div 
          onClick={() => onNavigate('daily-collections')}
          className="glass-card glass-card-hover p-4 rounded-2xl cursor-pointer border border-rose-500/30"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-rose-300 uppercase tracking-wider">{t('overdueAccounts', 'Overdue Accounts')}</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-extrabold text-rose-400">
            {stats?.overdueCustomersCount || 0}
          </div>
          <span className="text-[10px] text-rose-300/80 mt-1 block">{t('requiresFollowUp', 'Requires collector follow-up')}</span>
        </div>

        {/* 10. Today's Progress Card */}
        <div className="glass-card p-4 rounded-2xl bg-navy-900/60">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">{t('todaysProgress', "Today's Progress")}</span>
          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden mb-2">
            <div 
              className="bg-gradient-to-r from-gold-500 to-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, stats?.todayCollectionRate || 0)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-semibold">
            <span className="text-slate-400">{t('collected', 'Collected')}: {formatCurrency(stats?.todayCollected)}</span>
            <span className="text-gold-400">{stats?.todayCollectionRate}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
