import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarCheck,
  TrendingUp,
  Coins,
  ArrowDownRight,
  RefreshCw,
  Users,
} from 'lucide-react';
import { DashboardStats } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { todayIso } from '../../../shared/finance';
import { useLanguage } from '../../context/LanguageContext';
import { ProgressBar, Spinner, StatTile } from '../common/ui';
import type { CustomersTab } from '../customers/CustomerManagement';

interface AdminDashboardProps {
  onOpenCollect: () => void;
  onOpenCustomers: (tab?: CustomersTab) => void;
}

/** Home: Live total balance, total amount want to collect, and today's collection register. */
export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onOpenCollect, onOpenCustomers }) => {
  const { t } = useLanguage();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);

  const loadStats = async () => {
    try {
      const data = await api.getDashboardStats();
      setStats(data);
    } catch {
      setStats(null);
    }
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const data = await api.getDashboardStats();
      setStats(data);
      setRefreshed(true);
      setTimeout(() => setRefreshed(false), 2200);
    } catch {
      // If network glitch, try reloading
      window.location.reload();
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (!stats) return <Spinner />;

  return (
    <div className="space-y-4 pb-8">
      {/* Header with Title, Date, and Active Refresh button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">{t('dashboard', 'Dashboard')}</h1>
          <p className="text-sm text-slate-400">{formatDate(todayIso())}</p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          title={t('refresh', 'Refresh Dashboard')}
          className={`p-2.5 sm:px-4 sm:py-2.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-2 text-xs font-bold ${
            refreshed
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-md shadow-emerald-500/20'
              : 'bg-navy-900 border-slate-700 text-slate-300 hover:text-white hover:border-gold-500/50'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-gold-400' : refreshed ? 'text-emerald-400' : 'text-slate-400'}`} />
          <span>{refreshing ? t('refreshing', 'Refreshing...') : refreshed ? t('refreshed', '✓ Updated!') : t('refresh', 'Refresh')}</span>
        </button>
      </div>

      {/* CORE FINANCIAL BALANCES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. TOTAL AMOUNT WANT TO COLLECT */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onOpenCustomers('all')}
          onKeyDown={e => e.key === 'Enter' && onOpenCustomers('all')}
          className="glass-card rounded-3xl p-6 border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-navy-900/85 to-navy-950 relative overflow-hidden group cursor-pointer hover:border-amber-400/80 transition-all shadow-xl hover:shadow-amber-500/10"
        >
          <div className="absolute -top-16 -right-16 w-40 h-40 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center justify-between mb-3 relative z-10">
            <div className="flex items-center gap-2.5 text-amber-300 font-bold text-sm sm:text-base">
              <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 shadow-inner">
                <ArrowDownRight className="w-5 h-5 text-amber-400" />
              </div>
              <span>{t('totalAmountWantToCollect', 'Total Amount Want to Collect')}</span>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 shadow-sm">
              📉 {t('reducesWithCollection', 'Reduces as paid')}
            </span>
          </div>

          <div className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight my-2 relative z-10">
            {formatCurrency(stats.totalOutstanding)}
          </div>

          <div className="text-xs text-slate-400 flex items-center justify-between pt-3 border-t border-slate-800/80 relative z-10">
            <span>
              {t('totalRepayment', 'Total Loan Target')}:{' '}
              <strong className="text-slate-200 font-mono">{formatCurrency(stats.totalRepayment)}</strong>
            </span>
            <span className="text-amber-400 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-1">
              {stats.activeAccounts} {t('viewLoans', 'View loans')} →
            </span>
          </div>
        </div>

        {/* 2. COLLECT AMOUNT STORE IN TOTAL BALANCE & REDUCES ON NEW CUSTOMER LOAN */}
        <div className="glass-card rounded-3xl p-6 border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 via-navy-900/85 to-navy-950 relative overflow-hidden shadow-xl">
          <div className="absolute -top-16 -right-16 w-40 h-40 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center justify-between mb-3 relative z-10">
            <div className="flex items-center gap-2.5 text-emerald-300 font-bold text-sm sm:text-base">
              <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 shadow-inner">
                <Coins className="w-5 h-5 text-emerald-400" />
              </div>
              <span>{t('totalBalance', 'Total Balance')}</span>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shadow-sm">
              📉 {t('deductsOnNewLoan', 'Reduces on new customer loan')}
            </span>
          </div>

          <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono tracking-tight my-2 relative z-10">
            {formatCurrency(stats.totalBalance !== undefined ? stats.totalBalance : (stats.totalCollected - stats.totalDisbursed))}
          </div>

          <div className="text-xs text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-3 border-t border-slate-800/80 relative z-10">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span>
                {t('today', 'Today')}: <strong className="text-emerald-300 font-mono">+{formatCurrency(stats.todayCollected)}</strong>
              </span>
              <span className="text-slate-600">•</span>
              <span>
                {t('collected', 'Collected')}: <strong className="text-emerald-400 font-mono">+{formatCurrency(stats.totalCollected)}</strong>
              </span>
              <span className="text-slate-600">•</span>
              <span>
                {t('disbursed', 'Disbursed')}: <strong className="text-rose-400 font-mono">-{formatCurrency(stats.totalDisbursed)}</strong>
              </span>
            </div>
            <span className="text-emerald-400 font-semibold">
              {t('balanceFormulaNote', 'Deducts for new customer loans, increases as collected')}
            </span>
          </div>
        </div>
      </div>

      {/* TODAY'S COLLECTION INTERACTIVE TILE */}
      <button
        type="button"
        onClick={onOpenCollect}
        className="w-full glass-card glass-card-hover rounded-2xl p-5 text-left space-y-4 cursor-pointer border border-gold-500/20 hover:border-gold-500/40 relative overflow-hidden transition-all shadow-lg"
      >
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between relative z-10">
          <div className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gold-500/20 border border-gold-500/30">
              <CalendarCheck className="w-4 h-4 text-gold-400" />
            </div>
            <span>{t('dailyRegister', "Today's Collection Register")}</span>
          </div>
          <span className="text-xs font-bold text-gold-400 hover:text-gold-300 transition-colors">{t('openCollect', 'Open Daily Collection')} →</span>
        </div>

        <div className="grid grid-cols-3 gap-3 relative z-10">
          <div>
            <div className="text-xs text-slate-400 font-semibold">{t('toCollect', 'To collect today')}</div>
            <div className="text-xl sm:text-3xl font-black text-white font-mono">{formatCurrency(stats.todayExpected)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">{t('collected', 'Collected today')}</div>
            <div className="text-xl sm:text-3xl font-black text-emerald-400 font-mono">{formatCurrency(stats.todayCollected)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">{t('left', 'Left today')}</div>
            <div className="text-xl sm:text-3xl font-black text-gold-300 font-mono">{formatCurrency(stats.todayPending)}</div>
          </div>
        </div>

        <div className="relative z-10 pt-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1.5">
            <span>{t('collectionProgress', 'Collection Progress')}</span>
            <span className="text-emerald-400 font-bold font-mono">{stats.todayCollectionRate}%</span>
          </div>
          <ProgressBar percent={stats.todayCollectionRate} />
        </div>
      </button>

      {/* SUPPORTING KPIS: Monthly collection, Not paying, Active accounts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatTile
          icon={TrendingUp}
          tone="green"
          label={t('collectedThisMonth', 'Collected this month')}
          value={formatCurrency(stats.monthlyCollection)}
        />
        <StatTile
          icon={AlertTriangle}
          tone="red"
          label={t('tabNotPaying', 'Not paying')}
          value={String(stats.notPayingCount)}
          hint={t('customers', 'Customers behind schedule')}
          onClick={() => onOpenCustomers('not-paying')}
        />
        <StatTile
          icon={Users}
          tone="gold"
          label={t('activeLoans', 'Active Loans')}
          value={`${stats.activeAccounts}`}
          hint={`${stats.totalCustomers} ${t('customers', 'Customers')}`}
          onClick={() => onOpenCustomers('all')}
        />
      </div>
    </div>
  );
};
