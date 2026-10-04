import React from 'react';
import {
  Check,
  CircleDollarSign,
  Receipt as ReceiptIcon,
  RotateCcw,
  X,
  AlertTriangle,
  QrCode,
  Phone,
  MessageCircle,
  Navigation,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { DailyCollectionRecord } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import { BigButton } from '../common/ui';
import { dayState, quickAmount } from './collectHelpers';

interface CollectCardProps {
  record: DailyCollectionRecord;
  busy: boolean;
  /** Collecting is only offered for the day being worked (not for past days). */
  canCollect: boolean;
  canUndo: boolean;
  stopNumber?: number;
  onPaid: () => void;
  onQrPay?: () => void;
  onOther: () => void;
  onNotPaid: () => void;
  onReceipt: () => void;
  onUndo: () => void;
  onOpenCustomer: () => void;
  onOpenHistory?: () => void;
}

/** One customer on today's round: name, street, due, quick actions, 7-day tracker & collection buttons. */
export const CollectCard: React.FC<CollectCardProps> = ({
  record,
  busy,
  canCollect,
  canUndo,
  stopNumber,
  onPaid,
  onQrPay,
  onOther,
  onNotPaid,
  onReceipt,
  onUndo,
  onOpenCustomer,
  onOpenHistory,
}) => {
  const { t, language } = useLanguage();
  const isTamil = language === 'ta';
  const state = dayState(record);
  const missed = record.missed_days_count || 0;
  const border =
    state === 'paid' ? 'border-emerald-500/40' : state === 'not-paid' ? 'border-rose-500/40' : 'border-slate-800';

  const cleanPhone = (record.whatsapp_number || record.mobile_number || '').replace(/\D/g, '');

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cleanPhone) return;
    const msg = isTamil
      ? `வணக்கம் ${record.customer_name}, KRS Finance இன்றைய தினசரி தவணைத் தொகை ₹${record.daily_due}. மீதமுள்ள இருப்பு: ₹${record.balance_remaining}. நன்றி!`
      : `Hello ${record.customer_name}, your KRS Finance daily due for today (${record.date}) is ₹${record.daily_due}. Remaining balance: ₹${record.balance_remaining}. Thank you!`;
    window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleMapNav = (e: React.MouseEvent) => {
    e.stopPropagation();
    const dest = [
      record.shop_name,
      record.shop_address || record.street,
      record.collection_area,
      'Salem, Tamil Nadu',
    ]
      .filter(Boolean)
      .join(', ');
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`, '_blank');
  };

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (cleanPhone) {
      window.location.href = `tel:${cleanPhone}`;
    }
  };

  return (
    <div className={`glass-card rounded-2xl p-4 border ${border} flex flex-col gap-3 transition-all`}>
      {/* Route Order & Street Stop Indicator */}
      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 font-medium">
        <div className="flex items-center gap-1.5 truncate">
          <span className="px-2 py-0.5 rounded-lg bg-gold-500/10 text-gold-400 font-black border border-gold-500/30 flex-shrink-0">
            #{record.route_order || stopNumber || 1}
          </span>
          <span className="truncate text-slate-300 font-bold">{record.street || record.collection_area}</span>
        </div>
        {record.landmark && (
          <span className="text-[10px] text-slate-500 truncate flex-shrink-0 max-w-[130px]" title={record.landmark}>
            {record.landmark}
          </span>
        )}
      </div>

      {/* Customer Info & Quick Communication Strip */}
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onOpenCustomer} className="text-left min-w-0 flex-1 group">
          <div className="text-lg font-black text-white leading-tight truncate group-hover:text-gold-300 transition-colors">
            {record.customer_name}
          </div>
          <div className="text-xs text-slate-400 truncate mt-0.5">{record.shop_name}</div>
        </button>

        {/* 3 Quick Action Buttons: Call, WhatsApp, Google Maps Navigation */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={handleCall}
            title={t('call', 'Call')}
            aria-label={t('call', 'Call')}
            className="w-8 h-8 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-sky-400 flex items-center justify-center transition-colors border border-slate-700"
          >
            <Phone className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleWhatsApp}
            title={t('whatsappReminder', 'WhatsApp')}
            aria-label={t('whatsappReminder', 'WhatsApp')}
            className="w-8 h-8 rounded-xl bg-slate-800/90 hover:bg-emerald-950 text-emerald-400 flex items-center justify-center transition-colors border border-slate-700 hover:border-emerald-600/40"
          >
            <MessageCircle className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleMapNav}
            title={t('navigateToShop', 'Google Maps Navigation')}
            aria-label={t('navigateToShop', 'Google Maps Navigation')}
            className="w-8 h-8 rounded-xl bg-slate-800/90 hover:bg-sky-950 text-blue-400 flex items-center justify-center transition-colors border border-slate-700 hover:border-blue-600/40"
          >
            <Navigation className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Due & Balance */}
      <div className="flex items-end justify-between gap-3 pt-1">
        <div>
          <div className="text-xs text-slate-400 font-semibold">{t('todayDue', 'Today')}</div>
          <div className="text-3xl font-black text-gold-300 leading-none">{formatCurrency(record.daily_due)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400 font-semibold">{t('balance', 'Balance')}</div>
          <div className="text-base font-bold text-slate-200">{formatCurrency(record.balance_remaining)}</div>
        </div>
      </div>

      {/* Quick 7-Day Payment History Strip ("Did I pay yesterday?" resolver) */}
      <button
        type="button"
        onClick={onOpenHistory}
        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-navy-950/70 border border-slate-800 hover:border-slate-700 text-left transition-colors group"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Calendar className="w-3.5 h-3.5 text-slate-400 group-hover:text-gold-400 transition-colors flex-shrink-0" />
          <span className="text-[11px] font-bold text-slate-400 group-hover:text-slate-200 truncate">
            {t('sevenDayHistory', '7-Day History')}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {(record.recent_history || []).slice(-7).map((d, i) => {
            const isPaid = d.status === 'PAID';
            const isMissed = d.status === 'MISSED';
            const isPending = d.status === 'PENDING';
            return (
              <span
                key={d.date + i}
                className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black ${
                  isPaid
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : isMissed
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    : isPending
                    ? 'bg-gold-500/20 text-gold-300 border border-gold-500/40'
                    : 'bg-slate-800 text-slate-500 border border-slate-700'
                }`}
                title={`${d.date}: ${d.status}${d.amount ? ` (₹${d.amount})` : ''}`}
              >
                {isPaid ? '✓' : isMissed ? '✕' : isPending ? '•' : '–'}
              </span>
            );
          })}
          <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors" />
        </div>
      </button>

      {/* Missed Warning */}
      {missed > 0 && state !== 'paid' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-semibold">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            {missed} {t('daysNotPaid', 'days not paid')} • {formatCurrency(record.missed_amount || 0)}
          </span>
        </div>
      )}

      {/* State: Paid */}
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

      {/* State: Not Paid */}
      {state === 'not-paid' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-bold">
          <X className="w-5 h-5" />
          <span>
            {t('notPaid', 'Not paid')}
            {record.reason ? ` • ${t(record.reason, record.reason)}` : ''}
          </span>
        </div>
      )}

      {/* Collection Action Buttons */}
      {state !== 'paid' && canCollect && (
        <div className="flex flex-col gap-2 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <BigButton
              tone="green"
              icon={Check}
              label={`${t('cashPaid', 'Cash')} ${formatCurrency(quickAmount(record))}`}
              onClick={onPaid}
              disabled={busy}
              className="text-sm py-3 font-black"
            />
            <button
              type="button"
              onClick={onQrPay}
              disabled={busy}
              className="flex items-center justify-center gap-2 px-3 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              <QrCode className="w-4 h-4" />
              <span>{t('showUpiQr', 'UPI QR Pay')}</span>
            </button>
          </div>

          <div className={`grid ${state === 'todo' ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
            <BigButton
              small
              icon={CircleDollarSign}
              label={t('otherAmount', 'Other amount')}
              onClick={onOther}
              disabled={busy}
            />
            {state === 'todo' && (
              <BigButton
                small
                icon={X}
                label={t('notPaid', 'Not paid')}
                onClick={onNotPaid}
                disabled={busy}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
