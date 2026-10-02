import React, { useEffect, useState } from 'react';
import { AlertTriangle, Download, HandCoins, PiggyBank, TrendingUp, Wallet } from 'lucide-react';
import { api, CustomerListItem } from '../../services/api';
import { CollectionAccount, Collector, PaymentTransaction } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { exportTableToExcel } from '../../utils/excelExport';
import { todayIso } from '../../../shared/finance';
import { useLanguage } from '../../context/LanguageContext';
import { useConfig } from '../../context/ConfigContext';
import { BigButton, CallButton, EmptyState, PageTitle, PillTabs, Spinner, StatTile } from '../common/ui';
import { MonthlyExcelReportView } from './MonthlyExcelReportView';
import { ReceiptsMasterView } from '../collections/ReceiptsMasterView';

type ReportTab = 'monthly' | 'not-paying' | 'summary' | 'receipts';

/** Four reports: the monthly register, who is not paying, the money summary, and all receipts. */
export const ReportsView: React.FC<{ onOpenCustomer: (customerId: string) => void }> = ({ onOpenCustomer }) => {
  const { t } = useLanguage();
  const [tab, setTab] = useState<ReportTab>('monthly');

  return (
    <div className="space-y-4 pb-8">
      <PageTitle title={t('reports', 'Reports')} />
      <PillTabs<ReportTab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'monthly', label: t('monthlyRegister', 'Monthly register') },
          { id: 'not-paying', label: t('tabNotPaying', 'Not paying') },
          { id: 'summary', label: t('summary', 'Summary') },
          { id: 'receipts', label: t('receipts', 'Receipts') },
        ]}
      />
      {tab === 'monthly' && <MonthlyExcelReportView />}
      {tab === 'not-paying' && <NotPayingReport onOpenCustomer={onOpenCustomer} />}
      {tab === 'summary' && <SummaryReport />}
      {tab === 'receipts' && <ReceiptsMasterView />}
    </div>
  );
};

/** Running loans that are behind by at least the "not paying" limit, worst first, with a call button. */
const NotPayingReport: React.FC<{ onOpenCustomer: (customerId: string) => void }> = ({ onOpenCustomer }) => {
  const { t } = useLanguage();
  const limit = useConfig().config.masters.not_paying_after_days;
  const [customers, setCustomers] = useState<CustomerListItem[] | null>(null);

  useEffect(() => {
    api.getCustomers().then(setCustomers).catch(() => setCustomers([]));
  }, []);
  if (!customers) return <Spinner />;

  const rows = customers
    .filter(c => (c.activeAccount?.days_behind ?? 0) >= limit)
    .sort((a, b) => (b.activeAccount!.days_behind ?? 0) - (a.activeAccount!.days_behind ?? 0));

  const download = () =>
    exportTableToExcel(
      t('tabNotPaying', 'Not paying'),
      [t('customer', 'Customer'), t('shop', 'Shop'), t('mobile', 'Mobile'), t('collector', 'Collector'), t('daysNotPaid', 'Days not paid'), t('amountBehind', 'Amount behind'), t('balance', 'Balance')],
      rows.map(c => {
        const a = c.activeAccount!;
        return [c.full_name, c.business?.shop_name || '', c.mobile_number, a.assigned_collector_name, a.days_behind ?? 0, (a.days_behind ?? 0) * a.daily_collection, a.remaining_amount];
      }),
      'Not_paying'
    );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          {t('notPayingRule', 'Behind by')} {limit}+ {t('days', 'days')} • {rows.length} {t('customers', 'customers')}
        </p>
        <BigButton small icon={Download} label="Excel" onClick={download} />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={AlertTriangle} text={t('everyonePaying', 'Everyone is paying')} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map(c => {
            const a = c.activeAccount!;
            return (
              <div key={c.id} className="glass-card rounded-2xl p-4 flex items-center gap-3 border border-rose-500/30">
                <button type="button" onClick={() => onOpenCustomer(c.id)} className="flex-1 min-w-0 text-left">
                  <div className="text-lg font-black text-white truncate">{c.full_name}</div>
                  <div className="text-sm text-slate-400 truncate">{c.business?.shop_name} • {a.assigned_collector_name}</div>
                  <div className="text-sm font-bold text-rose-300 mt-1">
                    {a.days_behind} {t('daysNotPaid', 'days not paid')} • {formatCurrency((a.days_behind ?? 0) * a.daily_collection)}
                  </div>
                  <div className="text-xs text-slate-400">{t('balance', 'Balance')}: {formatCurrency(a.remaining_amount)}</div>
                </button>
                <CallButton phone={c.mobile_number} label={t('call', 'Call')} />
              </div>
            );
          })}
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
