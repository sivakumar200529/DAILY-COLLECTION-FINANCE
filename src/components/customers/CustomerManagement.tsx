import React, { useEffect, useState } from 'react';
import { IndianRupee, PlusCircle, Search, Users, Wallet } from 'lucide-react';
import { User } from '../../types';
import { api, CustomerListItem } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import { useConfig } from '../../context/ConfigContext';
import { BigButton, EmptyState, PageTitle, PillTabs, Spinner } from '../common/ui';
import { IssueLoanModal } from '../loans/IssueLoanModal';
import { RequestsView } from '../requests/RequestsView';
import { WaitingAlerts } from '../dashboard/WaitingAlerts';
import { CustomerForm } from './CustomerForm';
import { NewLoanSheet } from './NewLoanSheet';

export type CustomersTab = 'active' | 'paying' | 'not-paying' | 'no-loan' | 'all' | 'requests' | 'upi';

interface CustomerManagementProps {
  currentUser: User;
  onOpenCustomer: (customerId: string) => void;
  onCollect: (accountId: string) => void;
  initialTab?: CustomersTab;
  initialSearch?: string;
}

/**
 * Loan Management: customers and their active loans, in the collector's table: customer details, total
 * amount, pending terms, and Collect or Give loan. Rows with pending terms are tinted. New loans start
 * here, for a new or an existing customer, and so do the customers' requests.
 */
