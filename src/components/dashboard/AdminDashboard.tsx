import React, { useEffect, useState } from 'react';
import { DashboardStats, DashboardCharts } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatPercent } from '../../utils/formatters';
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
  ArrowUpRight, 
  ArrowRight,
  PlusCircle,
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend 
} from 'recharts';

interface AdminDashboardProps {
  onNavigate: (view: string) => void;
  onOpenQuickCollect: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onNavigate,
  onOpenQuickCollect,
}) => {
  const { t } = useLanguage();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [charts, setCharts] = useState<DashboardCharts | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [s, c] = await Promise.all([
        api.getDashboardStats(),
        api.getDashboardCharts(),
      ]);
      setStats(s);
      setCharts(c);
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
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
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
        </div>

        {/* Quick Action Ribbon */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenQuickCollect}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-bold text-xs shadow-md shadow-gold-500/20 flex items-center gap-1.5 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              {t('collectPayment', 'Collect Payment')}
            </button>
            <button
              onClick={() => onNavigate('daily-collections')}
              className="px-3.5 py-1.5 rounded-xl bg-navy-950 border border-slate-700 hover:border-gold-500/40 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <CalendarCheck className="w-4 h-4 text-gold-400" />
              {t('dailyRegister', 'Daily Collection Register')}
            </button>
            <button
              onClick={() => onNavigate('monthly-report')}
              className="px-3.5 py-1.5 rounded-xl bg-navy-950 border border-slate-700 hover:border-gold-500/40 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              {t('monthlyMatrix', 'Monthly Excel Matrix')}
            </button>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 rounded-xl bg-navy-950 border border-slate-800 text-slate-400 hover:text-white transition-all text-xs flex items-center gap-1.5"
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

      {/* Recharts Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Daily Collection Trend (Expected vs Collected) */}
        <div className="lg:col-span-2 glass-card p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-gold-400" />
                {t('dailyCollectionPerformanceTrend', 'Daily Collection Performance Trend')}
              </h3>
              <p className="text-xs text-slate-400">{t('expectedVsActualDoorstep', 'Expected vs Actual Doorstep Collections (Past 14 Days)')}</p>
            </div>
            <span className="text-xs text-slate-400 font-mono">{t('dailyInInr', 'Daily in INR (₹)')}</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts?.dailyTrend || []}>
                <defs>
                  <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => `₹${val}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(value: any) => [`₹${value}`, '']}
                />
                <Legend />
                <Area type="monotone" dataKey="expected" name={t('expectedDue', 'Expected Due')} stroke="#f59e0b" fillOpacity={1} fill="url(#colorExpected)" />
                <Area type="monotone" dataKey="collected" name={t('actuallyCollected', 'Actually Collected')} stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorCollected)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Payment Status Distribution Donut */}
        <div className="glass-card p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-gold-400" />
              {t('todaysPaymentStatus', "Today's Payment Status")}
            </h3>
            <p className="text-xs text-slate-400 mb-4">{t('paymentStatusBreakdownDesc', 'Paid, Partial, Pending & Overdue Accounts')}</p>
          </div>

          <div className="h-52 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts?.paymentStatusDistribution || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {(charts?.paymentStatusDistribution || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800">
            {(charts?.paymentStatusDistribution || []).map((s) => (
              <div key={s.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-slate-300 text-[11px] truncate">{t(s.name, s.name)}: <strong className="text-white">{s.value}</strong></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Monthly Performance & Finance Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 3: Monthly Collection Performance */}
        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-emerald-400" />
                {t('monthlyCollectionProgress', 'Monthly Collection Progress')}
              </h3>
              <p className="text-xs text-slate-400">{t('monthlyCollectedVsTarget', 'Monthly Collected vs Target')}</p>
            </div>
            <button
              onClick={() => onNavigate('monthly-report')}
              className="text-xs text-gold-400 hover:text-gold-300 font-semibold flex items-center gap-1"
            >
              {t('excelMatrix', 'Excel Matrix')} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts?.monthlyTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => `₹${val / 1000}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(val: any) => [`₹${val.toLocaleString('en-IN')}`, '']}
                />
                <Legend />
                <Bar dataKey="collected" name={t('collected', 'Collected') + ' (₹)'} fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="disbursed" name={t('disbursed', 'Disbursed') + ' (₹)'} fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Finance Summary Comparison */}
        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gold-400" />
                {t('portfolioFinanceSummary', 'Portfolio Finance Summary')}
              </h3>
              <p className="text-xs text-slate-400">{t('portfolioFinanceSummaryDesc', 'Total Disbursed vs Repayment vs Margin vs Outstanding')}</p>
            </div>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={charts?.financeSummary || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={(val) => `₹${val / 1000}k`} />
                <YAxis type="category" dataKey="name" stroke="#cbd5e1" fontSize={11} width={85} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(val: any) => [`₹${val.toLocaleString('en-IN')}`, 'Amount']}
                />
                <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                  {(charts?.financeSummary || []).map((entry, index) => (
                    <Cell key={`bar-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
