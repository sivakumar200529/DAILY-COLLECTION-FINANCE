import React, { useState, useEffect, useMemo } from 'react';
import { CollectionAccount, Collector } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { scheduleDates } from '../../../shared/finance';
import { useLanguage } from '../../context/LanguageContext';
import {
  BookOpen,
  Check,
  CheckSquare,
  Square,
  Calendar,
  DollarSign,
  AlertCircle,
  Sparkles,
  X,
  CreditCard,
  UserCheck,
  FileText,
  Sliders,
  CheckCircle2,
} from 'lucide-react';

interface HandNoteBulkModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: CollectionAccount;
  customerName: string;
  currentUser: { name: string; role: string };
  onSuccess: () => void;
}

export const HandNoteBulkModal: React.FC<HandNoteBulkModalProps> = ({
  isOpen,
  onClose,
  account,
  customerName,
  currentUser,
  onSuccess,
}) => {
  const { t } = useLanguage();
  const isAdmin = currentUser.role?.toUpperCase() === 'ADMIN';

  // Entry method: 'range' (Days 1 to N) or 'checklist' (specific days)
  const [entryMode, setEntryMode] = useState<'range' | 'checklist'>('range');
  const [upToDay, setUpToDay] = useState<number>(Math.min(10, account.collection_days));
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());
  const [dailyAmount, setDailyAmount] = useState<number>(account.daily_collection);
  const [paymentMode, setPaymentMode] = useState<string>('Cash');
  const [collectorId, setCollectorId] = useState<string>(account.assigned_collector_id || '');
  const [remarks, setRemarks] = useState<string>('Recorded from hand note / கை நோட்டு வரவு');
  const [overwriteExisting, setOverwriteExisting] = useState<boolean>(false);

  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [alreadyPaidDays, setAlreadyPaidDays] = useState<Set<number>>(new Set());
  const [loadingSchedule, setLoadingSchedule] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const allDates = useMemo(() => {
    return scheduleDates(account.start_date, account.collection_days);
  }, [account.start_date, account.collection_days]);

  // Load active collectors and current schedule to see which days are already paid
  useEffect(() => {
    if (!isOpen) return;

    api.getCollectors()
      .then(cols => setCollectors(cols.filter(c => c.status === 'ACTIVE')))
      .catch(() => {});

    setLoadingSchedule(true);
    api.getCollectionAccountSchedule(account.id)
      .then(records => {
        const paidSet = new Set<number>();
        records.forEach(r => {
          if (r.paid_amount >= r.daily_due && r.collection_day_number) {
            paidSet.add(r.collection_day_number);
          }
        });
        setAlreadyPaidDays(paidSet);

        // Pre-select next unpaid days up to completed_days + 10
        const initialSelected = new Set<number>();
        for (let d = 1; d <= Math.min(account.completed_days + 5, account.collection_days); d++) {
          initialSelected.add(d);
        }
        setSelectedDays(initialSelected);
        if (account.completed_days > 0) {
          setUpToDay(Math.min(account.completed_days, account.collection_days));
        }
      })
      .catch(err => {
        console.error('Failed to load schedule for hand-note modal:', err);
      })
      .finally(() => {
        setLoadingSchedule(false);
      });
  }, [isOpen, account.id, account.completed_days, account.collection_days]);

  if (!isOpen) return null;

  // Compute targeted days based on mode
  const targetDaysList = useMemo(() => {
    if (entryMode === 'range') {
      const list: number[] = [];
      for (let d = 1; d <= upToDay; d++) {
        if (overwriteExisting || !alreadyPaidDays.has(d)) {
          list.push(d);
        }
      }
      return list;
    } else {
      const list: number[] = [];
      selectedDays.forEach(d => {
        if (overwriteExisting || !alreadyPaidDays.has(d)) {
          list.push(d);
        }
      });
      return list.sort((a, b) => a - b);
    }
  }, [entryMode, upToDay, selectedDays, overwriteExisting, alreadyPaidDays]);

  const totalCalculated = targetDaysList.length * dailyAmount;
  const newProjectedBalance = Math.max(0, account.remaining_amount - totalCalculated);

  const toggleDaySelection = (dayNum: number) => {
    const next = new Set(selectedDays);
    if (next.has(dayNum)) {
      next.delete(dayNum);
    } else {
      next.add(dayNum);
    }
    setSelectedDays(next);
  };

  const selectQuickRange = (count: number) => {
    setUpToDay(Math.min(count, account.collection_days));
  };

  const handleSelectAll = () => {
    const next = new Set<number>();
    for (let d = 1; d <= account.collection_days; d++) {
      next.add(d);
    }
    setSelectedDays(next);
  };

  const handleClearAll = () => {
    setSelectedDays(new Set());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setError(t('onlyAdminCanModify', 'Access Denied: Only office administrators can modify payment history.'));
      return;
    }
    if (targetDaysList.length === 0) {
      setError(t('noDaysSelected', 'No days selected or all selected days are already recorded.'));
      return;
    }
    if (dailyAmount <= 0) {
      setError(t('invalidAmount', 'Please enter a valid daily amount.'));
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await api.bulkHandNoteEntry(account.id, {
        role: currentUser.role,
        by: currentUser.name,
        ...(entryMode === 'range' && !overwriteExisting ? { up_to_day: upToDay } : { day_numbers: targetDaysList }),
        daily_amount: dailyAmount,
        payment_mode: paymentMode,
        collector_id: collectorId,
        remarks,
        overwrite_existing: overwriteExisting,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save hand note entries');
    } finally {
      setSubmitting(false);
    }
  };

  const endDateForUpToDay = allDates[Math.min(upToDay - 1, allDates.length - 1)] || account.start_date;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-navy-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-navy-900 to-navy-950 border border-gold-500/30 rounded-3xl shadow-2xl p-4 sm:p-6 my-6 text-white max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gold-500/20 border border-gold-500/40 flex items-center justify-center text-gold-400 shadow-inner">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">
                  {t('handNoteUpload', 'Upload from Hand Note')}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gold-500/20 text-gold-300 border border-gold-500/30">
                  {t('adminOnly', 'ADMIN ONLY')}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {t('handNoteSubtitle', 'Quickly upload past paid days from your physical paper notebook for existing customer')} &bull; <strong className="text-gold-300">{t(customerName, customerName)}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-4">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Account Financial Snapshot Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="glass-card rounded-xl p-2.5 bg-navy-950/80 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-semibold">{t('totalLoan', 'Total Loan')}</div>
              <div className="text-sm font-black text-white font-mono">{formatCurrency(account.total_repayment)}</div>
            </div>
            <div className="glass-card rounded-xl p-2.5 bg-navy-950/80 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-semibold">{t('dailyPayment', 'Daily Due')}</div>
              <div className="text-sm font-black text-gold-300 font-mono">{formatCurrency(account.daily_collection)}</div>
            </div>
            <div className="glass-card rounded-xl p-2.5 bg-navy-950/80 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-semibold">{t('paidSoFar', 'Recorded Paid')}</div>
              <div className="text-sm font-black text-emerald-400 font-mono">
                {account.completed_days} / {account.collection_days} {t('days', 'days')}
              </div>
            </div>
            <div className="glass-card rounded-xl p-2.5 bg-navy-950/80 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-semibold">{t('balance', 'Current Balance')}</div>
              <div className="text-sm font-black text-amber-300 font-mono">{formatCurrency(account.remaining_amount)}</div>
            </div>
          </div>

          {/* Entry Mode Switcher */}
          <div className="flex rounded-xl bg-navy-950 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setEntryMode('range')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                entryMode === 'range'
                  ? 'bg-gold-500 text-navy-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{t('quickRangeMode', '1. Fast Range (Paid up to Day N)')}</span>
            </button>
            <button
              type="button"
              onClick={() => setEntryMode('checklist')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                entryMode === 'checklist'
                  ? 'bg-gold-500 text-navy-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{t('checklistMode', '2. Specific Days Checklist')}</span>
            </button>
          </div>

          {/* MODE 1: Fast Range */}
          {entryMode === 'range' && (
            <div className="glass-card rounded-2xl p-4 bg-navy-950/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-gold-400" />
                  <span>{t('paidUpToDay', 'Paid up to Day')} (1 to {account.collection_days}):</span>
                </label>
                <span className="text-lg font-mono font-black text-gold-300">
                  Day {upToDay}
                </span>
              </div>

              {/* Slider */}
              <input
                type="range"
                min={1}
                max={account.collection_days}
                value={upToDay}
                onChange={e => setUpToDay(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-gold-500"
              />

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">{t('presets', 'Quick Fill')}:</span>
                {[10, 20, 30, 40, 50, 75, 100].filter(d => d <= account.collection_days).map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => selectQuickRange(d)}
                    className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                      upToDay === d
                        ? 'bg-gold-500/20 border-gold-500 text-gold-300'
                        : 'bg-navy-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    Day {d}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => selectQuickRange(account.collection_days)}
                  className="py-1 px-2.5 rounded-lg text-xs font-bold bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30 cursor-pointer"
                >
                  {t('allDaysPaid', 'All Paid')} ({account.collection_days})
                </button>
              </div>

              <div className="text-xs text-slate-400 bg-navy-900/90 rounded-xl p-2.5 border border-slate-800/80 flex items-center justify-between">
                <span>
                  {t('dateCoverage', 'Date Span')}: <strong className="text-white">{formatDate(account.start_date)}</strong> &rarr; <strong className="text-white">{formatDate(endDateForUpToDay)}</strong>
                </span>
                <span className="text-gold-300 font-mono font-bold">
                  {targetDaysList.length} {t('daysToRecord', 'days to record')}
                </span>
              </div>
            </div>
          )}

          {/* MODE 2: Specific Days Checklist */}
          {entryMode === 'checklist' && (
            <div className="glass-card rounded-2xl p-4 bg-navy-950/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">
                  {t('tapDaysInHandNote', 'Tap days that are marked paid in your notebook')}:
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="py-0.5 px-2 rounded-lg text-[10px] font-bold bg-navy-900 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
                  >
                    {t('selectAll', 'Select All')}
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="py-0.5 px-2 rounded-lg text-[10px] font-bold bg-navy-900 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
                  >
                    {t('clear', 'Clear')}
                  </button>
                </div>
              </div>

              {/* Grid of All Days */}
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 max-h-48 overflow-y-auto p-1 rounded-xl bg-navy-950 border border-slate-800">
                {Array.from({ length: account.collection_days }, (_, i) => i + 1).map(dayNum => {
                  const isSelected = selectedDays.has(dayNum);
                  const isAlreadyPaid = alreadyPaidDays.has(dayNum);

                  return (
                    <button
                      key={dayNum}
                      type="button"
                      onClick={() => toggleDaySelection(dayNum)}
                      className={`p-1.5 rounded-lg text-[11px] font-mono font-black transition-all cursor-pointer flex flex-col items-center justify-center border ${
                        isSelected
                          ? 'bg-emerald-950 border-emerald-500 text-emerald-200 shadow-sm'
                          : isAlreadyPaid
                          ? 'bg-navy-900/60 border-slate-800/80 text-emerald-500/70'
                          : 'bg-navy-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                      title={allDates[dayNum - 1] ? formatDate(allDates[dayNum - 1]) : `Day ${dayNum}`}
                    >
                      <span>D{dayNum}</span>
                      {isSelected ? (
                        <Check className="w-3 h-3 text-emerald-400 mt-0.5" />
                      ) : isAlreadyPaid ? (
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500/50 mt-0.5" />
                      ) : (
                        <span className="w-2.5 h-2.5 mt-0.5 block" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Payment Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-gold-400" />
                <span>{t('dailyAmount', 'Amount per Day')} (₹)</span>
              </label>
              <input
                type="number"
                min={1}
                value={dailyAmount}
                onChange={e => setDailyAmount(Number(e.target.value))}
                className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-sm font-mono font-bold text-white focus:border-gold-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-gold-400" />
                <span>{t('paymentMode', 'Payment Mode')}</span>
              </label>
              <select
                value={paymentMode}
                onChange={e => setPaymentMode(e.target.value)}
                className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-sm font-semibold text-white focus:border-gold-500 focus:outline-none"
              >
                <option value="Cash">Cash (ரொக்கம்)</option>
                <option value="GPay">GPay (கூகுள் பே)</option>
                <option value="PhonePe">PhonePe (போன்பே)</option>
                <option value="Paytm">Paytm (பேடிஎம்)</option>
                <option value="Bank Transfer">Bank Transfer (வங்கி பரிமாற்றம்)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-gold-400" />
                <span>{t('collector', 'Collector')}</span>
              </label>
              <select
                value={collectorId}
                onChange={e => setCollectorId(e.target.value)}
                className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-sm font-semibold text-white focus:border-gold-500 focus:outline-none"
              >
                <option value={account.assigned_collector_id}>{account.assigned_collector_name} (Assigned)</option>
                {collectors
                  .filter(c => c.id !== account.assigned_collector_id)
                  .map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </select>
            </div>
          </div>

          {/* Overwrite Toggle & Remarks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-navy-950/70 border border-slate-800">
              <span className="text-xs text-slate-300 font-semibold">
                {t('overwriteExistingDays', 'Overwrite already recorded days in this range')}
              </span>
              <input
                type="checkbox"
                checked={overwriteExisting}
                onChange={e => setOverwriteExisting(e.target.checked)}
                className="w-4 h-4 rounded accent-gold-500 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-gold-400" />
                <span>{t('remarks', 'Audit Remarks')}</span>
              </label>
              <input
                type="text"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="e.g. Migrated from Notebook Page 12"
                className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-xs text-white focus:border-gold-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Impact Calculation Preview Box */}
          <div className="rounded-2xl bg-gradient-to-r from-emerald-950/40 via-navy-950 to-emerald-950/40 border border-emerald-500/30 p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-black uppercase text-emerald-400 tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t('financialImpact', 'Live Financial Impact')}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-navy-900/90 border border-slate-800">
                <div className="text-[10px] text-slate-400">{t('daysToRecord', 'Days to Record')}</div>
                <div className="text-base font-black text-white font-mono">{targetDaysList.length}</div>
              </div>
              <div className="p-2 rounded-xl bg-navy-900/90 border border-slate-800">
                <div className="text-[10px] text-slate-400">{t('totalToCollect', 'Total Amount')}</div>
                <div className="text-base font-black text-emerald-400 font-mono">{formatCurrency(totalCalculated)}</div>
              </div>
              <div className="p-2 rounded-xl bg-navy-900/90 border border-slate-800">
                <div className="text-[10px] text-slate-400">{t('newBalance', 'New Balance')}</div>
                <div className="text-base font-black text-gold-300 font-mono">{formatCurrency(newProjectedBalance)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800 flex-shrink-0 mt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer transition-colors"
          >
            {t('cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || targetDaysList.length === 0}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 via-amber-500 to-gold-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 text-xs font-black shadow-lg shadow-gold-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all active:scale-95"
          >
            {submitting ? (
              <span>{t('saving', 'Saving Records...')}</span>
            ) : (
              <>
                <BookOpen className="w-4 h-4" />
                <span>
                  {t('saveHandNote', 'Save Hand Note Entries')} ({targetDaysList.length} {t('days', 'Days')} &bull; {formatCurrency(totalCalculated)})
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
