import React, { useCallback, useEffect, useState } from 'react';
import { Clock, ClipboardList, Plus } from 'lucide-react';
import { Collector, DailyCollectionRecord, User } from '../../types';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { collectionDaySummary, longPendingCounts } from '../../../shared/collectorDay';
import { todayIso } from '../../../shared/finance';
import { useLanguage } from '../../context/LanguageContext';
import { useConfig } from '../../context/ConfigContext';
import { EmptyState, Spinner } from '../common/ui';
import { AccountSettingsSheet } from '../common/AccountSettingsSheet';
import { CollectorPaymentsView } from './CollectorPaymentsView';
import { CollectorReportView } from './CollectorReportView';

/** The collector's only screen: today's work in two figures, then Payment and Report. */
export const CollectorHome: React.FC<{
  currentUser: User;
  settingsOpen: boolean;
  onCloseSettings: () => void;
  onLogout: () => void;
}> = ({ currentUser, settingsOpen, onCloseSettings, onLogout }) => {
  const { t } = useLanguage();
  const longAfter = useConfig().config.masters.long_pending_after_terms;
  const collectorId = currentUser.collector_id || '';
  const [records, setRecords] = useState<DailyCollectionRecord[] | null>(null);
  const [collector, setCollector] = useState<Collector | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'home' | 'payment' | 'report'>('home');
  const [assigned, setAssigned] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    if (!collectorId) {
      setError(t('collectorNotLinked', 'This login is not linked to a collector. Please call the office.'));
      setRecords([]);
      return;
    }
    try {
      setRecords(await api.getDailyCollections({ date: todayIso(), collector: collectorId }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('somethingWentWrong', 'Something went wrong. Please try again.'));
      setRecords(prev => prev ?? []);
    }
  }, [collectorId, t]);

  useEffect(() => {
    load();
    api.getCollectors().then(list => setCollector(list.find(c => c.id === collectorId) ?? null)).catch(() => undefined);
  }, [load, collectorId]);

  // Until the office assigns today's work the collector waits; the screen opens by itself afterwards.
  useEffect(() => {
    if (assigned) return;
    const check = () =>
      api.getDayAssignment(todayIso())
        .then(status => {
          setAssigned(status.assigned);
          if (status.assigned) load();
        })
        .catch(() => setAssigned(prev => prev ?? false));
    check();
    const timer = setInterval(check, 30000);
    return () => clearInterval(timer);
  }, [assigned, load]);

  const settings = settingsOpen && (
    <AccountSettingsSheet
      details={[
        [t('name', 'Name'), collector?.name || currentUser.name],
        [t('collectorId', 'Collector ID'), collectorId],
        [t('mobile', 'Mobile'), collector?.mobile || currentUser.phone],
        [t('area', 'Area'), collector?.assigned_area],
      ]}
      onLogout={onLogout}
      onClose={onCloseSettings}
    />
  );

  if (!records || assigned === null) {
    return (
      <>
        <Spinner />
        {settings}
      </>
    );
  }

  if (!assigned) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pb-8">
        <h1 className="text-2xl font-black text-white">
          {t('hello', 'Hello')}, {collector?.name || currentUser.name}
        </h1>
        <EmptyState icon={Clock} text={t('workNotAssignedCollector', "Today's work is not assigned yet. Your list will open here when the office assigns it.")} />
        {settings}
      </div>
    );
  }

  if (view === 'payment') {
    return (
      <div className="max-w-3xl mx-auto pb-8">
        <CollectorPaymentsView currentUser={currentUser} records={records} onChanged={load} onBack={() => setView('home')} />
        {settings}
      </div>
    );
  }
  if (view === 'report') {
    return (
      <div className="max-w-2xl mx-auto pb-8">
        <CollectorReportView collectorId={collectorId} records={records} onBack={() => setView('home')} />
        {settings}
      </div>
    );
  }

  const summary = collectionDaySummary(records);
  const longPending = longPendingCounts(records, longAfter);
  const stat = (label: string, pending: React.ReactNode, total: React.ReactNode) => (
    <div className="flex items-baseline justify-between gap-3 py-3">
      <span className="text-base text-slate-300">{label}</span>
      <span className="font-mono text-right">
        <strong className="text-2xl font-black text-gold-300">{pending}</strong>
        <span className="text-lg text-slate-400"> / {total}</span>
      </span>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-8">
      <h1 className="text-2xl font-black text-white">
        {t('hello', 'Hello')}, {collector?.name || currentUser.name}
      </h1>

      {error && <EmptyState icon={ClipboardList} text={error} />}

      <div className="glass-card rounded-2xl p-4 sm:p-5 border border-gold-500/20">
        <div className="text-sm font-bold text-gold-400">{t('today', 'Today')}</div>
        <div className="divide-y divide-slate-800">
          {stat(t('customers', 'Customers'), summary.customersPending, summary.customersAssigned)}
          {stat(t('longPending', 'Long pending'), longPending.pending, longPending.total)}
          {stat(t('collectionAmount', 'Collection amount'), formatCurrency(summary.pendingAmount), formatCurrency(summary.expected))}
        </div>
        <div className="text-[11px] text-slate-500 text-right">{t('pendingOfTotal', 'pending / total')}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setView('payment')}
          className="flex flex-col items-center justify-center gap-2 px-3 py-6 rounded-2xl bg-gradient-to-r from-gold-500 to-amber-600 text-navy-950 font-black text-lg shadow-md shadow-gold-500/20 active:scale-[0.98]"
        >
          <Plus className="w-8 h-8" />
          {t('payment', 'Payment')}
        </button>
        <button
          type="button"
          onClick={() => setView('report')}
          className="flex flex-col items-center justify-center gap-2 px-3 py-6 rounded-2xl bg-navy-900 border border-slate-700 text-slate-100 font-black text-lg hover:border-gold-500/60 active:scale-[0.98]"
        >
          <ClipboardList className="w-8 h-8" />
          {t('report', 'Report')}
        </button>
      </div>
      {settings}
    </div>
  );
};
