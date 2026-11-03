// The money rules on their own: loan terms, terms pending, the month's expected amount, a day's
// figures, and the ledger that keeps a loan's totals, status and day records in step with its payments.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysIso,
  calculateLoan,
  evaluateLoan,
  monthDueDays,
  monthExpected,
  roundMoney,
  scheduleDates,
  termProgress,
} from '../shared/finance.ts';
import type { LoanProduct } from '../shared/config.ts';
import { collectionDaySummary, dayCloseChecks, dayPaymentSplit, type CollectorReport } from '../shared/collectorDay.ts';
import { dayPosition, payStanding, syncLoan } from '../server/ledger.ts';
import type { CollectionAccount, PaymentTransaction } from '../server/db.ts';

const product: LoanProduct = {
  id: 'P1',
  name: 'Test plan',
  margin_percentage: 10,
  day_options: [30, 100],
  default_days: 30,
  min_amount: 1000,
  max_amount: 100000,
  allow_overrides: true,
  status: 'ACTIVE',
  created_at: '2026-01-01T00:00:00.000Z',
};

test('loan terms: margin taken up front, daily amount rounded up so the schedule covers the loan', () => {
  const loan = calculateLoan({ requested_amount: 10000, margin_percentage: 12, collection_days: 30, start_date: '2026-11-01' });
  assert.equal(loan.margin_amount, 1200);
  assert.equal(loan.disbursed_amount, 8800);
  assert.equal(loan.total_repayment, 10000);
  assert.equal(loan.daily_collection, 333.34);
  assert.ok(roundMoney(loan.daily_collection * loan.collection_days) >= loan.total_repayment);
  assert.equal(loan.expected_end_date, '2026-11-30');
  assert.equal(scheduleDates('2026-11-01', 30).length, 30);
});

test('loan terms: a daily amount that cannot repay the loan is refused', () => {
  const low = evaluateLoan(product, { requested_amount: 10000, margin_percentage: 10, collection_days: 30, daily_collection: 300, start_date: '2026-11-01' });
  assert.ok(low.issues.some(i => i.code === 'DAILY_TOO_LOW'));
  const ok = evaluateLoan(product, { requested_amount: 10000, margin_percentage: 10, collection_days: 30, start_date: '2026-11-01' });
  assert.deepEqual(ok.issues, []);
  const strict = evaluateLoan({ ...product, allow_overrides: false }, { requested_amount: 10000, margin_percentage: 5, collection_days: 30, start_date: '2026-11-01' });
  assert.ok(strict.issues.some(i => i.code === 'OVERRIDES_NOT_ALLOWED'));
});

test('terms pending: counted from money, today never missed', () => {
  const acc = { collection_days: 10, daily_collection: 100, amount_collected: 250, start_date: '2026-11-01', total_repayment: 1000 };
  const p = termProgress(acc, '2026-11-06'); // 5 days before today
  assert.equal(p.completed, 2);
  assert.equal(p.missed, 3);
  assert.equal(termProgress({ ...acc, amount_collected: 700 }, '2026-11-03').advance, 4);
  assert.equal(termProgress(acc, '2026-11-01').missed, 0);
});

test('terms pending: a loan paid in full has every term done, even with a smaller last day', () => {
  const acc = { collection_days: 30, daily_collection: 333.34, amount_collected: 10000, start_date: '2026-09-01', total_repayment: 10000 };
  const p = termProgress(acc, '2026-11-03');
  assert.equal(p.completed, 30);
  assert.equal(p.missed, 0);
});

