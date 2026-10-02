import React, { useCallback, useEffect, useState } from 'react';
import { Printer, Receipt as ReceiptIcon, RotateCcw, Wallet } from 'lucide-react';
import { DailyCollectionRecord, Receipt, User } from '../../types';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { todayIso } from '../../../shared/finance';
import { useLanguage } from '../../context/LanguageContext';
import { BigButton, ConfirmSheet, EmptyState, PageTitle, Spinner } from '../common/ui';
import { ReceiptModal } from '../collections/ReceiptModal';
import { DailyCollectionRegisterView } from '../collections/DailyCollectionRegisterView';
import { dayState } from './collectHelpers';

/** A collector's day at a glance: money in hand by payment way, and today's receipts. */
export const MyDayView: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const today = todayIso();
  const collectorId = currentUser.collector_id || 'ALL';

  const [records, setRecords] = useState<DailyCollectionRecord[] | null>(null);
  const [receiptView, setReceiptView] = useState<{ receipt: Receipt; phone: string } | null>(null);
  const [undoFor, setUndoFor] = useState<DailyCollectionRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);

  const load = useCallback(async () => {
    try {
      setRecords(await api.getDailyCollections({ date: today, collector: collectorId }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load');
      setRecords([]);
    }
  }, [today, collectorId]);

  useEffect(() => {
    load();
  }, [load]);

  if (showRegister) {
    return <DailyCollectionRegisterView onBack={() => setShowRegister(false)} date={today} collectorId={collectorId} />;
  }
  if (!records) return <Spinner />;

  const paid = records.filter(r => dayState(r) === 'paid');
  const total = paid.reduce((s, r) => s + r.paid_amount, 0);
  const byMode = paid.reduce<Record<string, number>>((acc, r) => {
    const mode = r.payment_mode || '-';
    acc[mode] = (acc[mode] || 0) + r.paid_amount;
    return acc;
  }, {});

  const undo = async () => {
    if (!undoFor?.receipt_number) return;
    setBusy(true);
    try {
      await api.undoPayment(undoFor.receipt_number, { name: currentUser.name, role: currentUser.role });
      setUndoFor(null);
      await load();
    } catch (err) {
      setUndoFor(null);
      setError(err instanceof Error ? err.message : 'Could not undo');
    } finally {
      setBusy(false);
    }
  };

  const openReceipt = async (record: DailyCollectionRecord) => {
    if (!record.receipt_number) return;
    try {
      setReceiptView({ receipt: await api.getReceipt(record.receipt_number), phone: record.mobile_number });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Receipt not found');
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <PageTitle
        title={t('navMyDay', 'My day')}
        subtitle={t('today', 'Today')}
        action={<BigButton small icon={Printer} label={t('printList', 'Print list')} onClick={() => setShowRegister(true)} />}
      />

      <div className="glass-card rounded-2xl p-5">
        <div className="text-sm text-slate-400 font-semibold flex items-center gap-2">
          <Wallet className="w-5 h-5 text-gold-400" />
          {t('collectedToday', 'Collected today')}
        </div>
        <div className="text-4xl font-black text-emerald-400 mt-1">{formatCurrency(total)}</div>
        <div className="flex flex-wrap gap-2 mt-3">
          {Object.entries(byMode).map(([mode, amount]) => (
            <span key={mode} className="px-3 py-1.5 rounded-xl bg-navy-950 border border-slate-700 text-sm text-slate-200 font-semibold">
              {t(mode, mode)}: {formatCurrency(amount)}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: t('tabPaid', 'Paid'), value: paid.length, tone: 'text-emerald-400' },
          { label: t('notPaid', 'Not paid'), value: records.filter(r => dayState(r) === 'not-paid').length, tone: 'text-rose-400' },
          { label: t('left', 'Left'), value: records.filter(r => dayState(r) === 'todo').length, tone: 'text-gold-300' },
        ].map(item => (
          <div key={item.label} className="glass-card rounded-2xl p-3 text-center">
            <div className={`text-2xl font-black ${item.tone}`}>{item.value}</div>
            <div className="text-xs text-slate-400 font-semibold">{item.label}</div>
          </div>
        ))}
      </div>

      {error && <div className="px-4 py-3 rounded-2xl text-sm font-semibold border bg-rose-500/10 border-rose-500/30 text-rose-300">{error}</div>}

      <h2 className="text-lg font-black text-white pt-2">{t('todaysReceipts', "Today's receipts")}</h2>
      {paid.length === 0 ? (
        <EmptyState icon={ReceiptIcon} text={t('noPaymentsYet', 'No payments yet')} />
      ) : (
        <div className="space-y-2">
          {paid.map(r => (
            <div key={r.id} className="glass-card rounded-2xl p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-bold text-white truncate">{r.customer_name}</div>
                <div className="text-xs text-slate-400">
                  {formatCurrency(r.paid_amount)} • {r.payment_mode ? t(r.payment_mode, r.payment_mode) : ''}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <BigButton small icon={ReceiptIcon} label={t('receipt', 'Receipt')} onClick={() => openReceipt(r)} />
                <BigButton small icon={RotateCcw} label={t('undo', 'Undo')} onClick={() => setUndoFor(r)} disabled={busy} />
              </div>
            </div>
          ))}
        </div>
      )}

      {undoFor && (
        <ConfirmSheet
          title={t('undoQuestion', 'Undo this payment?')}
          message={`${undoFor.customer_name} • ${formatCurrency(undoFor.paid_amount)}. ${t('undoExplain', 'The receipt will be marked cancelled and the balance goes back.')}`}
          yesLabel={t('yesUndo', 'Yes, undo')}
          noLabel={t('no', 'No')}
          danger
          busy={busy}
          onYes={undo}
          onNo={() => setUndoFor(null)}
        />
      )}
      {receiptView && (
        <ReceiptModal receipt={receiptView.receipt} customerMobile={receiptView.phone} onClose={() => setReceiptView(null)} />
      )}
    </div>
  );
};
