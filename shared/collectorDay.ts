// A collector's day: the figures on their main screen and in the report they send to the office.
// Used by the server (which stores the report) and the screens, so both always show the same numbers.

import { roundMoney } from './finance';

/** The fields of a day's collection record that the figures need. */
export interface DayRecordFigures {
  daily_due: number;
  /** Balance after today's payments. */
  balance_remaining: number;
  paid_amount: number;
  /** Terms missed before today. */
  missed_days_count?: number;
}

export interface CollectionDaySummary {
  customersAssigned: number;
  customersPaid: number;
  customersPending: number;
  /** Today's amount of every customer (never more than what they owed this morning). */
  expected: number;
  collected: number;
  /** What is still to come today, customer by customer (an advance from one does not cover another). */
  pendingAmount: number;
}

export function collectionDaySummary(records: DayRecordFigures[]): CollectionDaySummary {
  let expected = 0;
  let collected = 0;
  let pendingAmount = 0;
  let paid = 0;
  for (const r of records) {
    const due = Math.min(r.daily_due, r.balance_remaining + r.paid_amount);
    expected += due;
    collected += r.paid_amount;
    pendingAmount += Math.max(0, due - r.paid_amount);
    if (r.paid_amount > 0) paid++;
  }
  return {
    customersAssigned: records.length,
    customersPaid: paid,
    customersPending: records.length - paid,
    expected: roundMoney(expected),
    collected: roundMoney(collected),
    pendingAmount: roundMoney(pendingAmount),
  };
}

export function isCashMode(mode?: string): boolean {
  return (mode || 'Cash').trim().toLowerCase() === 'cash';
}

/** The day's payments: how many, and how much came as cash and as UPI. */
export function dayPaymentSplit(records: { paid_amount: number; payment_mode?: string }[]): { payments: number; cash: number; upi: number } {
  const paid = records.filter(r => r.paid_amount > 0);
  const sum = (list: typeof paid) => roundMoney(list.reduce((total, r) => total + r.paid_amount, 0));
  return {
    payments: paid.length,
    cash: sum(paid.filter(r => isCashMode(r.payment_mode))),
    upi: sum(paid.filter(r => !isCashMode(r.payment_mode))),
  };
}

/** The office has assigned a day's work; until then collectors wait. */
export interface DayAssignment {
  date: string;
  assigned_by: string;
  assigned_at: string;
}

/** A customer is "long pending" once this many terms are pending (Settings → Collection rules). */
export const isLongPending = (r: DayRecordFigures, afterTerms: number) => (r.missed_days_count || 0) >= afterTerms;

/** Long-pending customers today: how many, and how many of them have not paid yet. */
export function longPendingCounts(records: DayRecordFigures[], afterTerms: number): { pending: number; total: number } {
  const long = records.filter(r => isLongPending(r, afterTerms));
  return { pending: long.filter(r => r.paid_amount <= 0).length, total: long.length };
}

/** Indian notes the collector counts; coins and small change are entered as one amount. */
export const CASH_NOTES = [500, 200, 100, 50, 20, 10] as const;

export function countedCash(notes: Record<string, number>, coins: number): number {
  return CASH_NOTES.reduce((sum, note) => sum + note * (Number(notes[note]) || 0), 0) + (Number(coins) || 0);
}

/**
 * ACCEPTED: sent within the day's limit. Beyond the limit a correction is PENDING_APPROVAL until the
 * office APPROVES or REJECTS it.
 */
export type CollectorReportStatus = 'ACCEPTED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface CollectorReport {
  id: string;
  date: string;
  collector_id: string;
  collector_name: string;
  /** 1 for the first report of the day, 2 for the next, ... */
  attempt: number;
  status: CollectorReportStatus;
  summary: CollectionDaySummary;
  /** Recorded in the app today, by payment way. */
  cash_in_app: number;
  upi_in_app: number;
  /** Counted by the collector. */
  cash_notes: Record<string, number>;
  coins: number;
  cash_counted: number;
  /** Counted cash + UPI. */
  grand_total: number;
  /** grand_total - collected: below zero is short, above zero is extra. */
  difference: number;
  note?: string;
  created_at: string;
  decided_by?: string;
  decided_at?: string;
  /** The office checked this report against the cash handed over. */
  verified_at?: string;
  verified_by?: string;
}