test("month's expected amount", () => {
  const loan = { daily_collection: 100, total_repayment: 3000, start_date: '2026-11-11', status: 'ACTIVE' };
  // Starts on the 11th: 20 days of November.
  assert.equal(monthDueDays(loan, '2026-11'), 20);
  assert.equal(monthExpected(loan, 0, 0, '2026-11'), 2000);
  // Not started yet in October.
  assert.equal(monthExpected(loan, 0, 0, '2026-10'), 0);
  // Owing only 500 at the start of the month: no more than that is expected.
  assert.equal(monthExpected({ ...loan, start_date: '2026-09-01', status: 'OVERDUE' }, 2500, 0, '2026-11'), 500);
  // Paid more than the month asked for: the month expected what was paid.
  assert.equal(monthExpected(loan, 0, 2600, '2026-11'), 2600);
  // Paid off on the 15th: only days up to then.
  assert.equal(monthDueDays({ ...loan, start_date: '2026-10-01', status: 'COMPLETED', actual_completion_date: '2026-11-15' }, '2026-11'), 15);
  assert.equal(monthExpected({ ...loan, status: 'CANCELLED' }, 0, 0, '2026-11'), 0);
});

test("a day's figures are rounded to the paisa and split by cash and UPI", () => {
  const records = [
    { daily_due: 0.1, balance_remaining: 10, paid_amount: 0.1, payment_mode: 'Cash' },
    { daily_due: 0.2, balance_remaining: 10, paid_amount: 0.2, payment_mode: 'UPI' },
    { daily_due: 100, balance_remaining: 30, paid_amount: 0 },
  ];
  const s = collectionDaySummary(records);
  assert.equal(s.expected, 30.3); // the last one owes only its balance
  assert.equal(s.collected, 0.3);
  assert.equal(s.pendingAmount, 30);
  assert.deepEqual(dayPaymentSplit(records), { payments: 2, cash: 0.1, upi: 0.2 });
});

test('closing check: a report goes stale when the cash/UPI split changes', () => {
  const records = [
    { daily_due: 100, balance_remaining: 900, paid_amount: 100, payment_mode: 'Cash', collector_id: 'C1', collector_name: 'A' },
  ];
  const summary = collectionDaySummary(records);
  const report: CollectorReport = {
    id: 'R1', date: '2026-11-03', collector_id: 'C1', collector_name: 'A', attempt: 1, status: 'ACCEPTED', summary,
    cash_in_app: 100, upi_in_app: 0, cash_notes: {}, coins: 0, cash_counted: 100, grand_total: 100, difference: 0,
    created_at: '2026-11-03T10:00:00.000Z', verified_at: '2026-11-03T11:00:00.000Z',
  };
  assert.equal(dayCloseChecks('2026-11-03', records, [report])[0].state, 'ready');
  const nowUpi = [{ ...records[0], payment_mode: 'UPI' }];
  assert.equal(dayCloseChecks('2026-11-03', nowUpi, [report])[0].state, 'changed');
});

// ---- ledger ----------------------------------------------------------------------------------

function ledgerDb(start: string, days = 10, daily = 100) {
  const acc = {
    id: 'ACC1', customer_id: 'CU1', customer_name: 'Test', shop_name: 'Shop',
    daily_collection: daily, collection_days: days, total_repayment: daily * days,
    start_date: start, expected_end_date: addDaysIso(start, days - 1),
    amount_collected: 0, remaining_amount: daily * days, completed_days: 0, remaining_days: days, collection_percentage: 0,
    assigned_collector_id: 'C1', assigned_collector_name: 'A', collection_area: 'Area', status: 'ACTIVE',
  } as unknown as CollectionAccount;
  const db = {
    payments: [] as PaymentTransaction[],
    receipts: [] as any[],
    daily_collections: scheduleDates(start, days).map(date => ({
      id: `DC-${date}`, collection_account_id: 'ACC1', customer_id: 'CU1', customer_name: 'Test', shop_name: 'Shop',
      mobile_number: '', date, daily_due: daily, paid_amount: 0, pending_amount: daily, advance_amount: 0,
      status: 'PENDING', collector_id: 'C1', collector_name: 'A', collection_area: 'Area', balance_remaining: daily * days,
    })) as any[],
    customers: [] as any[],
  };
  let n = 0;
  const pay = (date: string, amount: number) => {
    n++;
    db.payments.push({
      id: `P${n}`, receipt_number: `R${n}`, collection_account_id: 'ACC1', customer_id: 'CU1', customer_name: 'Test',
      shop_name: 'Shop', collection_date: date, daily_due: daily, amount_paid: amount, advance_amount: 0,
      payment_mode: 'Cash', collector_id: 'C1', collector_name: 'A', previous_balance: 0, remaining_balance: 0,
      status: 'SUCCESS', created_at: `${date}T10:00:00.000Z`,
    } as PaymentTransaction);
    syncLoan(db, acc, [date], '2026-11-20');
    return db.payments[db.payments.length - 1];
  };
  const day = (date: string) => db.daily_collections.find(d => d.date === date)!;
  return { db, acc, pay, day };
}

