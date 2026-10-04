import React, { useEffect, useState, useMemo } from 'react';
import { CollectionAccount, DailyCollectionRecord } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { scheduleDates, todayIso } from '../../../shared/finance';
import { useLanguage } from '../../context/LanguageContext';
import { CheckCircle2, Clock, AlertCircle, Calendar, Receipt as ReceiptIcon, ChevronRight } from 'lucide-react';
import { Spinner, EmptyState } from '../common/ui';

interface CustomerScheduleCalendarProps {
  account: CollectionAccount;
  onSelectReceipt?: (receiptNumber: string) => void;
}

export const CustomerScheduleCalendar: React.FC<CustomerScheduleCalendarProps> = ({
  account,
  onSelectReceipt,
}) => {
  const { t } = useLanguage();
  const [schedule, setSchedule] = useState<DailyCollectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const today = todayIso();

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api.getCollectionAccountSchedule(account.id)
      .then(records => {
        if (!isMounted) return;
        // Merge with generated dates to guarantee all days 1..collection_days exist
        const allDates = scheduleDates(account.start_date, account.collection_days);
        const map = new Map<string, DailyCollectionRecord>();
        records.forEach(r => map.set(r.date, r));

        const fullSchedule: DailyCollectionRecord[] = allDates.map((dateStr, idx) => {
          const dayNum = idx + 1;
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
        console.error('Failed to load schedule:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [account.id, account.start_date, account.collection_days, account.daily_collection]);

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

  if (loading) return <Spinner />;

  const paidCount = schedule.filter(s => s.paid_amount >= s.daily_due).length;
  const pendingCount = schedule.length - paidCount;

  return (
    <div className="space-y-4">
      {/* Top Summary Bar */}
      <div className="glass-card rounded-2xl p-4 sm:p-5 border border-gold-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
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

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-navy-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filter === 'all' ? 'bg-gold-500 text-navy-950 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({schedule.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('paid')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filter === 'paid' ? 'bg-emerald-500 text-navy-950 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Paid ({paidCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('pending')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filter === 'pending' ? 'bg-amber-500 text-navy-950 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Pending ({pendingCount})
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-semibold text-slate-300 flex-wrap pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shadow-sm shadow-emerald-500/50" />
            <span>Paid</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-400 ring-2 ring-amber-400/40 inline-block animate-pulse" />
            <span>Today's Due</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
            <span>Missed / Overdue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-slate-700 inline-block" />
            <span>Scheduled</span>
          </div>
        </div>
      </div>

      {/* Calendar Months Progression */}
      {groupedByMonth.length === 0 ? (
        <EmptyState icon={Calendar} text="No scheduled collection days match this filter." />
      ) : (
        groupedByMonth.map(group => (
          <div key={group.monthKey} className="glass-card rounded-2xl p-4 sm:p-5 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-sm font-black text-gold-300 uppercase tracking-wider flex items-center gap-2">
                <span>{group.monthLabel}</span>
                <span className="text-xs font-normal text-slate-400">
                  ({group.items.length} {group.items.length === 1 ? 'day' : 'days'})
                </span>
              </h4>
              <div className="text-xs text-slate-400">
                Days {group.items[0]?.collection_day_number} &ndash; {group.items[group.items.length - 1]?.collection_day_number}
              </div>
            </div>

            {/* Grid of Days */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2">
              {group.items.map(item => {
                const isPaid = item.paid_amount >= item.daily_due;
                const isPartial = item.paid_amount > 0 && item.paid_amount < item.daily_due;
                const isToday = item.date === today;
                const isOverdue = item.date < today && !isPaid;
                const hasReceipt = !!item.receipt_number;

                let cardStyle = 'bg-navy-950/70 border-slate-800 text-slate-300';
                if (isPaid) {
                  cardStyle = 'bg-emerald-950/40 border-emerald-500/40 text-emerald-100 hover:border-emerald-400';
                } else if (isToday) {
                  cardStyle = 'bg-amber-950/40 border-amber-400 ring-2 ring-amber-400/30 text-white';
                } else if (isPartial) {
                  cardStyle = 'bg-yellow-950/40 border-yellow-500/40 text-yellow-100';
                } else if (isOverdue) {
                  cardStyle = 'bg-rose-950/30 border-rose-500/30 text-rose-200';
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (hasReceipt && onSelectReceipt) {
                        onSelectReceipt(item.receipt_number!);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${cardStyle} ${
                      hasReceipt ? 'cursor-pointer hover:scale-[1.02] shadow-sm' : 'cursor-default'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-black uppercase font-mono px-1.5 py-0.5 rounded bg-navy-950/80 border border-slate-700/60 text-slate-300">
                        Day {item.collection_day_number}
                      </span>
                      {isPaid ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      ) : isToday ? (
                        <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse flex-shrink-0" />
                      ) : isOverdue ? (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                      ) : null}
                    </div>

                    <div className="text-xs font-bold truncate">
                      {new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </div>

                    <div className="mt-1 pt-1 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                      <span className="font-mono font-bold">
                        {isPaid ? formatCurrency(item.paid_amount) : formatCurrency(item.daily_due)}
                      </span>
                      {hasReceipt && (
                        <span title="Click to view receipt" className="inline-flex items-center">
                          <ReceiptIcon className="w-3 h-3 text-gold-400 flex-shrink-0" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