/** The report a collector's day stands on: the newest one that was not rejected. */
export function latestReport(reports: CollectorReport[], collectorId: string, date: string): CollectorReport | undefined {
  return reports
    .filter(r => r.collector_id === collectorId && r.date === date && r.status !== 'REJECTED')
    .sort((a, b) => b.attempt - a.attempt)[0];
}

/** Only the newest report in force can be verified; a correction is approved instead. */
export function canVerify(report: CollectorReport, reports: CollectorReport[]): boolean {
  return (report.status === 'ACCEPTED' || report.status === 'APPROVED') && !report.verified_at &&
    latestReport(reports, report.collector_id, report.date)?.id === report.id;
}

/**
 * Where each collector with work that day stands before the day can be closed: report not sent, a
 * correction waiting, collections changed after the report, report to verify, or ready.
 */
export type CloseState = 'not-sent' | 'correction-waiting' | 'changed' | 'to-verify' | 'ready';

export interface CollectorCloseCheck {
  collector_id: string;
  collector_name: string;
  state: CloseState;
  live: CollectionDaySummary;
  report?: CollectorReport;
}

export function dayCloseChecks(
  date: string,
  records: (DayRecordFigures & { collector_id: string; collector_name: string; payment_mode?: string })[],
  reports: CollectorReport[]
): CollectorCloseCheck[] {
  const ids = [...new Set(records.map(r => r.collector_id))];
  return ids.map(id => {
    const theirs = records.filter(r => r.collector_id === id);
    const live = collectionDaySummary(theirs);
    const split = dayPaymentSplit(theirs);
    const report = latestReport(reports, id, date);
    // A report no longer matches when the money, the payers, or how it was paid (cash or UPI) changed.
    const changed = !!report && (
      report.summary.collected !== live.collected ||
      report.summary.customersPaid !== live.customersPaid ||
      roundMoney(report.cash_in_app) !== split.cash ||
      roundMoney(report.upi_in_app) !== split.upi
    );
    const state: CloseState = !report
      ? 'not-sent'
      : report.status === 'PENDING_APPROVAL'
        ? 'correction-waiting'
        : changed
          ? 'changed'
          : !report.verified_at
            ? 'to-verify'
            : 'ready';
    return { collector_id: id, collector_name: theirs[0].collector_name, state, live, report };
  });
}

/** A collector's line in a closed day, as their verified report showed it. */
export interface DayClosingCollector {
  collector_id: string;
  collector_name: string;
  report_id: string;
  customers_assigned: number;
  customers_paid: number;
  expected: number;
  collected: number;
  /** Still to come that day. */
  balance: number;
  /** Customers more than one term behind, and how many of them did not pay that day. */
  long_pending: number;
  long_pending_unpaid: number;
  cash_in_app: number;
  upi_in_app: number;
  cash_counted: number;
  verified_by?: string;
}

export type DayClosingTotals = Omit<DayClosingCollector, 'collector_id' | 'collector_name' | 'report_id' | 'verified_by'>;

/** The office formally closed a day's business; no collection for that day changes until it is reopened. */
export interface DayClosing {
  id: string;
  date: string;
  closed_at: string;
  closed_by: string;
  collectors: DayClosingCollector[];
  totals: DayClosingTotals;
  note?: string;
  reopened_at?: string;
  reopened_by?: string;
}

export function closingTotals(lines: DayClosingCollector[]): DayClosingTotals {
  const sum = (key: keyof DayClosingTotals) => roundMoney(lines.reduce((s, l) => s + (l[key] ?? 0), 0));
  return {
    customers_assigned: sum('customers_assigned'),
    customers_paid: sum('customers_paid'),
    expected: sum('expected'),
    collected: sum('collected'),
    balance: sum('balance'),
    long_pending: sum('long_pending'),
    long_pending_unpaid: sum('long_pending_unpaid'),
    cash_in_app: sum('cash_in_app'),
    upi_in_app: sum('upi_in_app'),
    cash_counted: sum('cash_counted'),
  };
}

/** The closing in force for a date (a reopened closing no longer locks the day). */
export function activeClosing(closings: DayClosing[] | undefined, date: string): DayClosing | undefined {
  return (closings || []).find(c => c.date === date && !c.reopened_at);
}
