import React, { useEffect, useState } from 'react';
import { Receipt } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { ReceiptModal } from './ReceiptModal';
import { Receipt as ReceiptIcon, Search, Printer, RefreshCw } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export const ReceiptsMasterView: React.FC = () => {
  const { t } = useLanguage();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getReceipts();
      setReceipts(data);
    } catch (err) {
      console.error('Failed to load receipts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = receipts.filter(r =>
    r.receipt_number.toLowerCase().includes(search.toLowerCase()) ||
    r.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    r.customer_id.toLowerCase().includes(search.toLowerCase()) ||
    (r.shop_name && r.shop_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-12 font-sans">
      <div className="glass-card p-5 rounded-2xl border border-gold-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-300 text-[10px] font-bold uppercase tracking-wider block w-fit mb-1">
            {t('official payment documentation', 'Official Payment Documentation')}
          </span>
          <h1 className="text-xl md:text-2xl font-black text-white">{t('digital receipts archive', 'DIGITAL RECEIPTS ARCHIVE')}</h1>
          <p className="text-xs text-slate-300 mt-0.5">{t('audit, view, and re-print customer collection receipts.', 'Audit, view, and re-print customer collection receipts.')}</p>
        </div>

        <button onClick={loadData} className="p-2.5 rounded-xl bg-navy-950 border border-slate-700 text-slate-300 hover:text-white w-fit">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-gold-400' : ''}`} />
        </button>
      </div>

      <div className="glass-card p-4 rounded-2xl">
        <div className="relative max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder={t('search receipt #, customer, shop...', 'Search receipt #, customer, shop...')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-navy-950/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-gold-500"
          />
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden border border-gold-500/20 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-navy-950 text-slate-300 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4">{t('receipt #', 'Receipt #')}</th>
                <th className="py-3 px-4">{t('date', 'Date')}</th>
                <th className="py-3 px-4">{t('customer', 'Customer')}</th>
                <th className="py-3 px-4">{t('shop', 'Shop')}</th>
                <th className="py-3 px-4 text-right">{t('amount collected', 'Amount Collected')}</th>
                <th className="py-3 px-4">{t('mode', 'Mode')}</th>
                <th className="py-3 px-4 text-right">{t('remaining balance', 'Remaining Balance')}</th>
                <th className="py-3 px-4">{t('collector', 'Collector')}</th>
                <th className="py-3 px-4 text-center">{t('action', 'Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-bold text-gold-400">{r.receipt_number}</td>
                  <td className="py-3 px-4 text-slate-300 font-sans">{formatDate(r.date)}</td>
                  <td className="py-3 px-4 font-sans font-bold text-white">{r.customer_name}</td>
                  <td className="py-3 px-4 font-sans text-slate-300">{r.shop_name}</td>
                  <td className="py-3 px-4 text-right text-emerald-400 font-black">{formatCurrency(r.amount_paid)}</td>
                  <td className="py-3 px-4 font-sans uppercase text-[10px] text-slate-300">{r.payment_mode ? t(r.payment_mode.toLowerCase(), r.payment_mode) : ''}</td>
                  <td className="py-3 px-4 text-right text-slate-200">{formatCurrency(r.remaining_balance)}</td>
                  <td className="py-3 px-4 font-sans text-slate-400">{r.collector_name}</td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => setSelectedReceipt(r)}
                      className="px-2.5 py-1 rounded bg-navy-950 hover:bg-gold-500/20 border border-gold-500/30 text-gold-300 text-[11px] font-semibold inline-flex items-center gap-1 font-sans cursor-pointer"
                    >
                      <Printer className="w-3 h-3" />
                      <span>{t('print', 'Print')}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedReceipt && (
        <ReceiptModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
};
