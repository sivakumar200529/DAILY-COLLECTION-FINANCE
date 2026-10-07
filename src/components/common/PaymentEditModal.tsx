import React, { useState, useEffect } from 'react';
import { PaymentTransaction, CollectionAccount, Collector } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import { 
  ShieldAlert, 
  Calendar, 
  DollarSign, 
  Check, 
  X, 
  UserCheck, 
  CreditCard, 
  FileText, 
  Sparkles,
  AlertCircle,
  Clock
} from 'lucide-react';

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

export const PaymentEditModal: React.FC<PaymentEditModalProps> = ({
  isOpen,
  onClose,
  payment,
  account,
  customerName,
  shopName,
  defaultDate,
  currentUser,
  onSuccess,
}) => {
  const { t } = useLanguage();
  const isAdmin = currentUser.role?.toUpperCase() === 'ADMIN';

  const [amountPaid, setAmountPaid] = useState<number>(
    payment ? payment.amount_paid : (account.daily_collection || 0)
  );
  const [collectionDate, setCollectionDate] = useState<string>(
    payment ? payment.collection_date : (defaultDate || new Date().toISOString().slice(0, 10))
  );
  const [paymentMode, setPaymentMode] = useState<string>(
    payment ? payment.payment_mode : 'Cash'
  );
  const [collectorId, setCollectorId] = useState<string>(
    payment?.collector_id || account.assigned_collector_id || ''
  );
  const [remarks, setRemarks] = useState<string>(
    payment?.remarks || ''
  );

  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getCollectors().then(setCollectors).catch(() => {});
      if (payment) {
        setAmountPaid(payment.amount_paid);
        setCollectionDate(payment.collection_date);
        setPaymentMode(payment.payment_mode);
        setCollectorId(payment.collector_id || account.assigned_collector_id || '');
        setRemarks(payment.remarks || '');
      } else {
        setAmountPaid(account.daily_collection || 0);
        setCollectionDate(defaultDate || new Date().toISOString().slice(0, 10));
        setPaymentMode('Cash');
        setCollectorId(account.assigned_collector_id || '');
        setRemarks('');
      }
      setError(null);
    }
  }, [isOpen, payment, account, defaultDate]);

  if (!isOpen) return null;

  // Strict Security: ONLY ADMIN can modify customer payment history!
  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md">
        <div className="glass-card rounded-3xl p-6 max-w-md w-full border border-rose-500/40 text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-white">{t('accessDenied', 'Access Denied')}</h3>
          <p className="text-xs text-slate-300">
            {t('onlyAdminCanModify', 'Payment history can be modified only by office administrators.')}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
          >
            {t('close', 'Close')}
          </button>
        </div>
      </div>
    );
  }

  // Month indicator calculation
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthPrefix = todayStr.slice(0, 7);
  const selectedMonthPrefix = collectionDate.slice(0, 7);
  const isPastMonth = selectedMonthPrefix < currentMonthPrefix;
  const isFutureMonth = selectedMonthPrefix > currentMonthPrefix;

  const shiftDateMonths = (deltaMonths: number) => {
    try {
      const base = collectionDate || todayStr;
      const parts = base.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month + deltaMonths, day);
      const yStr = d.getFullYear();
      const mStr = String(d.getMonth() + 1).padStart(2, '0');
      const dStr = String(d.getDate()).padStart(2, '0');
      setCollectionDate(`${yStr}-${mStr}-${dStr}`);
    } catch {}
  };

  const shiftDateDays = (deltaDays: number) => {
    try {
      const base = collectionDate || todayStr;
      const parts = base.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day + deltaDays);
      const yStr = d.getFullYear();
      const mStr = String(d.getMonth() + 1).padStart(2, '0');
      const dStr = String(d.getDate()).padStart(2, '0');
      setCollectionDate(`${yStr}-${mStr}-${dStr}`);
    } catch {}
  };

  // Projected balance calculation
  const oldAmount = payment ? payment.amount_paid : 0;
  const projectedRemaining = Math.max(
    0,
    Math.round((account.remaining_amount + oldAmount - (amountPaid || 0)) * 100) / 100
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amountPaid || amountPaid <= 0) {
      setError(t('enterValidAmount', 'Please enter a valid positive amount.'));
      return;
    }

    const selectedCollector = collectors.find(c => c.id === collectorId);
    setBusy(true);
    setError(null);

    try {
      if (payment) {
        // Edit existing payment
        await api.updatePayment(payment.id, {
          amount_paid: Number(amountPaid),
          collection_date: collectionDate,
          payment_mode: paymentMode,
          collector_id: collectorId,
          collector_name: selectedCollector ? selectedCollector.name : payment.collector_name,
          remarks,
          by: currentUser.name,
          role: currentUser.role,
        });
      } else {
        // Record new backdated or future payment
        await api.collectPayment({
          collection_account_id: account.id,
          amount_paid: Number(amountPaid),
          collection_date: collectionDate,
          payment_mode: paymentMode,
          collector_id: collectorId,
          remarks,
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save payment changes');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-navy-950/80 backdrop-blur-md overflow-y-auto">
      <div className="glass-card rounded-3xl p-5 sm:p-6 max-w-lg w-full border border-gold-500/30 text-left space-y-4 shadow-2xl my-auto animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gold-500/20 text-gold-300 border border-gold-500/30">
                ADMIN ONLY
              </span>
              <h2 className="text-base sm:text-lg font-black text-white">
                {payment 
                  ? t('modifyCustomerPayment', 'Modify Customer Payment') 
                  : t('recordPaymentAnyDate', 'Record Payment (Any Date)')}
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              <strong className="text-white">{t(customerName, customerName)}</strong>
              {shopName && <span> &bull; {t(shopName, shopName)}</span>}
              <span className="text-slate-500"> ({account.id})</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Notice */}
        {error && (
          <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Month Indicator Banner */}
        <div className={`p-3 rounded-2xl text-xs font-semibold flex items-center justify-between gap-2 border ${
          isPastMonth
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            : isFutureMonth
            ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
        }`}>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span>
              {isPastMonth && t('pastMonthNote', 'Past month collection record (before current month)')}
              {isFutureMonth && t('futureMonthNote', 'Future date collection record (after current month)')}
              {!isPastMonth && !isFutureMonth && t('currentMonthNote', 'Current month collection')}
            </span>
          </div>
          <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-black/30">
            {collectionDate}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Payment Date Input */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gold-400" />
              <span>{t('paymentDate', 'Payment Date')}</span>
              <span className="text-[10px] text-slate-400 font-normal">({t('anyMonthPastFuture', 'Select any past or future date')})</span>
            </label>
            <input
              type="date"
              value={collectionDate}
              onChange={(e) => setCollectionDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-navy-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-gold-500 transition-colors"
              required
            />

            {/* Quick Month & Day Jumpers */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">
                {t('quickDateJump', 'Jump Month / Date')}:
              </span>
              <button
                type="button"
                onClick={() => shiftDateMonths(-1)}
                className="py-1 px-2.5 rounded-lg bg-navy-900 border border-slate-800 hover:border-gold-500/50 text-[11px] font-bold text-slate-200 cursor-pointer flex items-center gap-1 active:scale-95 transition-all"
                title="Go back 1 month (முந்தைய மாதம்)"
              >
                <span>⏮️ -1 Month</span>
              </button>
              <button
                type="button"
                onClick={() => shiftDateDays(-7)}
                className="py-1 px-2.5 rounded-lg bg-navy-900 border border-slate-800 hover:border-gold-500/50 text-[11px] font-bold text-slate-200 cursor-pointer flex items-center gap-1 active:scale-95 transition-all"
                title="Go back 7 days"
              >
                <span>◀️ -7 Days</span>
              </button>
              <button
                type="button"
                onClick={() => setCollectionDate(todayStr)}
                className="py-1 px-2.5 rounded-lg bg-gold-500/20 border border-gold-500/40 text-gold-300 text-[11px] font-black cursor-pointer active:scale-95 transition-all"
                title="Today's date"
              >
                <span>🔘 Today</span>
              </button>
              <button
                type="button"
                onClick={() => shiftDateDays(7)}
                className="py-1 px-2.5 rounded-lg bg-navy-900 border border-slate-800 hover:border-gold-500/50 text-[11px] font-bold text-slate-200 cursor-pointer flex items-center gap-1 active:scale-95 transition-all"
                title="Forward 7 days"
              >
                <span>▶️ +7 Days</span>
              </button>
              <button
                type="button"
                onClick={() => shiftDateMonths(1)}
                className="py-1 px-2.5 rounded-lg bg-navy-900 border border-slate-800 hover:border-gold-500/50 text-[11px] font-bold text-slate-200 cursor-pointer flex items-center gap-1 active:scale-95 transition-all"
                title="Forward 1 month (அடுத்த மாதம்)"
              >
                <span>⏭️ +1 Month</span>
              </button>
              {account.start_date && (
                <button
                  type="button"
                  onClick={() => setCollectionDate(account.start_date)}
                  className="py-1 px-2.5 rounded-lg bg-navy-900 border border-slate-800 hover:border-emerald-500/50 text-[11px] font-bold text-emerald-300 cursor-pointer active:scale-95 transition-all"
                  title="Loan start date"
                >
                  <span>Start ({account.start_date})</span>
                </button>
              )}
            </div>
          </div>

          {/* Amount Paid Input & Quick Presets */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-gold-400" />
                <span>{t('amountPaid', 'Amount Paid (₹)')}</span>
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                {t('dailyDue', 'Daily due')}: <strong className="text-white">{formatCurrency(account.daily_collection)}</strong>
              </span>
            </div>
            <input
              type="number"
              step="any"
              min="1"
              value={amountPaid || ''}
              onChange={(e) => setAmountPaid(Number(e.target.value))}
              placeholder="0"
              className="w-full px-3.5 py-2.5 rounded-xl bg-navy-950 border border-slate-700 text-gold-300 font-mono font-black text-lg focus:outline-none focus:border-gold-500 transition-colors"
              required
            />

            {/* Quick Amount Presets */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => setAmountPaid(account.daily_collection)}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 cursor-pointer"
              >
                1 Day ({account.daily_collection})
              </button>
              <button
                type="button"
                onClick={() => setAmountPaid(account.daily_collection * 2)}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 cursor-pointer"
              >
                2 Days ({account.daily_collection * 2})
              </button>
              <button
                type="button"
                onClick={() => setAmountPaid(account.daily_collection * 5)}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 cursor-pointer"
              >
                5 Days ({account.daily_collection * 5})
              </button>
              <button
                type="button"
                onClick={() => setAmountPaid(account.remaining_amount + oldAmount)}
                className="px-2 py-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 text-[11px] font-bold cursor-pointer"
              >
                Full Loan ({account.remaining_amount + oldAmount})
              </button>
            </div>
          </div>

          {/* Real-Time Balance Impact Card */}
          <div className="p-3.5 rounded-2xl bg-navy-950/90 border border-slate-800 text-xs space-y-1.5">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              {t('liveBalanceImpact', 'Live Loan Balance Impact')}
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>{t('currentBalance', 'Current remaining balance')}:</span>
              <span className="font-mono font-bold text-white">{formatCurrency(account.remaining_amount)}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-white font-bold">
              <span className="text-gold-400">{t('newBalanceAfterEdit', 'Balance after this edit')}:</span>
              <span className="font-mono text-sm text-gold-300 font-black">{formatCurrency(projectedRemaining)}</span>
            </div>
          </div>

          {/* Payment Mode Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-gold-400" />
              <span>{t('paymentMode', 'Payment Mode')}</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'Cash', label: t('Cash', 'Cash') },
                { id: 'UPI', label: t('UPI', 'UPI / GPay') },
                { id: 'Bank Transfer', label: t('Bank Transfer', 'Bank Transfer') },
                { id: 'Cheque', label: t('Cheque', 'Cheque') },
              ].map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMode(m.id)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer border ${
                    paymentMode === m.id
                      ? 'bg-gold-500 text-navy-950 border-gold-400 shadow-md shadow-gold-500/20'
                      : 'bg-navy-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Collector / Officer Dropdown */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-gold-400" />
              <span>{t('collector', 'Collector / Agent')}</span>
            </label>
            <select
              value={collectorId}
              onChange={(e) => setCollectorId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-navy-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-gold-500 cursor-pointer"
            >
              {collectors.map(c => (
                <option key={c.id} value={c.id}>
                  {t(c.name, c.name)} ({c.mobile})
                </option>
              ))}
            </select>
          </div>

          {/* Remarks / Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-gold-400" />
              <span>{t('remarks', 'Admin Remarks / Correction Reason')}</span>
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={t('correctionReasonPlaceholder', 'e.g. Backdated cash collected at shop, corrected amount')}
              className="w-full px-3.5 py-2 rounded-xl bg-navy-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-gold-500 transition-colors"
            />
          </div>

          {/* Modal Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
            >
              {t('cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-gold-500 via-amber-500 to-gold-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-gold-500/25 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{busy ? t('saving...', 'Saving...') : t('saveChanges', 'Save Changes')}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
