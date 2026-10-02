import { DailyCollectionRecord } from '../../types';

export type CollectTab = 'todo' | 'paid' | 'not-paid' | 'all';

/** Where a customer's day stands: still to visit, paid (fully or partly), or marked not paid. */
export function dayState(record: DailyCollectionRecord): Exclude<CollectTab, 'all'> {
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