export const CustomerManagement: React.FC<CustomerManagementProps> = ({ currentUser, onOpenCustomer, onCollect, initialTab, initialSearch }) => {
  const { t } = useLanguage();
  const notPayingAfter = useConfig().config.masters.not_paying_after_days;
  const [customers, setCustomers] = useState<CustomerListItem[] | null>(null);
  const [tab, setTab] = useState<CustomersTab>(initialTab ?? 'all');
  const [search, setSearch] = useState(initialSearch ?? '');
  const [showNewLoan, setShowNewLoan] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loanFor, setLoanFor] = useState<string | null>(null);

  const load = () => {
    api.getCustomers().then(setCustomers).catch(() => setCustomers([]));
    setRefreshKey(key => key + 1);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
    }
  }, [initialTab]);

  const tabOf = (c: CustomerListItem): 'paying' | 'not-paying' | 'no-loan' => {
    if (!c.activeAccount) return 'no-loan';
    return (c.activeAccount.days_behind ?? 0) >= notPayingAfter ? 'not-paying' : 'paying';
  };

  const q = search.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  const matches = (c: CustomerListItem) =>
    !q ||
    c.full_name.toLowerCase().includes(q) ||
    c.id.toLowerCase().includes(q) ||
    (digits.length >= 3 && c.mobile_number.replace(/\D/g, '').includes(digits)) ||
    (c.business?.shop_name || '').toLowerCase().includes(q);

  const list = customers ?? [];
  const inTab = (c: CustomerListItem, id: CustomersTab) => id === 'all' || (id === 'active' ? !!c.activeAccount : tabOf(c) === id);
  const count = (id: CustomersTab) => list.filter(c => inTab(c, id)).length;
  const visible = list.filter(c => inTab(c, tab) && matches(c));
  const showingRequests = tab === 'requests' || tab === 'upi';

  return (
    <div className="space-y-4 pb-8">
      <PageTitle
        title={t('loanManagement', 'Loan Management')}
        action={<BigButton tone="gold" icon={PlusCircle} label={t('newLoan', 'New loan')} onClick={() => setShowNewLoan(true)} />}
      />

      <WaitingAlerts
        onOpenLoanRequests={() => setTab('requests')}
        onOpenUpiPayments={() => setTab('upi')}
        alwaysShowLoans
        refreshKey={refreshKey}
      />

      <PillTabs<CustomersTab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'active', label: t('activeLoans', 'Active Loans'), count: count('active') },
          { id: 'paying', label: t('tabPaying', 'Paying'), count: count('paying') },
          { id: 'not-paying', label: t('tabNotPaying', 'Not paying'), count: count('not-paying') },
          { id: 'no-loan', label: t('tabNoLoan', 'No loan'), count: count('no-loan') },
          { id: 'all', label: t('all', 'All'), count: count('all') },
        ]}
      />

      {!showingRequests && (
      <div className="relative">
        <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('searchCustomers', 'Search name, shop or mobile')}
          className="w-full pl-12 pr-4 py-3 bg-navy-950 border border-slate-700 rounded-2xl text-base text-white placeholder-slate-500 focus:border-gold-500 focus:outline-none"
        />
      </div>
      )}

      {showingRequests ? (
        <RequestsView key={tab} tab={tab === 'upi' ? 'upi' : 'loans'} currentUser={currentUser} onOpenCustomer={onOpenCustomer} onChanged={load} />
      ) : customers === null ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <EmptyState icon={Users} text={t('nobodyHere', 'Nobody here')} />
      ) : (
        <div className="glass-card rounded-2xl border border-slate-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-800">
                <th className="py-2.5 pl-3 pr-1 font-semibold">{t('customerDetails', 'Customer details')}</th>
                <th className="py-2.5 px-1 font-semibold text-right">{t('totalAmount', 'Total amount')}</th>
                <th className="py-2.5 px-1 font-semibold text-center">{t('pendingTermsShort', 'Pending terms')}</th>
                <th className="py-2.5 pl-1 pr-3 font-semibold text-center">{t('payment', 'Payment')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {visible.map(c => {
                const acc = c.activeAccount;
                const behind = acc?.days_behind ?? 0;
                const inactive = c.status !== 'ACTIVE';
                return (
                  <tr key={c.id} className={behind > 0 ? 'bg-rose-500/10' : undefined}>
                    <td className={`py-2.5 pl-2 pr-1 border-l-4 ${behind > 0 ? 'border-rose-500' : 'border-transparent'}`}>
                      <button type="button" onClick={() => onOpenCustomer(c.id)} className="text-left">
                        <span className="block font-bold text-white underline decoration-slate-600 underline-offset-4">{t(c.full_name, c.full_name)}</span>
                        <span className="block text-xs text-slate-400">{t(c.business?.shop_name || '', c.business?.shop_name || '—')}</span>
                        <span className="block text-xs text-slate-500">{t(c.business?.shop_area || c.address?.area || '', c.business?.shop_area || c.address?.area || '')}</span>
                        {acc && (
                          <span className="block text-xs text-slate-500">
                            {t('dailyPayment', 'Daily payment')} {formatCurrency(acc.daily_collection)} • {t(acc.assigned_collector_name, acc.assigned_collector_name)}
                          </span>
                        )}
                        {inactive && <span className="inline-block mt-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-slate-700 text-slate-200">{t('inactive', 'Inactive')}</span>}
                      </button>
                    </td>
                    <td className="py-2.5 px-1 text-right whitespace-nowrap">
                      {acc ? (
                        <span className="font-mono font-black text-gold-300">
                          {formatCurrency(acc.total_repayment)}
                          <span className="block text-xs font-sans font-normal text-slate-400 whitespace-normal">{t('balance', 'Balance')} {formatCurrency(acc.remaining_amount)}</span>
                        </span>
                      ) : (
                        <span className="block text-xs text-slate-400 whitespace-normal">{c.latestAccount ? t('loanClosed', 'Last loan closed') : t('noLoanYet', 'No loan yet')}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-1 text-center font-mono">
                      {behind > 0 ? <strong className="text-rose-300 text-base">{behind}</strong> : <span className="text-slate-500">–</span>}
                    </td>
                    <td className="py-2 pl-1 pr-3">
                      {acc ? (
                        <button
                          type="button"
                          onClick={() => onCollect(acc.id)}
                          className="w-full px-2 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1"
                        >
                          <IndianRupee className="w-4 h-4" />
                          {t('collect', 'Collect')}
                        </button>
                      ) : !inactive ? (
                        <button
                          type="button"
                          onClick={() => setLoanFor(c.id)}
                          className="w-full px-2 py-2 rounded-xl bg-navy-900 border border-slate-700 text-slate-100 text-xs font-bold flex items-center justify-center gap-1"
                        >
                          <Wallet className="w-4 h-4" />
                          {t('giveLoan', 'Give loan')}
                        </button>
                      ) : (
                        <span className="block text-center text-slate-500">–</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNewLoan && (
        <NewLoanSheet
          customers={list}
          onNewCustomer={() => { setShowNewLoan(false); setShowAdd(true); }}
          onExistingCustomer={id => { setShowNewLoan(false); setLoanFor(id); }}
          onClose={() => setShowNewLoan(false)}
        />
      )}
      {showAdd && (
        <CustomerForm
          onClose={() => setShowAdd(false)}
          onSaved={id => {
            setShowAdd(false);
            onOpenCustomer(id);
          }}
        />
      )}
      {loanFor && <IssueLoanModal customerId={loanFor} onClose={() => setLoanFor(null)} onIssued={() => load()} />}
    </div>
  );
};