test('ledger: how a payment stands against its day', () => {
  // 100 a day; two days missed (200) before the day.
  const pos = { due: 100, missedAmount: 200 };
  assert.equal(payStanding(50, pos).status, 'PARTIAL');
  assert.equal(payStanding(50, pos).pending, 50);
  assert.equal(payStanding(100, pos).status, 'PAID');
  assert.equal(payStanding(300, pos).status, 'PAID'); // clears the missed days
  assert.deepEqual(payStanding(350, pos), { status: 'ADVANCE', pending: 0, advance: 50 });
  assert.equal(payStanding(0, pos).status, 'PENDING');
});

test('ledger: totals, day records and later days follow every change', () => {
  const { db, acc, pay, day } = ledgerDb('2026-11-01');
  pay('2026-11-01', 100);
  const second = pay('2026-11-02', 50);
  pay('2026-11-04', 300);
  assert.equal(acc.amount_collected, 450);
  assert.equal(acc.remaining_amount, 550);
  assert.equal(acc.completed_days, 4);
  assert.equal(day('2026-11-02').status, 'PARTIAL');
  assert.equal(day('2026-11-02').pending_amount, 50);
  // On the 4th: 150 paid before (1 term), 3 days before it, so 2 terms pending that morning;
  // 300 covers the day and those two.
  assert.equal(day('2026-11-04').missed_days_count, 2);
  assert.equal(day('2026-11-04').balance_remaining, 550);
  assert.equal(day('2026-11-04').status, 'PAID');
  assert.equal(day('2026-11-04').advance_amount, 0);

  // Editing the 2nd's payment changes the later days too: one term pending now, so 100 is extra.
  second.amount_paid = 100;
  syncLoan(db, acc, ['2026-11-02'], '2026-11-20');
  assert.equal(day('2026-11-02').status, 'PAID');
  assert.equal(day('2026-11-04').missed_days_count, 1);
  assert.equal(day('2026-11-04').status, 'ADVANCE');
  assert.equal(day('2026-11-04').advance_amount, 100);
  assert.equal(day('2026-11-04').balance_remaining, 500);
  assert.equal(day('2026-11-10').balance_remaining, 500);
  assert.equal(dayPosition(db, acc, '2026-11-05').morningBalance, 500);

  // Undoing it.
  second.status = 'CANCELLED';
  syncLoan(db, acc, ['2026-11-02'], '2026-11-20');
  assert.equal(acc.amount_collected, 400);
  assert.equal(day('2026-11-02').paid_amount, 0);
  assert.equal(day('2026-11-02').status, 'PENDING');
});

test('ledger: paid off becomes COMPLETED on the last payment day; undoing it reopens the loan', () => {
  const { db, acc, pay } = ledgerDb('2026-11-01', 5);
  pay('2026-11-01', 200);
  const last = pay('2026-11-03', 300);
  assert.equal(acc.status, 'COMPLETED');
  assert.equal(acc.actual_completion_date, '2026-11-03');
  assert.equal(acc.completed_days, 5);
  last.status = 'CANCELLED';
  syncLoan(db, acc, ['2026-11-03'], '2026-11-20');
  // Past its end date (5th) and still owing.
  assert.equal(acc.status, 'OVERDUE');
  assert.equal(acc.actual_completion_date, undefined);
  syncLoan(db, acc, [], '2026-11-04');
  assert.equal(acc.status, 'ACTIVE');
});
