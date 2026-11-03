import React, { useCallback, useEffect, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { CollectorReport, DailyCollectionRecord, DashboardStats, DayClosing } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { addDaysIso, daysLeftInMonth, todayIso } from '../../../shared/finance';
import { activeClosing } from '../../../shared/collectorDay';
import { useLanguage } from '../../context/LanguageContext';
import { BigButton, Spinner } from '../common/ui';
import type { CustomersTab } from '../customers/CustomerManagement';
import type { ReportTab } from '../reports/ReportsView';
import { FigureCard, FigureLine, TodayFigureLines } from './DayFigures';
import { WaitingAlerts } from './WaitingAlerts';
import { DayCloseBoard, closeBoardShown } from './DayCloseBoard';

interface AdminDashboardProps {
  onOpenCollect: () => void;
  onOpenLoans: (tab: CustomersTab) => void;
  onOpenReports: (tab: ReportTab) => void;
  onOpenStaff: () => void;
  officeName: string;
}

interface HomeData {
  stats: DashboardStats;
  records: DailyCollectionRecord[];
  reports: CollectorReport[];
  assigned: boolean;
  closing: DayClosing | undefined;
  /** Yesterday's closing, kept on Home until 6 am. */
  lastClosing: DayClosing | undefined;
}

/** The closed-day board stays on Home overnight and goes at this hour of the next day. */
const CLOSED_BOARD_UNTIL_HOUR = 6;

/** Milliseconds to the next midnight or 6 am, when Home has to look again. */
function msToNextChange(now = new Date()): number {
  const next = new Date(now);
  if (now.getHours() < CLOSED_BOARD_UNTIL_HOUR) next.setHours(CLOSED_BOARD_UNTIL_HOUR, 0, 5, 0);
  else next.setHours(24, 0, 5, 0);
  return next.getTime() - now.getTime();
}

/**
 * Home: the month and the organisation, with today's work on top once it has been assigned. Once every
 * report is in, the board for closing the day takes its place at the very top; once closed it stays until
 * 6 am the next day (above that day's work). On the last day of the
 * month the month comes next, highlighted. Every figure opens its section.
 */
export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onOpenCollect, onOpenLoans, onOpenReports, onOpenStaff, officeName }) => {
  const { t } = useLanguage();
  const [data, setData] = useState<HomeData | null>(null);

  const load = useCallback(() => {
    const date = todayIso();
    const yesterday = addDaysIso(date, -1);
    const overnight = new Date().getHours() < CLOSED_BOARD_UNTIL_HOUR;
    Promise.all([
      api.getDashboardStats(),
      api.getDailyCollections({ date }),
      api.getCollectorReports({ date }),
      api.getDayAssignment(date),
      api.getDayClosings(date).catch(() => []),
      overnight ? api.getDayClosings(yesterday).catch(() => []) : Promise.resolve([]),
    ])
      .then(([stats, records, reports, assignment, closings, lastClosings]) =>
        setData({
          stats,
          records,
          reports,
          assigned: assignment.assigned,
          closing: activeClosing(closings, date),
          lastClosing: activeClosing(lastClosings, yesterday),
        }))
      .catch(() => setData(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // At midnight yesterday's closed board stays; at 6 am it goes.
  useEffect(() => {
    const timer = window.setTimeout(load, msToNextChange());
    return () => window.clearTimeout(timer);
  }, [data, load]);

  if (!data) return <Spinner />;
  const { stats, records, reports, assigned, closing, lastClosing } = data;
  const lastDayOfMonth = daysLeftInMonth(todayIso()) === 0;
  // Once every report is in (and after closing) the closing board comes first, in place of today's figures.
  const closingDay = assigned && closeBoardShown(records, reports, closing);
  const openRegister = () => onOpenReports('monthly');

  const month = (
    <FigureCard
      title={lastDayOfMonth ? `${t('monthlyAnalytics', 'Monthly analytics')} • ${t('lastDayOfMonth', 'Last day of the month')}` : t('monthlyAnalytics', 'Monthly analytics')}
      highlighted={lastDayOfMonth}
    >
      <FigureLine
        large={lastDayOfMonth}
        figures={[
          { label: t('expectedCollection', 'Expected Collection'), value: formatCurrency(stats.monthExpected), onClick: openRegister },
          { label: t('totalCollection', 'Total Collection'), value: formatCurrency(stats.monthCollected), tone: 'text-emerald-400', onClick: openRegister },
          { label: t('balance', 'Balance'), value: formatCurrency(stats.monthBalance), tone: 'text-gold-300', onClick: openRegister },
        ]}
      />
    </FigureCard>
  );

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h1 className="text-2xl font-black text-white">{t('dashboard', 'Dashboard')}</h1>
        <p className="text-sm text-slate-400">{formatDate(todayIso())}</p>
      </div>

      {closingDay && (
        <DayCloseBoard
          officeName={officeName}
          records={records}
          reports={reports}
          closing={closing}
          onChanged={load}
          onOpenReports={() => onOpenReports('collectors')}
          onOpenClosings={() => onOpenReports('closings')}
        />
      )}
      {!closingDay && lastClosing && (
        <DayCloseBoard
          officeName={officeName}
          records={[]}
          reports={[]}
          closing={lastClosing}
          onChanged={load}
          onOpenReports={() => onOpenReports('collectors')}
          onOpenClosings={() => onOpenReports('closings')}
        />
      )}

      {lastDayOfMonth && month}

      {closingDay ? null : assigned ? (
        <FigureCard title={t('todaysWork', "Today's work")} prominent>
          <TodayFigureLines
            records={records}
            reports={reports}
            links={{
              collection: onOpenCollect,
              collectors: onOpenStaff,
              receipts: () => onOpenReports('receipts'),
              reports: () => onOpenReports('collectors'),
            }}
          />
        </FigureCard>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 glass-card rounded-2xl px-4 py-3 border border-amber-500/30">
          <span className="text-base font-bold text-amber-200">{t('workNotAssignedYet', "Today's work is not assigned yet")}</span>
          <BigButton small tone="gold" icon={CalendarCheck} label={t('assignTodaysWork', "Assign today's work")} onClick={onOpenCollect} />
        </div>
      )}

      {!lastDayOfMonth && month}

      <FigureCard title={t('orgStatistics', 'Organisation statistics')}>
        <FigureLine
          figures={[
            { label: t('totalCustomers', 'Total Customers'), value: stats.totalCustomers, onClick: () => onOpenLoans('all') },
            { label: t('totalCollectors', 'Total Collectors'), value: stats.totalCollectors, onClick: onOpenStaff },
            { label: t('activeLoans', 'Active Loans'), value: stats.activeAccounts, onClick: () => onOpenLoans('active') },
            { label: t('longStandingLoans', 'Long standing loans'), value: stats.longStandingLoans, tone: 'text-rose-300', onClick: () => onOpenReports('long-pending') },
          ]}
        />
      </FigureCard>

      <WaitingAlerts
        onOpenLoanRequests={() => onOpenLoans('requests')}
        onOpenUpiPayments={() => onOpenLoans('upi')}
        onOpenCollectorReports={() => onOpenReports('collectors')}
      />
    </div>
  );
};
