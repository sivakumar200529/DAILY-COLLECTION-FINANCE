import React, { useEffect, useState } from 'react';
import { AlertTriangle, CalendarCheck, TrendingUp, Wallet } from 'lucide-react';
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

/** Home: today's collection first, then the three numbers the owner checks every day. */
export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onOpenCollect, onOpenCustomers }) => {
  const { t } = useLanguage();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.getDashboardStats().then(setStats).catch(() => setStats(null));
  }, []);

  if (!stats) return <Spinner />;

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h1 className="text-2xl font-black text-white">{t('today', 'Today')}</h1>
        <p className="text-sm text-slate-400">{formatDate(todayIso())}</p>
      </div>

      <button type="button" onClick={onOpenCollect} className="w-full glass-card glass-card-hover rounded-2xl p-5 text-left space-y-4 cursor-pointer">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-slate-400 font-semibold">{t('toCollect', 'To collect')}</div>
            <div className="text-xl sm:text-3xl font-black text-white">{formatCurrency(stats.todayExpected)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">{t('collected', 'Collected')}</div>
            <div className="text-xl sm:text-3xl font-black text-emerald-400">{formatCurrency(stats.todayCollected)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">{t('left', 'Left')}</div>
            <div className="text-xl sm:text-3xl font-black text-gold-300">{formatCurrency(stats.todayPending)}</div>
          </div>
        </div>
        <ProgressBar percent={stats.todayCollectionRate} />
        <div className="flex items-center gap-2 text-sm font-bold text-gold-400">
          <CalendarCheck className="w-5 h-5" />
          {t('openCollect', 'Open Daily Collection')} →
        </div>
      </button>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatTile
          icon={AlertTriangle}
          tone="red"
          label={t('tabNotPaying', 'Not paying')}
          value={String(stats.notPayingCount)}
          hint={t('customers', 'Customers')}
          onClick={() => onOpenCustomers('not-paying')}
        />
        <StatTile
          icon={Wallet}
          tone="gold"
          label={t('balanceToCollect', 'Balance to collect')}
          value={formatCurrency(stats.totalOutstanding)}
          onClick={() => onOpenCustomers('paying')}
        />
        <StatTile
          icon={TrendingUp}
          tone="green"
          label={t('collectedThisMonth', 'Collected this month')}
          value={formatCurrency(stats.monthlyCollection)}
        />
      </div>
    </div>
  );
};
