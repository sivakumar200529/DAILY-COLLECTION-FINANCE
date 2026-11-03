import React from 'react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { CollectorReport } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { CollectionDaySummary } from '../../../shared/collectorDay';
import { useLanguage } from '../../context/LanguageContext';

/** The nine report lines, for today's live figures or a report already sent. */
export interface Tally {
  summary: CollectionDaySummary;
  cashInApp: number;
  upiInApp: number;
  /** Notes counted by the collector; null while nothing has been counted yet. */
  cashCounted: number | null;
}

export const reportTally = (r: CollectorReport): Tally => ({
  summary: r.summary,
  cashInApp: r.cash_in_app,
  upiInApp: r.upi_in_app,
  cashCounted: r.cash_counted,
});

/**
 * The report one line at a time, as the collector sees it and the office checks it. "Amount in cash"
 * carries a cross until the counted notes equal it, then a tick.
 */
export const ReportTally: React.FC<{ tally: Tally }> = ({ tally: { summary: s, cashInApp: cash, upiInApp: upi, cashCounted } }) => {
  const { t } = useLanguage();
  const cashCheck = cashCounted === cash ? (
    <CheckCircle2 className="w-5 h-5 text-emerald-400" aria-label={t('tallyMatchesShort', 'Matches')} />
  ) : (
    <XCircle className="w-5 h-5 text-rose-400" aria-label={t('notMatching', 'Does not match')} />
  );
  const row = (label: string, value: React.ReactNode, strong = false, extra?: React.ReactNode) => (
    <div className={`px-4 py-2.5 ${strong ? 'bg-navy-950/60' : ''}`}>
      <div className="flex items-baseline justify-between gap-3">
        <dt className={`text-base ${strong ? 'font-bold text-white' : 'text-slate-300'}`}>{label}</dt>
        <dd className={`font-mono text-right flex items-center gap-1.5 ${strong ? 'text-xl font-black text-white' : 'text-base font-bold text-white'}`}>
          {value}
        </dd>
      </div>
      {extra}
    </div>
  );
  return (
    <dl className="glass-card rounded-2xl border border-slate-800 divide-y divide-slate-800 overflow-hidden">
      {row(t('totalCustomersAssigned', 'Total customers assigned'), s.customersAssigned)}
      {row(t('customersPaid', 'Customers paid'), s.customersPaid)}
      {row(t('pendingCustomers', 'Pending customers'), s.customersPending)}
      {row(t('totalExpectedCollection', 'Total expected collection'), formatCurrency(s.expected))}
      {row(t('totalCollection', 'Total collection'), formatCurrency(s.collected), true)}
      {row(t('balance', 'Balance'), formatCurrency(s.pendingAmount))}
      {row(
        t('amountInCash', 'Amount in cash'),
        <>
          {formatCurrency(cash)}
          {cashCheck}
        </>,
        false,
        cashCounted !== null && cashCounted !== cash && (
          <div className="text-sm text-rose-300 text-right mt-0.5">
            {t('notesCounted', 'Notes counted')} {formatCurrency(cashCounted)} ·{' '}
            {formatCurrency(Math.abs(cashCounted - cash))} {cashCounted < cash ? t('tallyShort', 'short') : t('tallyExtra', 'extra')}
          </div>
        )
      )}
      {row(t('amountInUpi', 'Amount in UPI'), formatCurrency(upi))}
      {row(t('grandTotal', 'Grand total'), formatCurrency(cash + upi), true)}
    </dl>
  );
};

/** Sent, waiting for approval, approved or rejected; a verified report says so. */
export const ReportStatusBadge: React.FC<{ report: Pick<CollectorReport, 'status' | 'verified_at'> }> = ({ report }) => {
  const { t } = useLanguage();
  if (report.verified_at && report.status !== 'REJECTED') {
    return (
      <span className="px-2 py-1 rounded-lg border text-xs font-bold flex items-center gap-1 whitespace-nowrap text-emerald-300 border-emerald-500/40 bg-emerald-500/10">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {t('reportVerified', 'Verified by office')}
      </span>
    );
  }
  const look: Record<CollectorReport['status'], [string, string]> = {
    ACCEPTED: [t('reportStatusSent', 'Sent'), 'text-sky-300 border-sky-500/40'],
    PENDING_APPROVAL: [t('reportStatusWaiting', 'Waiting for office approval'), 'text-amber-300 border-amber-500/40'],
    APPROVED: [t('reportStatusApproved', 'Approved'), 'text-emerald-300 border-emerald-500/40'],
    REJECTED: [t('reportStatusRejected', 'Rejected'), 'text-rose-300 border-rose-500/40'],
  };
  const [label, cls] = look[report.status];
  const Icon = report.status === 'REJECTED' ? XCircle : report.status === 'PENDING_APPROVAL' ? Clock : CheckCircle2;
  return (
    <span className={`px-2 py-1 rounded-lg border text-xs font-bold flex items-center gap-1 whitespace-nowrap ${cls}`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
};
