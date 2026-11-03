import React, { useState } from 'react';
import { CheckCircle2, IndianRupee, Receipt as ReceiptIcon, RotateCcw, Search } from 'lucide-react';
import { DailyCollectionRecord, Receipt, User } from '../../types';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { todayIso } from '../../../shared/finance';
import { useLanguage } from '../../context/LanguageContext';
import { ConfirmSheet, EmptyState } from '../common/ui';
import { ReceiptModal } from '../collections/ReceiptModal';
import { NotPaidSheet } from './NotPaidSheet';
import { dayState, matchesSearch, withMissedAmount } from './collectHelpers';
import { CollectSheet } from '../collector/CollectSheet';
import { CustomerInfoSheet } from '../collector/CustomerInfoSheet';

type Notice = { ok: boolean; text: string } | null;

/**
 * The day's customers in route order, as a table: customer, total amount, pending terms, and
 * Collect (or Receipt and Undo once paid). Customers marked "Not paid" are listed apart as Pending
 * customers. Used by the collector's Payment screen and the office's Daily Collection.
 */
export const CollectionList: React.FC<{
  currentUser: User;
  records: DailyCollectionRecord[];
  onChanged: () => Promise<void>;
  /** False for a past day: the list is read-only (receipts still open). */
  canCollect?: boolean;
  /** Office: tapping a name opens the customer page instead of the shop's details. */
  onOpenCustomer?: (customerId: string) => void;
}> = ({ currentUser, records, onChanged, canCollect = true, onOpenCustomer }) => {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [collectFor, setCollectFor] = useState<DailyCollectionRecord | null>(null);
  const [notPaidFor, setNotPaidFor] = useState<DailyCollectionRecord | null>(null);
  const [infoFor, setInfoFor] = useState<DailyCollectionRecord | null>(null);
  const [undoFor, setUndoFor] = useState<DailyCollectionRecord | null>(null);
  const [receipt, setReceipt] = useState<{ receipt: Receipt; phone: string } | null>(null);

  const show = (n: Notice) => {
    setNotice(n);
    setTimeout(() => setNotice(null), 3500);
  };

  const run = async (record: DailyCollectionRecord, action: () => Promise<unknown>, okText: string) => {
    setBusyId(record.id);
    try {
      await action();
      show({ ok: true, text: okText });
      await onChanged();
      return true;
    } catch (err) {
      show({ ok: false, text: err instanceof Error ? err.message : t('somethingWentWrong', 'Something went wrong. Please try again.') });
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const collect = async (record: DailyCollectionRecord, amount: number, mode: string) => {
    const done = await run(
      record,
      () =>
        api.collectPayment({
          collection_account_id: record.collection_account_id,
          collection_date: todayIso(),
          amount_paid: amount,
          payment_mode: mode,
          collector_id: currentUser.collector_id || record.collector_id,
        }),
      `${record.customer_name}: ${t('paidToday', 'Paid')} ${formatCurrency(amount)}`
    );
    if (done) setCollectFor(null);
  };

  const markNotPaid = async (record: DailyCollectionRecord, reason: string, note: string) => {
    const done = await run(
      record,
      () =>
        api.collectPayment({
          collection_account_id: record.collection_account_id,
          collection_date: todayIso(),
          amount_paid: 0,
          is_missed: true,
          reason,
          remarks: note || undefined,
          collector_id: currentUser.collector_id || record.collector_id,
        }),
      `${record.customer_name}: ${t('notPaid', 'Not paid')}`
    );
    if (done) setNotPaidFor(null);
  };

  const undo = async () => {
    if (!undoFor?.receipt_number) return;
    const record = undoFor;
    await run(
      record,
      () => api.undoPayment(record.receipt_number!, { name: currentUser.name, role: currentUser.role }),
      `${t('paymentUndone', 'Payment undone')}: ${record.customer_name}`
    );
    setUndoFor(null);
  };

  const openReceipt = async (record: DailyCollectionRecord) => {
    if (!record.receipt_number) return;
    try {
      setReceipt({ receipt: await api.getReceipt(record.receipt_number), phone: record.mobile_number });
    } catch (err) {
      show({ ok: false, text: err instanceof Error ? err.message : 'Receipt not found' });
    }
  };

  const ordered = [...records]
    .filter(r => matchesSearch(r, search))
    .sort((a, b) => (a.route_order || 9999) - (b.route_order || 9999));
  const main = ordered.filter(r => dayState(r) !== 'not-paid');
  const pending = ordered.filter(r => dayState(r) === 'not-paid');

  /**
   * Customer | Total amount | Pending terms | Collect, or Receipt and Undo once paid. Rows with pending
   * terms are tinted (the route order stays). Tapping the name shows the shop's details.
   */
  const table = (rows: DailyCollectionRecord[]) => (
    <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-400 border-b border-slate-800">
            <th className="py-2.5 pl-3 pr-1 font-semibold">{t('customer', 'Customer')}</th>
            <th className="py-2.5 px-1 font-semibold text-right">{t('totalAmount', 'Total amount')}</th>
            <th className="py-2.5 px-1 font-semibold text-center">{t('pendingTermsShort', 'Pending terms')}</th>
            <th className="py-2.5 pl-1 pr-3 font-semibold text-center">{t('payment', 'Payment')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map(record => {
            const paid = dayState(record) === 'paid';
            const pendingTerms = record.missed_days_count || 0;
            return (
              <tr key={record.id} className={pendingTerms > 0 ? 'bg-rose-500/10' : undefined}>
                <td className={`py-2.5 pl-2 pr-1 border-l-4 ${pendingTerms > 0 ? 'border-rose-500' : 'border-transparent'}`}>
                  <button
                    type="button"
                    onClick={() => (onOpenCustomer ? onOpenCustomer(record.customer_id) : setInfoFor(record))}
                    className="text-left"
                  >
                    <span className="block font-bold text-white underline decoration-slate-600 underline-offset-4">
                      {t(record.customer_name, record.customer_name)}
                    </span>
                    <span className="block text-xs text-slate-400">{record.shop_name}</span>
                    {dayState(record) === 'not-paid' && record.reason && (
                      <span className="block text-xs text-rose-300">{t('notPaid', 'Not paid')}: {t(record.reason, record.reason)}</span>
                    )}
                  </button>
                </td>
                <td className="py-2.5 px-1 text-right whitespace-nowrap">
                  {paid ? (
                    <span className="font-mono font-bold text-emerald-300">
                      {formatCurrency(record.paid_amount)}
                      <span className="block text-xs font-sans text-slate-400">{t(record.payment_mode || 'Cash', record.payment_mode || 'Cash')}</span>
                    </span>
                  ) : (
                    <span className="font-mono font-black text-gold-300">{formatCurrency(withMissedAmount(record))}</span>
                  )}
                </td>
                <td className="py-2.5 px-1 text-center font-mono">
                  {pendingTerms > 0 ? <strong className="text-rose-300 text-base">{pendingTerms}</strong> : <span className="text-slate-500">–</span>}
                </td>
                <td className="py-2 pl-1 pr-3">
                  {paid ? (
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openReceipt(record)}
                        aria-label={t('receipt', 'Receipt')}
                        title={t('receipt', 'Receipt')}
                        className="p-2 rounded-xl bg-gold-500/10 border border-gold-500/30 text-gold-300"
                      >
                        <ReceiptIcon className="w-4 h-4" />
                      </button>
                      {canCollect && (
                      <button
                        type="button"
                        onClick={() => setUndoFor(record)}
                        disabled={busyId === record.id}
                        aria-label={t('undo', 'Undo')}
                        title={t('undo', 'Undo')}
                        className="p-2 rounded-xl border border-slate-700 text-slate-300 hover:text-rose-300 disabled:opacity-50"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      )}
                    </div>
                  ) : canCollect ? (
                    <button
                      type="button"
                      onClick={() => setCollectFor(record)}
                      disabled={busyId === record.id}
                      className="w-full px-2 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <IndianRupee className="w-4 h-4" />
                      {t('collect', 'Collect')}
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
  );

  return (
    <div className="space-y-4">
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

      {notice && (
        <div className={`px-4 py-3 rounded-2xl text-sm font-semibold border ${
          notice.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          {notice.text}
        </div>
      )}

      {main.length === 0 && pending.length === 0 ? (
        <EmptyState icon={CheckCircle2} text={t('nobodyHere', 'Nobody here')} />
      ) : (
        main.length > 0 && table(main)
      )}

      {pending.length > 0 && (
        <section className="space-y-3 pt-2">
          <h3 className="text-base font-black text-rose-300">
            {t('pendingCustomers', 'Pending customers')} ({pending.length})
          </h3>
          {table(pending)}
        </section>
      )}

      {collectFor && (
        <CollectSheet
          record={collectFor}
          busy={busyId === collectFor.id}
          onSave={(amount, mode) => collect(collectFor, amount, mode)}
          onNotPaid={() => {
            setNotPaidFor(collectFor);
            setCollectFor(null);
          }}
          onClose={() => setCollectFor(null)}
        />
      )}
      {notPaidFor && (
        <NotPaidSheet
          record={notPaidFor}
          busy={busyId === notPaidFor.id}
          onSave={(reason, note) => markNotPaid(notPaidFor, reason, note)}
          onClose={() => setNotPaidFor(null)}
        />
      )}
      {infoFor && <CustomerInfoSheet record={infoFor} onClose={() => setInfoFor(null)} />}
      {undoFor && (
        <ConfirmSheet
          title={t('undoQuestion', 'Undo this payment?')}
          message={`${undoFor.customer_name} • ${formatCurrency(undoFor.paid_amount)}. ${t('undoExplain', 'The receipt will be marked cancelled and the balance goes back.')}`}
          yesLabel={t('yesUndo', 'Yes, undo')}
          noLabel={t('no', 'No')}
          danger
          busy={busyId === undoFor.id}
          onYes={undo}
          onNo={() => setUndoFor(null)}
        />
      )}
      {receipt && <ReceiptModal receipt={receipt.receipt} customerMobile={receipt.phone} onClose={() => setReceipt(null)} />}
    </div>
  );
};
