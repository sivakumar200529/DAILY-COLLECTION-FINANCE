import React, { useEffect, useState } from 'react';
import { AlertTriangle, Download, HandCoins, PiggyBank, TrendingUp, Wallet } from 'lucide-react';
import { api, CustomerListItem } from '../../services/api';
import { CollectionAccount, Collector, PaymentTransaction } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { amountBehind } from '../../utils/loanFigures';
import { exportTableToExcel } from '../../utils/excelExport';
import { daysLeftInMonth, todayIso } from '../../../shared/finance';
import { useLanguage } from '../../context/LanguageContext';
import { useConfig } from '../../context/ConfigContext';
import { BigButton, CallButton, EmptyState, PageTitle, PillTabs, Spinner, StatTile } from '../common/ui';
import { MonthlyExcelReportView } from './MonthlyExcelReportView';
import { ReceiptsMasterView } from '../collections/ReceiptsMasterView';
import { CollectorReportsReport } from './CollectorReportsReport';
import { DayClosingsReport } from './DayClosingsReport';

export type ReportTab = 'monthly' | 'long-pending' | 'collectors' | 'closings' | 'summary' | 'receipts';

/** What Reports opens with: the summary on the month's last day, the register in its last 5 days, else today's reports once work is assigned. */
function defaultReportTab(today: string, assigned: boolean): ReportTab {
  const left = daysLeftInMonth(today);
  if (left === 0) return 'summary';
  if (left < 5) return 'monthly';
  return assigned ? 'collectors' : 'monthly';
}

/** Reports: the monthly register, long-pending customers, collectors' day reports, closed days, the money summary, and all receipts. */
export const ReportsView: React.FC<{
  onOpenCustomer: (customerId: string) => void;
  officeName: string;
  initialTab?: ReportTab;
}> = ({ onOpenCustomer, officeName, initialTab }) => {
  const { t } = useLanguage();
  const [tab, setTab] = useState<ReportTab | null>(initialTab ?? null);

  useEffect(() => {
    if (initialTab) return;
    const today = todayIso();
    api.getDayAssignment(today)
      .then(status => setTab(defaultReportTab(today, status.assigned)))
      .catch(() => setTab(defaultReportTab(today, false)));
  }, [initialTab]);

  if (!tab) return <Spinner />;

  return (
    <div className="space-y-4 pb-8">
      <PageTitle title={t('reports', 'Reports')} />
      <PillTabs<ReportTab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'monthly', label: t('monthlyRegister', 'Monthly register') },
          { id: 'long-pending', label: t('longPending', 'Long pending') },
          { id: 'collectors', label: t('collectorReports', 'Collector reports') },
          { id: 'closings', label: t('dayClosings', 'Day closings') },
          { id: 'summary', label: t('summary', 'Summary') },
          { id: 'receipts', label: t('receipts', 'Receipts') },
        ]}
      />
      {tab === 'monthly' && <MonthlyExcelReportView />}
      {tab === 'long-pending' && <LongPendingReport onOpenCustomer={onOpenCustomer} />}
      {tab === 'collectors' && <CollectorReportsReport officeName={officeName} />}
      {tab === 'closings' && <DayClosingsReport />}
      {tab === 'summary' && <SummaryReport />}
      {tab === 'receipts' && <ReceiptsMasterView />}
    </div>
  );
};

