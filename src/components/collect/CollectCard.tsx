import React from 'react';
import { Check, CircleDollarSign, Receipt as ReceiptIcon, RotateCcw, X, AlertTriangle } from 'lucide-react';
import { DailyCollectionRecord } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import { BigButton, CallButton } from '../common/ui';
import { dayState, quickAmount } from './collectHelpers';

interface CollectCardProps {
  record: DailyCollectionRecord;
  busy: boolean;
  /** Collecting is only offered for the day being worked (not for past days). */
  canCollect: boolean;
  canUndo: boolean;
  onPaid: () => void;
  onOther: () => void;
  onNotPaid: () => void;
  onReceipt: () => void;
  onUndo: () => void;
  onOpenCustomer: () => void;
}

/** One customer on today's round: name, amount due, and the three actions. */
export const CollectCard: React.FC<CollectCardProps> = ({
  record,
  busy,
  canCollect,
  canUndo,
  onPaid,
  onOther,
  onNotPaid,
  onReceipt,
  onUndo,
  onOpenCustomer,
}) => {
  const { t } = useLanguage();
  const state = dayState(record);
  const missed = record.missed_days_count || 0;
  const border =
    state === 'paid' ? 'border-emerald-500/40' : state === 'not-paid' ? 'border-rose-500/40' : 'border-slate-800';

  return (
    <div className={`glass-card rounded-2xl p-4 border ${border} flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onOpenCustomer} className="text-left min-w-0">
          <div className="text-lg font-black text-white leading-tight truncate">{record.customer_name}</div>
          <div className="text-sm text-slate-400 truncate">{record.shop_name}</div>
          <div className="text-xs text-slate-500 truncate">{record.collection_area}</div>
        </button>
        <CallButton phone={record.mobile_number} label={t('call', 'Call')} />
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400 font-semibold">{t('todayDue', 'Today')}</div>
          <div className="text-3xl font-black text-gold-300 leading-none">{formatCurrency(record.daily_due)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400 font-semibold">{t('balance', 'Balance')}</div>
          <div className="text-base font-bold text-slate-200">{formatCurrency(record.balance_remaining)}</div>
        </div>
      </div>

      {missed > 0 && state !== 'paid' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-semibold">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            {missed} {t('daysNotPaid', 'days not paid')} • {formatCurrency(record.missed_amount || 0)}
          </span>
        </div>
      )}

      {state === 'paid' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm font-bold">
            <Check className="w-5 h-5" />
            <span>
              {t('paidToday', 'Paid')} {formatCurrency(record.paid_amount)}
              {record.payment_mode ? ` • ${t(record.payment_mode, record.payment_mode)}` : ''}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <BigButton small icon={ReceiptIcon} label={t('receipt', 'Receipt')} onClick={onReceipt} />
            {canUndo && <BigButton small icon={RotateCcw} label={t('undo', 'Undo')} onClick={onUndo} disabled={busy} />}
          </div>
        </div>
      )}

      {state === 'not-paid' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-bold">
          <X className="w-5 h-5" />
          <span>
            {t('notPaid', 'Not paid')}
            {record.reason ? ` • ${t(record.reason, record.reason)}` : ''}
          </span>
        </div>
      )}

      {state !== 'paid' && canCollect && (
        <div className="flex flex-col gap-2">
          <BigButton
            tone="green"
            icon={Check}
            label={`${t('paidButton', 'Paid')} ${formatCurrency(quickAmount(record))}`}
            onClick={onPaid}
            disabled={busy}
            className="w-full text-base py-4"
          />
          <div className={`grid ${state === 'todo' ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
            <BigButton small icon={CircleDollarSign} label={t('otherAmount', 'Other amount')} onClick={onOther} disabled={busy} />
            {state === 'todo' && <BigButton small icon={X} label={t('notPaid', 'Not paid')} onClick={onNotPaid} disabled={busy} />}
          </div>
        </div>
      )}
    </div>
  );
};
