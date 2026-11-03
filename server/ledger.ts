// The one place where a loan's money is worked out from its payments. Collecting, the hand note,
// editing and undoing a payment all change payments and then call `syncLoan`, so a loan's totals,
// its status and its day records can never disagree with the payments behind them.
import type { CollectionAccount, DailyCollectionRecord, KRSFinanceDatabase, PaymentTransaction } from './db.ts';
import { roundMoney, termProgress, todayIso } from '../shared/finance.ts';

type Db = Pick<KRSFinanceDatabase, 'payments' | 'receipts' | 'daily_collections' | 'customers'>;

export const isActivePayment = (p: PaymentTransaction) => p.status !== 'CANCELLED';
export const isRunning = (acc: Pick<CollectionAccount, 'status'>) => acc.status === 'ACTIVE' || acc.status === 'OVERDUE';

export function activePayments(db: Db, accountId: string): PaymentTransaction[] {
  return db.payments.filter(p => p.collection_account_id === accountId && isActivePayment(p));
}

const sum = (list: PaymentTransaction[]) => roundMoney(list.reduce((s, p) => s + p.amount_paid, 0));

/** A loan's position on a date: what was owed that morning and what was paid that day. */
export interface DayPosition {
  /** Paid before the day. */
  paidBefore: number;
  /** Paid on the day. */
  paidOn: number;
  /** Balance at the start of the day. */
  morningBalance: number;
  /** Balance after the day's payments. */
  balanceAfter: number;
  /** Terms pending before the day, from the money paid before it. */
  missedDays: number;
  missedAmount: number;
  /** The day's amount: the daily payment, or the balance if that is smaller. */
  due: number;
}

export function dayPosition(
  db: Db,
  acc: CollectionAccount,
  date: string,
  payments: PaymentTransaction[] = activePayments(db, acc.id)
): DayPosition {
  const paidBefore = sum(payments.filter(p => p.collection_date < date));
  const paidOn = sum(payments.filter(p => p.collection_date === date));
  const morningBalance = Math.max(0, roundMoney(acc.total_repayment - paidBefore));
  const missedDays = termProgress({ ...acc, amount_collected: paidBefore }, date).missed;
  return {
    paidBefore,
    paidOn,
    morningBalance,
    balanceAfter: Math.max(0, roundMoney(morningBalance - paidOn)),
    missedDays,
    missedAmount: Math.min(morningBalance, roundMoney(missedDays * acc.daily_collection)),
    due: Math.min(acc.daily_collection, morningBalance),
  };
}

/**
 * How a day's payment stands against that day: short of the day's amount (PARTIAL), the day's amount
 * plus any pending terms (PAID), or beyond what was pending (ADVANCE, with the extra).
 */
export function payStanding(paid: number, pos: Pick<DayPosition, 'due' | 'missedAmount'>) {
  if (paid <= 0) return { status: 'PENDING' as const, pending: pos.due, advance: 0 };
  if (paid < pos.due) return { status: 'PARTIAL' as const, pending: roundMoney(pos.due - paid), advance: 0 };
  const advance = Math.max(0, roundMoney(paid - pos.due - pos.missedAmount));
  return { status: advance > 0 ? ('ADVANCE' as const) : ('PAID' as const), pending: 0, advance };
}

/**
 * The loan's status from its money: paid off (COMPLETED, on the date of its last payment), past its
 * end date and still owing (OVERDUE), or ACTIVE. Cancelled loans stay cancelled.
 */
export function settleStatus(db: Db, acc: CollectionAccount, today: string = todayIso()) {
  if (acc.status === 'CANCELLED') return;
  if (acc.remaining_amount <= 0) {
    acc.status = 'COMPLETED';
    const last = activePayments(db, acc.id).map(p => p.collection_date).sort().pop();
    acc.actual_completion_date = last || today;
    return;
  }
  delete acc.actual_completion_date;
  acc.status = today > acc.expected_end_date ? 'OVERDUE' : 'ACTIVE';
}