/** Running loans with more than one term pending, worst first, with a call button. */
const LongPendingReport: React.FC<{ onOpenCustomer: (customerId: string) => void }> = ({ onOpenCustomer }) => {
  const { t } = useLanguage();
  const longAfter = useConfig().config.masters.long_pending_after_terms;
  const [customers, setCustomers] = useState<CustomerListItem[] | null>(null);

  useEffect(() => {
    api.getCustomers().then(setCustomers).catch(() => setCustomers([]));
  }, []);
  if (!customers) return <Spinner />;

  const rows = customers
    .filter(c => (c.activeAccount?.days_behind ?? 0) >= longAfter)
    .sort((a, b) => (b.activeAccount!.days_behind ?? 0) - (a.activeAccount!.days_behind ?? 0));

  const download = () =>
    exportTableToExcel(
      t('longPending', 'Long pending'),
      [t('customer', 'Customer'), t('shop', 'Shop'), t('mobile', 'Mobile'), t('collector', 'Collector'), t('daysNotPaid', 'Days not paid'), t('amountBehind', 'Amount behind'), t('balance', 'Balance')],
      rows.map(c => {
        const a = c.activeAccount!;
        return [c.full_name, c.business?.shop_name || '', c.mobile_number, a.assigned_collector_name, a.days_behind ?? 0, amountBehind(a), a.remaining_amount];
      }),
      'Long_pending'
    );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          {t('termsPendingAtLeast', 'Terms pending, at least')}: {longAfter} • {rows.length} {t('customers', 'customers')}
        </p>
        <BigButton small icon={Download} label="Excel" onClick={download} />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={AlertTriangle} text={t('everyonePaying', 'Everyone is paying')} />
      ) : (
        <div className="glass-card rounded-2xl border border-slate-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-800">
                <th className="py-2.5 pl-3 pr-1 font-semibold">{t('customer', 'Customer')}</th>
                <th className="py-2.5 px-1 font-semibold text-right">{t('totalAmount', 'Total amount')}</th>
                <th className="py-2.5 px-1 font-semibold text-center">{t('pendingTermsShort', 'Pending terms')}</th>
                <th className="py-2.5 pl-1 pr-3 font-semibold text-center">{t('call', 'Call')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map(c => {
                const a = c.activeAccount!;
                return (
                  <tr key={c.id} className="bg-rose-500/10">
                    <td className="py-2.5 pl-2 pr-1 border-l-4 border-rose-500">
                      <button type="button" onClick={() => onOpenCustomer(c.id)} className="text-left">
                        <span className="block font-bold text-white underline decoration-slate-600 underline-offset-4">{c.full_name}</span>
                        <span className="block text-xs text-slate-400">{c.business?.shop_name}</span>
                        <span className="block text-xs text-slate-500">{a.assigned_collector_name}</span>
                      </button>
                    </td>
                    <td className="py-2.5 px-1 text-right whitespace-nowrap">
                      <span className="font-mono font-black text-gold-300">
                        {formatCurrency(amountBehind(a))}
                        <span className="block text-xs font-sans font-normal text-slate-400">{t('balance', 'Balance')} {formatCurrency(a.remaining_amount)}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-1 text-center font-mono"><strong className="text-rose-300 text-base">{a.days_behind}</strong></td>
                    <td className="py-2 pl-1 pr-3"><div className="flex justify-center"><CallButton phone={c.mobile_number} label={t('call', 'Call')} /></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/** The business in four numbers, plus each collector's collection today and this month. */
const SummaryReport: React.FC = () => {
  const { t } = useLanguage();
  const [data, setData] = useState<{ accounts: CollectionAccount[]; payments: PaymentTransaction[]; collectors: Collector[] } | null>(null);

  useEffect(() => {
    Promise.all([api.getCollectionAccounts(), api.getPayments(), api.getCollectors()])
      .then(([accounts, payments, collectors]) => setData({ accounts, payments, collectors }))
      .catch(() => setData({ accounts: [], payments: [], collectors: [] }));
  }, []);
  if (!data) return <Spinner />;

  const loans = data.accounts.filter(a => a.status !== 'CANCELLED');
  const running = loans.filter(a => a.status === 'ACTIVE' || a.status === 'OVERDUE');
  const given = loans.reduce((s, a) => s + a.disbursed_amount, 0);
  const collected = loans.reduce((s, a) => s + a.amount_collected, 0);
  const balance = running.reduce((s, a) => s + a.remaining_amount, 0);
  const interest = loans.reduce((s, a) => s + a.finance_margin, 0);

  const today = todayIso();
  const month = today.slice(0, 7);
  const active = data.payments.filter(p => p.status !== 'CANCELLED');
  const perCollector = data.collectors.map(c => {
    const mine = active.filter(p => p.collector_id === c.id);
    return {
      collector: c,
      today: mine.filter(p => p.collection_date === today).reduce((s, p) => s + p.amount_paid, 0),
      month: mine.filter(p => p.collection_date.startsWith(month)).reduce((s, p) => s + p.amount_paid, 0),
      loans: running.filter(a => a.assigned_collector_id === c.id).length,
    };
  });

  const download = () =>
    exportTableToExcel(
      t('summary', 'Summary'),
      [t('collector', 'Collector'), t('runningLoans', 'Running loans'), t('collectedToday', 'Collected today'), t('collectedThisMonth', 'Collected this month')],
      perCollector.map(r => [r.collector.name, r.loans, r.today, r.month]),
      'Summary_by_collector'
    );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={HandCoins} label={t('givenOut', 'Money given out')} value={formatCurrency(given)} tone="blue" />
        <StatTile icon={Wallet} label={t('collected', 'Collected')} value={formatCurrency(collected)} tone="green" />
        <StatTile icon={TrendingUp} label={t('balanceToCollect', 'Balance to collect')} value={formatCurrency(balance)} tone="gold" />
        <StatTile icon={PiggyBank} label={t('interestEarned', 'Interest earned')} value={formatCurrency(interest)} tone="gold" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black text-white">{t('byCollector', 'By collector')}</h2>
        <BigButton small icon={Download} label="Excel" onClick={download} />
      </div>
      <div className="space-y-2">
        {perCollector.map(r => (
          <div key={r.collector.id} className="glass-card rounded-2xl p-4 grid grid-cols-3 gap-2 items-center">
            <div className="min-w-0">
              <div className="text-base font-bold text-white truncate">{r.collector.name}</div>
              <div className="text-xs text-slate-400">{r.loans} {t('runningLoans', 'running loans')}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">{t('today', 'Today')}</div>
              <div className="text-base font-black text-emerald-400">{formatCurrency(r.today)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">{t('thisMonth', 'This month')}</div>
              <div className="text-base font-black text-white">{formatCurrency(r.month)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
