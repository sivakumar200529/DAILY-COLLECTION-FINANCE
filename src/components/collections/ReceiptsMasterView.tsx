import React, { useEffect, useState } from 'react';
import { Download, Receipt as ReceiptIcon, Search } from 'lucide-react';
import { Receipt } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { exportTableToExcel } from '../../utils/excelExport';
import { useLanguage } from '../../context/LanguageContext';
import { BigButton, EmptyState, Spinner } from '../common/ui';
import { ReceiptModal } from './ReceiptModal';

const PAGE = 50;

/** All receipts, newest first: search by receipt number, customer or shop, and reprint. Reports tab. */
export const ReceiptsMasterView: React.FC = () => {
  const { t } = useLanguage();
  const [receipts, setReceipts] = useState<Receipt[] | null>(null);
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [selected, setSelected] = useState<Receipt | null>(null);

  useEffect(() => {
    api.getReceipts().then(setReceipts).catch(() => setReceipts([]));
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = (receipts ?? []).filter(
    r =>
      !q ||
      r.receipt_number.toLowerCase().includes(q) ||
      r.customer_name.toLowerCase().includes(q) ||
      r.customer_id.toLowerCase().includes(q) ||
      (r.shop_name || '').toLowerCase().includes(q)
  );

  const download = () =>
    exportTableToExcel(
      t('receipts', 'Receipts'),
      [t('receiptNo', 'Receipt No'), t('date', 'Date'), t('customer', 'Customer'), t('shop', 'Shop'), t('paidToday', 'Paid'), t('paidBy', 'Paid by'), t('balance', 'Balance'), t('collector', 'Collector'), t('status', 'Status')],
      filtered.map(r => [
        r.receipt_number, r.date, r.customer_name, r.shop_name, r.amount_paid, r.payment_mode, r.remaining_balance, r.collector_name,
        r.status === 'CANCELLED' ? t('cancelled', 'Cancelled') : '',
      ]),
      'Receipts'
    );

  if (receipts === null) return <Spinner />;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={e => { setSearch(e.target.value); setShown(PAGE); }}
            placeholder={t('searchReceipts', 'Receipt number, name or shop')}
            className="w-full pl-12 pr-4 py-3 bg-navy-950 border border-slate-700 rounded-2xl text-base text-white placeholder-slate-500 focus:border-gold-500 focus:outline-none"
          />
        </div>
        <BigButton icon={Download} label="Excel" onClick={download} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ReceiptIcon} text={t('nothingFound', 'Nothing found')} />
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, shown).map(r => {
            const cancelled = r.status === 'CANCELLED';
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r)}
                className="w-full glass-card rounded-2xl p-3 flex items-center justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <div className="text-base font-bold text-white truncate">{r.customer_name}</div>
                  <div className="text-xs text-slate-400">{r.receipt_number} • {formatDate(r.date)} • {r.collector_name}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-lg font-black ${cancelled ? 'line-through text-slate-500' : 'text-emerald-400'}`}>{formatCurrency(r.amount_paid)}</div>
                  {cancelled && <div className="text-xs font-bold text-rose-400">{t('cancelled', 'Cancelled')}</div>}
                </div>
              </button>
            );
          })}
          {filtered.length > shown && (
            <BigButton label={t('showMore', 'Show more')} onClick={() => setShown(shown + PAGE)} className="w-full" />
          )}
        </div>
      )}

      {selected && <ReceiptModal receipt={selected} onClose={() => setSelected(null)} />}
    </div>
  );
};
