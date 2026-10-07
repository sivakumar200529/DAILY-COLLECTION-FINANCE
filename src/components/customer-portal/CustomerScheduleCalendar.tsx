import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { CollectionAccount, DailyCollectionRecord, PaymentTransaction } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { scheduleDates, todayIso } from '../../../shared/finance';
import { useLanguage } from '../../context/LanguageContext';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Receipt as ReceiptIcon,
  ChevronRight,
  Banknote,
  BookOpen,
  Zap,
  Edit3,
  RotateCcw,
  PlusCircle,
  Check,
  X,
  Circle,
  Sparkles,
} from 'lucide-react';
import { Spinner, EmptyState } from '../common/ui';
import { PaymentEditModal } from '../common/PaymentEditModal';
import { HandNoteBulkModal } from '../customers/HandNoteBulkModal';

interface CustomerScheduleCalendarProps {
  account: CollectionAccount;
  isAdmin?: boolean;
  onSelectReceipt?: (receiptNumber: string) => void;
  onRefresh?: () => void;
}

export const CustomerScheduleCalendar: React.FC<CustomerScheduleCalendarProps> = ({
  account,
  isAdmin,
  onSelectReceipt,
  onRefresh,
}) => {
  const { t } = useLanguage();
  const [schedule, setSchedule] = useState<DailyCollectionRecord[]>([]);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [fastTapMode, setFastTapMode] = useState<boolean>(false);
  const [tapBusyDate, setTapBusyDate] = useState<string | null>(null);

  // Modals state
  const [showHandNoteModal, setShowHandNoteModal] = useState<boolean>(false);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [editingPayment, setEditingPayment] = useState<PaymentTransaction | null>(null);
  const [paymentModalDate, setPaymentModalDate] = useState<string | undefined>(undefined);
  const [actionDay, setActionDay] = useState<DailyCollectionRecord | null>(null);

  const today = todayIso();

  const currentUser = useMemo(() => {
    try {
      const cached = localStorage.getItem('krs_user');
      return cached ? JSON.parse(cached) : { name: 'admin', role: 'ADMIN' };
    } catch {
      return { name: 'admin', role: 'ADMIN' };
    }
  }, []);

  const effectiveIsAdmin = isAdmin !== undefined ? isAdmin : (currentUser.role?.toUpperCase() === 'ADMIN');

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.getCollectionAccountSchedule(account.id),
      api.getPayments({ customer_id: account.customer_id }),
    ])
      .then(([records, paymentList]) => {
        setPayments(paymentList);
        const loanDates = scheduleDates(account.start_date, account.collection_days);
        const map = new Map<string, DailyCollectionRecord>();
        records.forEach(r => map.set(r.date, r));

        // Gather loan dates + any records + any active payment dates across past and future months
        const allUniqueDatesSet = new Set<string>(loanDates);
        records.forEach(r => { if (r.date) allUniqueDatesSet.add(r.date); });
        paymentList.forEach(p => { if (p.collection_date && p.status !== 'CANCELLED') allUniqueDatesSet.add(p.collection_date); });
        const allDates = Array.from(allUniqueDatesSet).sort();

        const fullSchedule: DailyCollectionRecord[] = allDates.map((dateStr) => {
          const loanIndex = loanDates.indexOf(dateStr);
          const dayNum = loanIndex !== -1 ? (loanIndex + 1) : 0;
          const existing = map.get(dateStr);
          if (existing) {
            return {
              ...existing,
              collection_day_number: existing.collection_day_number || dayNum,
              calendar_date: existing.calendar_date || dateStr,
            };
          }
          return {
            id: `DC-${dateStr}-${account.id}`,
            collection_account_id: account.id,
            customer_id: account.customer_id,
            customer_name: account.customer_name,
            shop_name: account.shop_name || '',
            mobile_number: '',
            collection_day_number: dayNum,
            calendar_date: dateStr,
            date: dateStr,
            daily_due: account.daily_collection,
            paid_amount: 0,
            pending_amount: account.daily_collection,
            advance_amount: 0,
            status: 'PENDING',
            collector_id: account.assigned_collector_id,
            collector_name: account.assigned_collector_name,
            collection_area: account.collection_area,
            balance_remaining: account.total_repayment,
          };
        });

        setSchedule(fullSchedule);
      })
      .catch(err => {
        console.error('Failed to load schedule calendar:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [account.id, account.customer_id, account.start_date, account.collection_days, account.daily_collection]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Group days by Month & Year for calendar breakdown across months
  const groupedByMonth = useMemo(() => {
    const groups: { monthKey: string; monthLabel: string; items: DailyCollectionRecord[] }[] = [];
    const groupMap = new Map<string, DailyCollectionRecord[]>();

    schedule.forEach(item => {
      if (filter === 'paid' && (item.paid_amount <= 0 || item.status === 'PENDING')) return;
      if (filter === 'pending' && item.paid_amount >= item.daily_due) return;

      const dateObj = new Date(item.date);
      const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = dateObj.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

      if (!groupMap.has(monthKey)) {
        const arr: DailyCollectionRecord[] = [];
        groupMap.set(monthKey, arr);
        groups.push({ monthKey, monthLabel, items: arr });
      }
      groupMap.get(monthKey)!.push(item);
    });

    return groups;
  }, [schedule, filter]);

  // Fast Tap to Pay / Undo Handler (for rapid matching with a paper hand note)
  const handleFastTap = async (item: DailyCollectionRecord) => {
    if (!effectiveIsAdmin || tapBusyDate) return;
    setTapBusyDate(item.date);

    const isPaid = item.paid_amount >= item.daily_due;

    try {
      if (!isPaid) {
        // Instant collect for this day
        await api.collectPayment({
          collection_account_id: account.id,
          collection_date: item.date,
          amount_paid: item.daily_due,
          payment_mode: 'Cash',
          remarks: 'Fast Tap from Hand Note (கை நோட்டு)',
        });
      } else {
        // Find payment to undo
        const p = payments.find(x => x.receipt_number === item.receipt_number && x.status !== 'CANCELLED');
        if (p) {
          await api.undoPayment(p.id, { name: currentUser.name, role: currentUser.role });
        } else if (item.receipt_number) {
          await api.undoPayment(item.receipt_number, { name: currentUser.name, role: currentUser.role });
        }
      }
      loadData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('Fast tap failed:', err);
      alert(err?.message || 'Action failed');
    } finally {
      setTapBusyDate(null);
    }
  };

  // Click on a day card
  const handleCardClick = (item: DailyCollectionRecord) => {
    if (effectiveIsAdmin) {
      if (fastTapMode) {
        handleFastTap(item);
      } else {
        setActionDay(item);
      }
    } else {
      // Non-admin customer view: open receipt if available
      if (item.receipt_number && onSelectReceipt) {
        onSelectReceipt(item.receipt_number);
      }
    }
  };

  // Perform quick collection for a selected day
  const handleQuickPayDay = async (item: DailyCollectionRecord) => {
    setActionDay(null);
    try {
      await api.collectPayment({
        collection_account_id: account.id,
        collection_date: item.date,
        amount_paid: item.daily_due,
        payment_mode: 'Cash',
        remarks: 'Recorded from Calendar Matrix',
      });
      loadData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err?.message || 'Collection failed');
    }
  };

  // Perform quick mark missed
  const handleQuickMarkMissed = async (item: DailyCollectionRecord) => {
    setActionDay(null);
    try {
      await api.collectPayment({
        collection_account_id: account.id,
        collection_date: item.date,
        amount_paid: 0,
        is_missed: true,
        reason: 'Marked missed in hand note',
      });
      loadData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err?.message || 'Action failed');
    }
  };

  // Perform undo for paid day
  const handleUndoDay = async (item: DailyCollectionRecord) => {
    setActionDay(null);
    const p = payments.find(x => x.receipt_number === item.receipt_number && x.status !== 'CANCELLED');
    try {
      if (p) {
        await api.undoPayment(p.id, { name: currentUser.name, role: currentUser.role });
      } else if (item.receipt_number) {
        await api.undoPayment(item.receipt_number, { name: currentUser.name, role: currentUser.role });
      }
      loadData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err?.message || 'Undo failed');
    }
  };

  // Open full payment edit modal for this day
  const handleOpenEditModal = (item: DailyCollectionRecord) => {
    const isPaid = item.paid_amount >= item.daily_due;
    setActionDay(null);
    if (isPaid) {
      const p = payments.find(x => x.receipt_number === item.receipt_number && x.status !== 'CANCELLED') || null;
      setEditingPayment(p);
      setPaymentModalDate(item.date);
    } else {
      setEditingPayment(null);
      setPaymentModalDate(item.date);
    }
    setShowPaymentModal(true);
  };

  if (loading && schedule.length === 0) return <Spinner />;

  const paidCount = schedule.filter(s => s.paid_amount >= s.daily_due).length;
  const pendingCount = schedule.length - paidCount;

  return (
    <div className="space-y-4">
      {/* Top Summary Bar & Admin Toolbar */}
      <div className="glass-card rounded-2xl p-4 sm:p-5 border border-gold-500/20 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gold-400" />
              <h3 className="text-base font-black text-white">
                {account.collection_days}-Day Collection Calendar Schedule
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {formatDate(account.start_date)} &rarr; {formatDate(account.expected_end_date)} &bull; {formatCurrency(account.daily_collection)} / day
            </p>
          </div>

          {/* Admin Toolbar Buttons */}
          {effectiveIsAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Hand Note Bulk Upload Button */}
              <button
                type="button"
                onClick={() => setShowHandNoteModal(true)}
                className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-gold-500 via-amber-500 to-gold-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-gold-500/20 active:scale-95 transition-all"
                title="Admin: Fast bulk upload from physical notebook"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{t('handNoteUpload', '📓 Upload from Hand Note')}</span>
              </button>

              {/* Record on Any Date / Month */}
              <button
                type="button"
                onClick={() => {
                  setEditingPayment(null);
                  setPaymentModalDate(undefined);
                  setShowPaymentModal(true);
                }}
                className="py-1.5 px-3 rounded-xl bg-navy-900 hover:bg-slate-800 border border-gold-500/30 text-gold-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all"
                title="Admin: Record or modify payment for any past or future month/date"
              >
                <PlusCircle className="w-3.5 h-3.5 text-gold-400" />
                <span>{t('recordAnyDateMonth', '+ Record Any Date / Month')}</span>
              </button>

              {/* Fast Tap Mode Toggle */}
              <button
                type="button"
                onClick={() => setFastTapMode(!fastTapMode)}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                  fastTapMode
                    ? 'bg-emerald-500 text-navy-950 border-emerald-400 shadow-md shadow-emerald-500/30 font-black animate-pulse'
                    : 'bg-navy-900 border-slate-700 text-slate-300 hover:border-gold-500/50 hover:text-white'
                }`}
                title="Toggle fast 1-tap marking from paper notebook"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{fastTapMode ? t('fastTapActive', '⚡ Tap Mode Active') : t('fastTapMode', '⚡ Fast Tap Mode')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Fast Tap Banner when Active */}
        {fastTapMode && effectiveIsAdmin && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400 animate-bounce" />
              <span>
                <strong>{t('handNoteFastMode', 'Hand Note Fast Mode')}:</strong> {t('fastModeNotice', 'Tap any unpaid day to instantly mark Paid (₹' + account.daily_collection + '). Tap any paid day to undo.')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setFastTapMode(false)}
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer ml-2"
            >
              {t('exit', 'Exit')}
            </button>
          </div>
        )}

        {/* Filter Pills & Legend Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          {/* Legend */}
          <div className="flex items-center gap-3 sm:gap-4 text-xs font-semibold text-slate-300 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shadow-sm shadow-emerald-500/50" />
              <span>Paid</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-400 ring-2 ring-amber-400/40 inline-block animate-pulse" />
              <span>Today</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
              <span>Missed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-slate-700 inline-block" />
              <span>Scheduled</span>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-navy-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filter === 'all' ? 'bg-gold-500 text-navy-950 shadow-sm font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({schedule.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('paid')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filter === 'paid' ? 'bg-emerald-500 text-navy-950 shadow-sm font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              Paid ({paidCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('pending')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filter === 'pending' ? 'bg-amber-500 text-navy-950 shadow-sm font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              Pending ({pendingCount})
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Months Progression (Exact visual style from user's photo) */}
      {groupedByMonth.length === 0 ? (
        <EmptyState icon={Calendar} text="No scheduled collection days match this filter." />
      ) : (
        groupedByMonth.map(group => (
          <div key={group.monthKey} className="glass-card rounded-2xl p-4 sm:p-5 border border-slate-800 space-y-3">
            {/* Month Header Banner (matches JULY 2026 (31 DAYS) Days 1 - 31) */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-xs sm:text-sm uppercase tracking-wider">
                  {group.monthLabel.toUpperCase()} ({group.items.length} DAYS)
                </span>
              </div>
              <div className="text-xs font-semibold text-slate-400">
                Days {group.items[0]?.collection_day_number} &ndash; {group.items[group.items.length - 1]?.collection_day_number}
              </div>
            </div>

            {/* Grid of Days (7 columns matching the photo) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2 sm:gap-2.5">
              {group.items.map(item => {
                const isPaid = item.paid_amount >= item.daily_due;
                const isPartial = item.paid_amount > 0 && item.paid_amount < item.daily_due;
                const isToday = item.date === today;
                const isOverdue = item.date < today && !isPaid;
                const hasReceipt = !!item.receipt_number;
                const isBusy = tapBusyDate === item.date;

                let cardStyle = 'bg-[#0a1524] border-slate-800/90 text-slate-300 hover:border-slate-700 hover:bg-[#0f1d32]';
                if (isPaid) {
                  cardStyle = 'bg-[#07231c] border-emerald-500/40 text-emerald-100 hover:border-emerald-400 shadow-md shadow-emerald-950/40';
                } else if (isToday) {
                  cardStyle = 'bg-[#22170b] border-amber-400 ring-2 ring-amber-400/30 text-white';
                } else if (isPartial) {
                  cardStyle = 'bg-[#221c0b] border-yellow-500/40 text-yellow-100';
                } else if (isOverdue) {
                  cardStyle = 'bg-[#240d15] border-rose-500/40 text-rose-200';
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleCardClick(item)}
                    disabled={isBusy}
                    className={`p-2.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer relative group ${cardStyle} ${
                      effectiveIsAdmin ? 'active:scale-95 hover:scale-[1.02]' : (hasReceipt ? 'hover:scale-[1.02]' : 'cursor-default')
                    }`}
                  >
                    {/* Top Row: DAY X badge & status indicator */}
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className={`text-[10px] font-black uppercase font-mono px-1.5 py-0.5 rounded ${
                        isPaid ? 'bg-emerald-900/60 border border-emerald-500/30 text-emerald-300' : 'bg-navy-950/90 border border-slate-700/60 text-slate-300'
                      }`}>
                        Day {item.collection_day_number}
                      </span>
                      {isPaid ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      ) : isToday ? (
                        <Clock className="w-4 h-4 text-amber-400 animate-pulse flex-shrink-0" />
                      ) : isOverdue ? (
                        <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                      )}
                    </div>

                    {/* Middle Row: Date (01 Jul) */}
                    <div className="text-sm font-bold text-white tracking-wide py-0.5">
                      {new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </div>

                    {/* Bottom Row: Amount & Cash Icon [💵] */}
                    <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                      <span className={`font-black ${isPaid ? 'text-emerald-300' : 'text-slate-300'}`}>
                        {isPaid ? formatCurrency(item.paid_amount) : formatCurrency(item.daily_due)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Banknote className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        {hasReceipt && !effectiveIsAdmin && (
                          <ReceiptIcon className="w-3 h-3 text-gold-400 flex-shrink-0" />
                        )}
                      </span>
                    </div>

                    {/* Loading overlay for fast tap */}
                    {isBusy && (
                      <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-xs rounded-2xl flex items-center justify-center">
                        <span className="w-4 h-4 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* QUICK DAY ACTION MODAL (When clicking a day card in Normal Admin Mode) */}
      {actionDay && effectiveIsAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-navy-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-gradient-to-b from-navy-900 to-navy-950 border border-gold-500/30 rounded-3xl p-5 shadow-2xl text-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase font-mono px-2 py-0.5 rounded bg-gold-500/20 text-gold-300 border border-gold-500/30">
                  DAY {actionDay.collection_day_number}
                </span>
                <h4 className="text-base font-black text-white mt-1">
                  {formatDate(actionDay.date)}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setActionDay(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status overview */}
            <div className="glass-card rounded-2xl p-3 bg-navy-950/70 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-semibold">{t('status', 'Status')}:</span>
              {actionDay.paid_amount >= actionDay.daily_due ? (
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t('paid', 'Paid')} ({formatCurrency(actionDay.paid_amount)})
                </span>
              ) : (
                <span className="font-bold text-amber-400">
                  {t('pending', 'Pending')} ({t('due', 'Due')}: {formatCurrency(actionDay.daily_due)})
                </span>
              )}
            </div>

            {/* Actions for Unpaid Day */}
            {actionDay.paid_amount < actionDay.daily_due ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleQuickPayDay(actionDay)}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-navy-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  <Banknote className="w-4 h-4" />
                  <span>{t('quickMarkPaid', '⚡ Quick Mark Paid')} ({formatCurrency(actionDay.daily_due)})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenEditModal(actionDay)}
                  className="w-full py-2.5 px-4 rounded-xl bg-navy-900 hover:bg-slate-800 border border-gold-500/30 text-gold-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Edit3 className="w-4 h-4 text-gold-400" />
                  <span>{t('customPayDetails', '✏️ Custom Amount / Edit Details')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickMarkMissed(actionDay)}
                  className="w-full py-2 px-4 rounded-xl bg-navy-950 hover:bg-rose-950/40 border border-slate-800 text-rose-300 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>{t('markMissed', 'Mark as Missed (₹0)')}</span>
                </button>
              </div>
            ) : (
              /* Actions for Paid Day */
              <div className="space-y-2">
                {actionDay.receipt_number && (
                  <div className="text-[11px] text-slate-400 bg-navy-950 p-2 rounded-xl border border-slate-800/80 flex items-center justify-between font-mono">
                    <span>Receipt: <strong>#{actionDay.receipt_number}</strong></span>
                    <span>Paid: <strong className="text-emerald-400">{formatCurrency(actionDay.paid_amount)}</strong></span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleOpenEditModal(actionDay)}
                  className="w-full py-2.5 px-4 rounded-xl bg-gold-500/20 hover:bg-gold-500/30 border border-gold-500/40 text-gold-300 font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Edit3 className="w-4 h-4 text-gold-400" />
                  <span>{t('modifyPayment', '✏️ Modify / Edit Payment')}</span>
                </button>

                {actionDay.receipt_number && onSelectReceipt && (
                  <button
                    type="button"
                    onClick={() => {
                      setActionDay(null);
                      onSelectReceipt(actionDay.receipt_number!);
                    }}
                    className="w-full py-2 px-4 rounded-xl bg-navy-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <ReceiptIcon className="w-3.5 h-3.5 text-gold-400" />
                    <span>{t('viewReceipt', 'View Receipt')}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleUndoDay(actionDay)}
                  className="w-full py-2 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t('undoPayment', 'Undo Payment')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* HAND NOTE BULK MODAL */}
      <HandNoteBulkModal
        isOpen={showHandNoteModal}
        onClose={() => setShowHandNoteModal(false)}
        account={account}
        customerName={account.customer_name}
        currentUser={currentUser}
        onSuccess={() => {
          loadData();
          if (onRefresh) onRefresh();
        }}
      />

      {/* PAYMENT EDIT / RECORD MODAL (Supports any past/future month & date) */}
      <PaymentEditModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        payment={editingPayment}
        account={account}
        customerName={account.customer_name}
        shopName={account.shop_name}
        defaultDate={paymentModalDate}
        currentUser={currentUser}
        onSuccess={() => {
          loadData();
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
};