/** The loan's totals worked out again from its payments. */
export function recountLoan(db: Db, acc: CollectionAccount, today: string = todayIso()) {
  acc.amount_collected = sum(activePayments(db, acc.id));
  acc.remaining_amount = Math.max(0, roundMoney(acc.total_repayment - acc.amount_collected));
  acc.completed_days = termProgress(acc).completed;
  acc.remaining_days = Math.max(0, acc.collection_days - acc.completed_days);
  acc.collection_percentage = acc.total_repayment > 0 ? roundMoney((acc.amount_collected / acc.total_repayment) * 100, 1) : 0;
  acc.updated_at = new Date().toISOString();
  settleStatus(db, acc, today);
}

/**
 * The day record of a loan on a date, rebuilt from that day's payments: paid amount, standing,
 * balance after the day, way of payment, collector and receipt of the latest payment. A day marked
 * "Not paid" keeps that mark while nothing is paid.
 */
export function syncDayRecord(
  db: Db,
  acc: CollectionAccount,
  date: string,
  payments: PaymentTransaction[] = activePayments(db, acc.id),
  existing?: DailyCollectionRecord
): DailyCollectionRecord | undefined {
  const pos = dayPosition(db, acc, date, payments);
  const dayPayments = payments
    .filter(p => p.collection_date === date)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  let rec = existing || db.daily_collections.find(d => d.collection_account_id === acc.id && d.date === date);
  if (!rec && dayPayments.length === 0) return undefined;
  if (!rec) {
    rec = {
      id: `DC-${date}-${acc.id}`,
      collection_account_id: acc.id,
      customer_id: acc.customer_id,
      customer_name: acc.customer_name,
      shop_name: acc.shop_name || '',
      mobile_number: db.customers.find(c => c.id === acc.customer_id)?.mobile_number || '',
      date,
      daily_due: acc.daily_collection,
      paid_amount: 0,
      pending_amount: 0,
      advance_amount: 0,
      status: 'PENDING',
      collector_id: acc.assigned_collector_id,
      collector_name: acc.assigned_collector_name,
      collection_area: acc.collection_area,
      balance_remaining: 0,
    };
    db.daily_collections.push(rec);
  }

  const standing = payStanding(pos.paidOn, pos);
  const latest = dayPayments[dayPayments.length - 1];
  rec.daily_due = acc.daily_collection;
  rec.paid_amount = pos.paidOn;
  rec.pending_amount = standing.pending;
  rec.advance_amount = standing.advance;
  rec.status = pos.paidOn > 0 ? standing.status : rec.status === 'MISSED' ? 'MISSED' : 'PENDING';
  rec.balance_remaining = pos.balanceAfter;
  rec.missed_days_count = pos.missedDays;
  rec.missed_amount = pos.missedAmount;
  if (latest) {
    rec.payment_mode = latest.payment_mode;
    rec.collector_id = latest.collector_id;
    rec.collector_name = latest.collector_name;
    rec.receipt_number = latest.receipt_number;
    rec.receipt_id = db.receipts.find(r => r.receipt_number === latest.receipt_number)?.id;
  } else {
    rec.payment_mode = undefined;
    rec.receipt_id = undefined;
    rec.receipt_number = undefined;
  }
  return rec;
}

/** Every loan worked out again from its payments (on start-up and after data is replaced). */
export function reconcileAll(db: Db & Pick<KRSFinanceDatabase, 'collection_accounts'>, today: string = todayIso()) {
  for (const acc of db.collection_accounts) {
    if (acc.status !== 'CANCELLED') syncLoan(db, acc, [acc.start_date], today);
  }
}

/**
 * After any change to a loan's payments: its totals and status, then the day records of the changed
 * dates and of every later date (their morning balance and pending terms depend on earlier days).
 */
export function syncLoan(db: Db, acc: CollectionAccount, changedDates: string[], today: string = todayIso()) {
  recountLoan(db, acc, today);
  const from = [...changedDates].sort()[0];
  if (!from) return;
  // The loan's payments and day records are picked out once, not once per day.
  const payments = activePayments(db, acc.id);
  const records = new Map<string, DailyCollectionRecord>();
  for (const d of db.daily_collections) if (d.collection_account_id === acc.id && d.date >= from) records.set(d.date, d);
  const dates = new Set([...changedDates, ...records.keys()]);
  for (const date of [...dates].sort()) syncDayRecord(db, acc, date, payments, records.get(date));
}
