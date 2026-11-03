import React, { useState } from 'react';
import { Search, UserPlus, Users } from 'lucide-react';
import { CustomerListItem } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { EmptyState, Sheet } from '../common/ui';

/** New loan: for a new customer, or for an existing customer without a running loan. */
export const NewLoanSheet: React.FC<{
  customers: CustomerListItem[];
  onNewCustomer: () => void;
  onExistingCustomer: (customerId: string) => void;
  onClose: () => void;
}> = ({ customers, onNewCustomer, onExistingCustomer, onClose }) => {
  const { t } = useLanguage();
  const [existing, setExisting] = useState(false);
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  const eligible = customers.filter(c => !c.activeAccount && c.status === 'ACTIVE');
  const shown = eligible.filter(
    c =>
      !q ||
      c.full_name.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      (c.business?.shop_name || '').toLowerCase().includes(q) ||
      (digits.length >= 3 && c.mobile_number.replace(/\D/g, '').includes(digits))
  );

  const choice = (Icon: typeof Users, label: string, active: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-center gap-2 px-3 py-5 rounded-2xl border font-black text-base ${
        active ? 'bg-gold-500 border-gold-500 text-navy-950' : 'bg-navy-950 border-slate-700 text-slate-100 hover:border-gold-500/60'
      }`}
    >
      <Icon className="w-7 h-7" />
      {label}
    </button>
  );

  return (
    <Sheet title={t('newLoan', 'New loan')} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {choice(UserPlus, t('newCustomer', 'New customer'), false, onNewCustomer)}
          {choice(Users, t('existingCustomer', 'Existing customer'), existing, () => setExisting(true))}
        </div>

        {existing && (
          <>
            <div className="relative">
              <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('searchCustomers', 'Search name, shop or mobile')}
                className="w-full pl-12 pr-4 py-3 bg-navy-950 border border-slate-700 rounded-2xl text-base text-white placeholder-slate-500 focus:border-gold-500 focus:outline-none"
              />
            </div>
            <p className="text-xs text-slate-400">{t('runningLoanNotListed', 'Customers with a running loan are not listed.')}</p>
            {shown.length === 0 ? (
              <EmptyState icon={Users} text={t('nobodyHere', 'Nobody here')} />
            ) : (
              <div className="rounded-2xl bg-navy-950 border border-slate-800 divide-y divide-slate-800">
                {shown.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onExistingCustomer(c.id)}
                    className="w-full px-4 py-3 text-left hover:bg-slate-800/60"
                  >
                    <span className="block font-bold text-white">{t(c.full_name, c.full_name)}</span>
                    <span className="block text-xs text-slate-400">{[c.business?.shop_name, c.mobile_number].filter(Boolean).join(' • ')}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
};
