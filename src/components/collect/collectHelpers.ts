import { DailyCollectionRecord } from '../../types';

/** Where a customer's day stands: still to visit, paid (fully or partly), or marked not paid. */
export function dayState(record: DailyCollectionRecord): 'todo' | 'paid' | 'not-paid' {
  if (record.paid_amount > 0) return 'paid';
  if (record.status === 'MISSED') return 'not-paid';
  return 'todo';
}

/** The one-tap amount: today's payment, or the balance if that is smaller. */
export function quickAmount(record: DailyCollectionRecord): number {
  return Math.min(record.daily_due, record.balance_remaining);
}

/** Today's payment plus the days already missed, never more than the balance. */
export function withMissedAmount(record: DailyCollectionRecord): number {
  return Math.min(record.daily_due + (record.missed_amount || 0), record.balance_remaining);
}

/**
 * Terms still pending after today's payment. The day record keeps the morning's count; money paid
 * beyond today's amount clears missed terms, and a loan paid off has none left.
 */
export function pendingTermsNow(record: DailyCollectionRecord): number {
  const morning = record.missed_days_count || 0;
  if (record.paid_amount <= 0 || morning === 0) return morning;
  if (record.balance_remaining <= 0) return 0;
  const daily = record.daily_due || 0;
  if (daily <= 0) return morning;
  const cleared = Math.floor(Math.max(0, record.paid_amount - daily) / daily + 1e-9);
  return Math.max(0, morning - cleared);
}

export function matchesSearch(record: DailyCollectionRecord, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, '');
  return (
    record.customer_name.toLowerCase().includes(q) ||
    record.shop_name.toLowerCase().includes(q) ||
    record.customer_id.toLowerCase().includes(q) ||
    (digits.length >= 3 && record.mobile_number.replace(/\D/g, '').includes(digits))
  );
}
