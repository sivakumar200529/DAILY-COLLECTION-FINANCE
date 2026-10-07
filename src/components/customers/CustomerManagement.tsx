import React, { useEffect, useState } from 'react';
import { AlertTriangle, CalendarCheck, Search, UserPlus, Users, Wallet } from 'lucide-react';
import { api, CustomerListItem } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import { useConfig } from '../../context/ConfigContext';
import { Avatar } from '../common/Avatar';
import { BigButton, EmptyState, PageTitle, PillTabs, ProgressBar, Spinner } from '../common/ui';
import { IssueLoanModal } from '../loans/IssueLoanModal';
import { CustomerForm } from './CustomerForm';

export type CustomersTab = 'paying' | 'not-paying' | 'no-loan' | 'all';

interface CustomerManagementProps {
  onOpenCustomer: (customerId: string) => void;
  onCollect: (accountId: string) => void;
  initialTab?: CustomersTab;
  initialSearch?: string;
}

/** Customers with their loan at a glance. Replaces the separate customers and loan-accounts lists. */
export const CustomerManagement: React.FC<CustomerManagementProps> = ({ onOpenCustomer, onCollect, initialTab, initialSearch }) => {
  const { t } = useLanguage();
  const notPayingAfter = useConfig().config.masters.not_paying_after_days;
  const [customers, setCustomers] = useState<CustomerListItem[] | null>(null);
  const [tab, setTab] = useState<CustomersTab>(initialTab ?? 'all');
  const [search, setSearch] = useState(initialSearch ?? '');
  const [showAdd, setShowAdd] = useState(false);
  const [loanFor, setLoanFor] = useState<string | null>(null);

  const load = () =>
    api.getCustomers().then(setCustomers).catch(() => setCustomers([]));

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
    }
  }, [initialTab]);

  const tabOf = (c: CustomerListItem): Exclude<CustomersTab, 'all'> => {
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
  const count = (id: CustomersTab) => list.filter(c => id === 'all' || tabOf(c) === id).length;
  const visible = list.filter(c => (tab === 'all' || tabOf(c) === tab) && matches(c));

  return (
    <div className="space-y-4 pb-8">
      <PageTitle
        title={t('customers', 'Customers')}
        action={<BigButton tone="gold" icon={UserPlus} label={t('addCustomer', 'Add customer')} onClick={() => setShowAdd(true)} />}
      />

      <PillTabs<CustomersTab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'paying', label: t('tabPaying', 'Paying'), count: count('paying') },
          { id: 'not-paying', label: t('tabNotPaying', 'Not paying'), count: count('not-paying') },
          { id: 'no-loan', label: t('tabNoLoan', 'No loan'), count: count('no-loan') },
          { id: 'all', label: t('all', 'All'), count: count('all') },
        ]}
      />

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

      {customers === null ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <EmptyState icon={Users} text={t('nobodyHere', 'Nobody here')} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visible.map(c => {
            const acc = c.activeAccount;
            const behind = acc?.days_behind ?? 0;
            const inactive = c.status !== 'ACTIVE';
            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenCustomer(c.id)}
                onKeyDown={e => e.key === 'Enter' && onOpenCustomer(c.id)}
                className="glass-card glass-card-hover rounded-2xl p-4 cursor-pointer flex flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar src={c.profile_photo} name={c.full_name} className="w-12 h-12 rounded-2xl text-base" />
                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-black text-white truncate">{t(c.full_name, c.full_name)}</div>
                    <div className="text-sm text-slate-400 truncate">{t(c.business?.shop_name || '', c.business?.shop_name || '—')}</div>
                    <div className="text-xs text-slate-500 truncate">{t(c.business?.shop_area || c.address?.area || '', c.business?.shop_area || c.address?.area || '')}</div>
                  </div>
                  {inactive && (
                    <span className="px-2 py-1 rounded-lg text-xs font-bold bg-slate-700 text-slate-200">{t('inactive', 'Inactive')}</span>
                  )}
                </div>

                {acc ? (
                  <>
                    <div className="flex items-end justify-between text-sm gap-2">
                      <span className="text-slate-300">
                        {t('paidSoFar', 'Paid')} <strong className="text-white">{formatCurrency(acc.amount_collected)}</strong> {t('of', 'of')} {formatCurrency(acc.total_repayment)}
                      </span>
                      <span className="text-slate-400 whitespace-nowrap">{formatCurrency(acc.daily_collection)}/{t('day', 'day')}</span>
                    </div>
                    <ProgressBar percent={acc.collection_percentage} tone={behind >= notPayingAfter ? 'red' : 'green'} />
                    {behind > 0 && (
                      <div className={`flex items-center gap-2 text-sm font-semibold ${behind >= notPayingAfter ? 'text-rose-300' : 'text-amber-300'}`}>
                        <AlertTriangle className="w-4 h-4" />
                        {behind} {t('daysNotPaid', 'days not paid')}
                      </div>
                    )}
                    <div onClick={e => e.stopPropagation()}>
                      <BigButton tone="green" icon={CalendarCheck} label={t('navCollect', 'Collect')} onClick={() => onCollect(acc.id)} className="w-full" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm text-slate-400">
                      {c.latestAccount ? t('loanClosed', 'Last loan closed') : t('noLoanYet', 'No loan yet')}
                    </div>
                    {!inactive && (
                      <div onClick={e => e.stopPropagation()}>
                        <BigButton icon={Wallet} label={t('giveLoan', 'Give loan')} onClick={() => setLoanFor(c.id)} className="w-full" />
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
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
