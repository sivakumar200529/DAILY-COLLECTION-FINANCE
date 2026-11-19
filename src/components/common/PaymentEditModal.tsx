import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, ShieldAlert, X } from 'lucide-react';
import { PaymentTransaction, CollectionAccount, Collector } from '../../types';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { roundMoney, todayIso } from '../../../shared/finance';
import { useLanguage } from '../../context/LanguageContext';
import { useConfig } from '../../context/ConfigContext';
import { MODE_NOTE_MAX, isOtherMode, modeChoices } from '../../../shared/config';

interface PaymentEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment?: PaymentTransaction | null;
  account: CollectionAccount;
  customerName: string;
  shopName?: string;
  defaultDate?: string;
  currentUser: { name: string; role: string };
  onSuccess: () => void;
}

/**
 * The office changes a payment, or adds one for a past day. Kept plain: date, amount, how it was
 * paid (the modes switched on in Settings), who collected it, and a note.
 */
export const PaymentEditModal: React.FC<PaymentEditModalProps> = ({
  isOpen,
  onClose,
  payment,
  account,
  customerName,
  defaultDate,
  currentUser,
  onSuccess,
}) => {
  const { t } = useLanguage();
  const { config } = useConfig();
  const isAdmin = currentUser.role?.toUpperCase() === 'ADMIN';
  const today = todayIso();
  const configuredModes = modeChoices(config.masters.payment_modes);
  const defaultMode = config.masters.default_payment_mode || configuredModes[0] || 'Cash';

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState(defaultMode);
  const [collectorId, setCollectorId] = useState('');
  const [note, setNote] = useState('');
  const [modeNote, setModeNote] = useState('');
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    api.getCollectors().then(list => setCollectors(list)).catch(() => setCollectors([]));
    setAmount(String(payment ? payment.amount_paid : account.daily_collection || ''));
    setDate(payment ? payment.collection_date : defaultDate || today);
    setMode(payment ? payment.payment_mode : defaultMode);
    setModeNote(payment?.payment_mode_note || '');
    setCollectorId(payment?.collector_id || account.assigned_collector_id || '');
    setNote(payment?.remarks || '');
    setError(null);
  }, [isOpen, payment, account, defaultDate]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md">
        <div className="glass-card rounded-3xl p-6 max-w-md w-full border border-rose-500/40 text-center space-y-4">
          <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto" />
          <p className="text-sm text-slate-200">{t('onlyAdminCanModify', 'Only the office can change payments.')}</p>
          <button type="button" onClick={onClose} className="w-full py-3 rounded-xl bg-slate-800 text-white font-bold">
            {t('close', 'Close')}
          </button>
        </div>
      </div>
    );
  }

  // A payment made in a mode that is no longer offered keeps that mode as a choice.
  const modes = payment && !configuredModes.includes(payment.payment_mode) ? [...configuredModes, payment.payment_mode] : configuredModes;
  const value = Number(amount);
  const oldAmount = payment ? payment.amount_paid : 0;
  const maxAmount = roundMoney(account.remaining_amount + oldAmount);
  const balanceAfter = Math.max(0, roundMoney(maxAmount - (Number.isFinite(value) ? value : 0)));
  const activeCollectors = collectors.filter(c => c.status === 'ACTIVE' || c.id === collectorId);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(value) || value <= 0) return setError(t('enterValidAmount', 'Enter the amount.'));
    if (value > maxAmount) return setError(t('amountMoreThanBalance', 'The amount is more than the balance.') + ` (${formatCurrency(maxAmount)})`);
    if (!date) return setError(t('chooseDate', 'Choose the date.'));
    if (date > today) return setError(t('noFutureDate', 'A payment cannot be entered for a future date.'));
    if (date < account.start_date) return setError(t('beforeLoanStart', 'This is before the loan started.') + ` (${account.start_date})`);
    if (isOtherMode(mode) && !modeNote.trim()) return setError(t('howPaidNeeded', 'Write how it was paid.'));

    const collector = collectors.find(c => c.id === collectorId);
    setBusy(true);
    setError(null);
    try {
      if (payment) {
        await api.updatePayment(payment.id, {
          amount_paid: value,
          collection_date: date,
          payment_mode: mode,
          payment_mode_note: isOtherMode(mode) ? modeNote.trim() : '',
          collector_id: collectorId,
          collector_name: collector ? collector.name : payment.collector_name,
          remarks: note,
          by: currentUser.name,
          role: currentUser.role,
        });
      } else {
        await api.collectPayment({
          collection_account_id: account.id,
          amount_paid: value,
          collection_date: date,
          payment_mode: mode,
          payment_mode_note: isOtherMode(mode) ? modeNote.trim() : undefined,
          collector_id: collectorId || undefined,
          remarks: note,
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('somethingWentWrong', 'Something went wrong. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const label = 'block text-sm font-bold text-slate-300 mb-1.5';
  const field = 'w-full px-4 py-3 rounded-xl bg-navy-950 border border-slate-700 text-white focus:outline-none focus:border-gold-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-navy-950/80 backdrop-blur-md overflow-y-auto">
      <form onSubmit={save} className="glass-card rounded-3xl p-5 sm:p-6 max-w-md w-full border border-gold-500/30 space-y-4 shadow-2xl my-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white">
              {payment ? t('changePayment', 'Change payment') : t('addPayment', 'Add payment')}
            </h2>
            <p className="text-sm text-slate-400">{customerName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('close', 'Close')} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className={label} htmlFor="pay-date">{t('date', 'Date')}</label>
          <input id="pay-date" type="date" value={date} min={account.start_date} max={today} onChange={e => setDate(e.target.value)} className={`${field} font-mono`} required />
        </div>

        <div>
          <label className={label} htmlFor="pay-amount">{t('amount', 'Amount')}</label>
          <input
            id="pay-amount"
            type="number"
            inputMode="decimal"
            min="1"
            step="any"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className={`${field} font-mono font-black text-2xl text-gold-300`}
            required
          />
          <div className="mt-1.5 flex justify-between text-sm text-slate-400">
            <span>{t('dayAmount', 'Day amount')}: <strong className="text-white font-mono">{formatCurrency(account.daily_collection)}</strong></span>
            <span>{t('balanceAfter', 'Balance after')}: <strong className="text-gold-300 font-mono">{formatCurrency(balanceAfter)}</strong></span>
          </div>
        </div>

        {modes.length > 1 && (
          <div className="space-y-2">
            <span className={label}>{t('paidBy', 'Paid by')}</span>
            <div className={`grid gap-2 ${modes.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {modes.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`py-3 rounded-xl font-bold border ${mode === m ? 'bg-gold-500 text-navy-950 border-gold-400' : 'bg-navy-950 text-slate-300 border-slate-700'}`}
                >
                  {t(m, m)}
                </button>
              ))}
            </div>
            {isOtherMode(mode) && (
              <input
                type="text"
                aria-label={t('howPaid', 'How was it paid?')}
                maxLength={MODE_NOTE_MAX}
                value={modeNote}
                onChange={e => setModeNote(e.target.value)}
                placeholder={t('howPaidExample', 'e.g. Cheque 123456')}
                className={field}
              />
            )}
          </div>
        )}

        <div>
          <label className={label} htmlFor="pay-collector">{t('collector', 'Collector')}</label>
          <select id="pay-collector" value={collectorId} onChange={e => setCollectorId(e.target.value)} className={field}>
            {!payment?.collector_id && <option value="">{t('office', 'Office')}</option>}
            {activeCollectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className={label} htmlFor="pay-note">{t('noteOptional', 'Note (optional)')}</label>
          <input id="pay-note" type="text" value={note} onChange={e => setNote(e.target.value)} className={field} />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={busy} className="py-3.5 rounded-2xl bg-slate-800 text-slate-200 font-bold">
            {t('cancel', 'Cancel')}
          </button>
          <button type="submit" disabled={busy} className="py-3.5 rounded-2xl bg-gold-500 text-navy-950 font-black flex items-center justify-center gap-2 disabled:opacity-60">
            <Check className="w-5 h-5" />
            {busy ? t('saving', 'Saving…') : t('save', 'Save')}
          </button>
        </div>
      </form>
    </div>
  );
};
