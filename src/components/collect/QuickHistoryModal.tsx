import React from 'react';
import { X, CheckCircle2, AlertCircle, Clock, Calendar, Receipt as ReceiptIcon, ArrowRight, ShieldCheck, ChevronRight } from 'lucide-react';
import { DailyCollectionRecord } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';

interface QuickHistoryModalProps {
  record: DailyCollectionRecord;
  onShowReceipt: (receiptNumber: string) => void;
  onOpenFullPassbook: () => void;
  onClose: () => void;
}

export const QuickHistoryModal: React.FC<QuickHistoryModalProps> = ({
  record,
  onShowReceipt,
  onOpenFullPassbook,
  onClose,
}) => {
  const { t } = useLanguage();
  const history = record.recent_history || [];

  // Helper to format day name
  const getDayLabel = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      const dayNames = [
        t('sun', 'Sun'),
        t('mon', 'Mon'),
        t('tue', 'Tue'),
        t('wed', 'Wed'),
        t('thu', 'Thu'),
        t('fri', 'Fri'),
        t('sat', 'Sat'),
      ];
      return dayNames[dt.getUTCDay()];
    } catch {
      return '';
    }
  };

  const isToday = (dateStr: string) => dateStr === record.date;

  const paidCount = history.filter(h => h.status === 'PAID').length;
  const missedCount = history.filter(h => h.status === 'MISSED').length;
  const totalPaid = history.filter(h => h.status === 'PAID').reduce((s, h) => s + h.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-fadeIn">
      <div className="glass-card rounded-3xl border border-slate-700 w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-navy-900 to-navy-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-black text-white leading-tight">{record.customer_name}</div>
              <div className="text-xs text-slate-400">
                {record.shop_name || record.collection_area} • {t('sevenDayHistory', 'Last 7 Days Collection')}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 7-Day Stats Summary Banner */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-navy-900/60 border-b border-slate-800/80 text-center">
          <div>
            <div className="text-xs text-slate-400 font-semibold">{t('paidDays', 'Paid')}</div>
            <div className="text-lg font-black text-emerald-400">{paidCount} {t('days', 'days')}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">{t('missedDays', 'Missed')}</div>
            <div className="text-lg font-black text-rose-400">{missedCount} {t('days', 'days')}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">{t('totalPaid', '7-Day Total')}</div>
            <div className="text-lg font-black text-gold-300">{formatCurrency(totalPaid)}</div>
          </div>
        </div>

        {/* 7-Day Timeline List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
          {history.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              {t('noHistoryAvailable', 'No recent payment records found.')}
            </div>
          ) : (
            history.map((day, idx) => {
              const todayFlag = isToday(day.date);
              const dayName = getDayLabel(day.date);

              return (
                <div
                  key={day.date + idx}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    day.status === 'PAID'
                      ? 'bg-emerald-500/5 border-emerald-500/25'
                      : day.status === 'MISSED'
                      ? 'bg-rose-500/5 border-rose-500/25'
                      : day.status === 'PENDING'
                      ? 'bg-gold-500/10 border-gold-500/30'
                      : 'bg-navy-900/40 border-slate-800/60'
                  }`}
                >
                  {/* Left: Date & Status icon */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        day.status === 'PAID'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : day.status === 'MISSED'
                          ? 'bg-rose-500/20 text-rose-400'
                          : day.status === 'PENDING'
                          ? 'bg-gold-500/20 text-gold-400'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {day.status === 'PAID' && <CheckCircle2 className="w-5 h-5" />}
                      {day.status === 'MISSED' && <AlertCircle className="w-5 h-5" />}
                      {day.status === 'PENDING' && <Clock className="w-5 h-5" />}
                      {day.status === 'BEFORE_START' && <span className="text-xs font-bold">—</span>}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-black text-white">{dayName}</span>
                        <span className="text-xs text-slate-400 font-medium">({formatDate(day.date)})</span>
                        {todayFlag && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-gold-500/20 text-gold-300 border border-gold-500/40">
                            {t('today', 'Today')}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 truncate mt-0.5">
                        {day.status === 'PAID' && (
                          <span>
                            {day.mode ? t(day.mode, day.mode) : t('paid', 'Paid')}
                            {day.receipt_number ? ` • ${day.receipt_number}` : ''}
                          </span>
                        )}
                        {day.status === 'MISSED' && (
                          <span className="text-rose-400 font-medium">
                            {day.reason ? t(day.reason, day.reason) : t('notPaid', 'Not paid')}
                          </span>
                        )}
                        {day.status === 'PENDING' && (
                          <span className="text-gold-300 font-medium">
                            {t('pendingToday', 'Pending today')} ({formatCurrency(record.daily_due)})
                          </span>
                        )}
                        {day.status === 'BEFORE_START' && (
                          <span className="text-slate-500">{t('loanNotStartedYet', 'Before loan start date')}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount & Receipt Button */}
                  <div className="flex items-center gap-2 flex-shrink-0 text-right">
                    {day.status === 'PAID' ? (
                      <div>
                        <div className="text-base font-black text-emerald-400 leading-tight">
                          {formatCurrency(day.amount)}
                        </div>
                        {day.receipt_number && (
                          <button
                            type="button"
                            onClick={() => onShowReceipt(day.receipt_number!)}
                            className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-semibold underline mt-0.5"
                          >
                            <ReceiptIcon className="w-3 h-3" />
                            {t('receipt', 'Receipt')}
                          </button>
                        )}
                      </div>
                    ) : day.status === 'MISSED' ? (
                      <span className="text-xs font-bold text-rose-400 px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30">
                        {t('missed', 'Missed')}
                      </span>
                    ) : day.status === 'PENDING' ? (
                      <span className="text-xs font-bold text-gold-400 px-2 py-1 rounded-lg bg-gold-500/10 border border-gold-500/30">
                        {t('pending', 'Pending')}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer: Full Passbook Link */}
        <div className="p-3 bg-navy-900 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {t('balance', 'Balance Remaining')}:{' '}
            <strong className="text-white font-black">{formatCurrency(record.balance_remaining)}</strong>
          </div>
          <button
            type="button"
            onClick={onOpenFullPassbook}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 hover:text-white transition-colors"
          >
            <span>{t('viewFullPassbook', 'View 100-Day Passbook')}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
