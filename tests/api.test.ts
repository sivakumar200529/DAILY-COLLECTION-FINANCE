// A day of business through the real server, on a throwaway copy of the sample data (KRS_DATA_DIR):
// issue a loan, hand note, collect (part, full, refused), edit, undo, pay off, reports, sign-in rules,
// and closing the day. After each step the loan's figures are checked against its payments.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addDaysIso, roundMoney, todayIso } from '../shared/finance.ts';
import { collectionDaySummary } from '../shared/collectorDay.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = todayIso();
let dir = '';
let server: ChildProcess | undefined;
let base = '';
let adminToken = '';
const adminPassword = crypto.randomBytes(9).toString('base64url');

function freePort(): Promise<number> {
  return new Promise(resolve => {
    const s = net.createServer().listen(0, () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => resolve(port));
    });
  });
}

async function call(method: string, url: string, body?: unknown, token = adminToken) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}
const get = (url: string, token?: string) => call('GET', url, undefined, token);
const post = (url: string, body?: unknown, token?: string) => call('POST', url, body ?? {}, token);
const put = (url: string, body: unknown, token?: string) => call('PUT', url, body, token);

async function ok(p: Promise<{ status: number; data: any }>, what: string) {
  const r = await p;
  assert.ok(r.status >= 200 && r.status < 300, `${what}: ${r.status} ${JSON.stringify(r.data)}`);
  return r.data;
}

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'krs-test-'));
  const data = JSON.parse(fs.readFileSync(path.join(root, 'data', 'sample_data.json'), 'utf8'));
  data.users.find((u: any) => u.username === 'admin').password = adminPassword;
  fs.writeFileSync(path.join(dir, 'krs_finance_data.json'), JSON.stringify(data));

  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), KRS_DATA_DIR: dir },
    stdio: 'ignore',
  });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + '/api/config')).ok) break;
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 200));
  }
  const login = await ok(post('/api/auth/login', { username: 'admin', password: adminPassword, role: 'ADMIN' }, ''), 'admin login');
  adminToken = login.token;
});

after(() => {
  server?.kill();
  fs.rmSync(dir, { recursive: true, force: true });
});

/** The loan's figures must always equal what its standing payments say. */
async function checkLoan(accId: string, expectedPaid: number) {
  const acc = await ok(get(`/api/collection-accounts/${accId}`), 'account');
  const payments = (await ok(get('/api/payments'), 'payments')).filter(
    (p: any) => p.collection_account_id === accId && p.status !== 'CANCELLED'
  );
  const paid = roundMoney(payments.reduce((s: number, p: any) => s + p.amount_paid, 0));
  assert.equal(paid, roundMoney(expectedPaid), 'payments total');
  assert.equal(acc.amount_collected, paid, 'collected = payments');
  assert.equal(acc.remaining_amount, roundMoney(acc.total_repayment - paid), 'balance = total - payments');
  // Every day record: paid that day = that day's payments; balance after it = total - paid up to then.
  const schedule = await ok(get(`/api/collection-accounts/${accId}/schedule`), 'schedule');
  for (const rec of schedule) {
    const upTo = payments.filter((p: any) => p.collection_date <= rec.date).reduce((s: number, p: any) => s + p.amount_paid, 0);
    const on = payments.filter((p: any) => p.collection_date === rec.date).reduce((s: number, p: any) => s + p.amount_paid, 0);
    assert.equal(rec.paid_amount, roundMoney(on), `paid on ${rec.date}`);
    assert.equal(rec.balance_remaining, Math.max(0, roundMoney(acc.total_repayment - upTo)), `balance after ${rec.date}`);
  }
  return { acc, payments };
}

test('a day of business, end to end', async () => {
  // ---- sign-in rules
  assert.equal((await get('/api/customers', '')).status, 401, 'no sign-in, no data');
  assert.equal((await post('/api/auth/login', { username: 'admin', password: 'wrong-password', role: 'ADMIN' }, '')).status, 401);

  // ---- a new customer with a loan that started five days ago
  const config = await ok(get('/api/config'), 'config');
  const product = config.loan_products.find((p: any) => p.status === 'ACTIVE');
  const collectors = await ok(get('/api/collectors'), 'collectors');
  const collector = collectors.find((c: any) => c.status === 'ACTIVE');
  const days = product.default_days;
  let amount = days * 100;
  if (product.min_amount > 0 && amount < product.min_amount) amount = product.min_amount;
  if (product.max_amount > 0 && amount > product.max_amount) amount = product.max_amount;
  const start = addDaysIso(T, -5);
  const created = await ok(post('/api/customers', {
    personal: { full_name: 'Test Customer', mobile_number: '9' + String(Date.now()).slice(-9) },
    address: { area: collector.assigned_area },
    business: { shop_name: 'Test Shop' },
    loan: { product_id: product.id, requested_amount: amount, start_date: start, assigned_collector_id: collector.id, collection_area: collector.assigned_area },
  }), 'create customer with loan');
  const accId = created.activeAccount.id;
  const d = created.activeAccount.daily_collection;
  const total = created.activeAccount.total_repayment;
  assert.ok(roundMoney(d * days) >= total, 'schedule covers the loan');
  await checkLoan(accId, 0);

  // ---- hand note: the first two days
  const hand = await ok(post(`/api/collection-accounts/${accId}/bulk-hand-note`, { day_numbers: [1, 2], collector_id: collector.id }), 'hand note');
  assert.equal(hand.count, 2);
  let paid = 2 * d;
  await checkLoan(accId, paid);
  assert.equal((await post(`/api/collection-accounts/${accId}/bulk-hand-note`, { day_numbers: [1] })).status, 400, 'day already paid');
  assert.equal((await post(`/api/collection-accounts/${accId}/bulk-hand-note`, { day_numbers: [days] })).status, 400, 'future day');

  // ---- collecting
  const collect = (date: string, amt: number, token?: string) =>
    post('/api/daily-collections/collect', { collection_account_id: accId, collection_date: date, amount_paid: amt, collector_id: collector.id, payment_mode: 'Cash' }, token);
  const part = await ok(collect(addDaysIso(T, -3), d / 2), 'part payment');
  paid += d / 2;
  assert.equal(part.dailyRecord.status, 'PARTIAL');
  assert.equal((await collect(addDaysIso(T, -3), d)).status, 409, 'one collection a day');
  assert.equal((await collect(addDaysIso(T, 1), d)).status, 400, 'no future dates');
  assert.equal((await collect(addDaysIso(start, -1), d)).status, 400, 'not before the loan started');
  assert.equal((await collect(T, total)).status, 400, 'not more than the balance');
  assert.equal((await collect(T, 0)).status, 400, 'an amount is needed');

  // Today: 2.5 terms paid, 5 days before today, so 3 terms pending; 3 x daily covers today and two of them.
  const todays = await ok(collect(T, 3 * d), 'today');
  paid += 3 * d;
  assert.equal(todays.dailyRecord.missed_days_count, 3);
  assert.equal(todays.dailyRecord.status, 'PAID');
  await checkLoan(accId, paid);

  // ---- editing the part payment to the full day changes today's figures too
  const payments = (await ok(get('/api/payments'), 'payments')).filter((p: any) => p.collection_account_id === accId);
  const partPay = payments.find((p: any) => p.collection_date === addDaysIso(T, -3) && p.status !== 'CANCELLED');
  await ok(put(`/api/payments/${partPay.id}`, { amount_paid: d }), 'edit payment');
  paid += d / 2;
  await checkLoan(accId, paid);
  const today1 = (await ok(get(`/api/daily-collections?date=${T}`), 'day list')).find((r: any) => r.collection_account_id === accId);
  assert.equal(today1.missed_days_count, 2, 'one more term paid before today');
  assert.equal(today1.status, 'PAID');
  assert.equal((await put(`/api/payments/${partPay.id}`, { collection_date: T })).status, 409, 'a day already paid');
  assert.equal((await put(`/api/payments/${partPay.id}`, { collection_date: addDaysIso(T, 2) })).status, 400, 'no future dates');

  // ---- a day marked "not paid", then paid late the same day (a back-dated collection between others)
  const missed = await ok(post('/api/daily-collections/collect', { collection_account_id: accId, collection_date: addDaysIso(T, -2), is_missed: true, reason: 'Shop closed', collector_id: collector.id }), 'mark not paid');
  assert.equal(missed.dailyRecord.status, 'MISSED');
  assert.equal(missed.receipt, null);
  await checkLoan(accId, paid);
  const late = await ok(collect(addDaysIso(T, -2), d), 'collect a day marked not paid');
  paid += d;
  assert.equal(late.dailyRecord.status, 'PAID');
  await checkLoan(accId, paid);

  // ---- hand note over an existing day replaces it (the old receipt is cancelled)
  const oldDay1 = (await ok(get('/api/payments'), 'payments')).find((p: any) => p.collection_account_id === accId && p.collection_date === start && p.status !== 'CANCELLED');
  await ok(post(`/api/collection-accounts/${accId}/bulk-hand-note`, { day_numbers: [1], daily_amount: 2 * d, overwrite_existing: true, collector_id: collector.id }), 'hand note overwrite');
  paid += d;
  await checkLoan(accId, paid);
  const receipts = await ok(get('/api/receipts'), 'receipts');
  assert.equal(receipts.find((r: any) => r.receipt_number === oldDay1.receipt_number).status, 'CANCELLED', 'replaced receipt is cancelled');

  // ---- undo today's payment
  await ok(post(`/api/payments/${todays.receipt.payment_id}/undo`), 'undo');
  paid -= 3 * d;
  const after = await checkLoan(accId, paid);
  const today2 = (await ok(get(`/api/daily-collections?date=${T}`), 'day list')).find((r: any) => r.collection_account_id === accId);
  assert.equal(today2.paid_amount, 0);
  assert.equal(today2.status, 'PENDING');

  // ---- paying it off completes the loan; nothing more can be collected; undo reopens it
  const payoff = await ok(collect(T, after.acc.remaining_amount), 'pay off');
  let acc = (await checkLoan(accId, total)).acc;
  assert.equal(acc.status, 'COMPLETED');
  assert.equal(acc.actual_completion_date, T);
  assert.equal(acc.completed_days, days);
  assert.equal((await post(`/api/collection-accounts/${accId}/bulk-hand-note`, { day_numbers: [4] })).status, 400, 'nothing more to pay');
  await ok(post(`/api/payments/${payoff.receipt.payment_id}/undo`), 'undo pay off');
  acc = (await checkLoan(accId, paid)).acc;
  assert.equal(acc.status, 'ACTIVE');
  assert.equal(acc.actual_completion_date, undefined);
  await ok(collect(T, d), 'collect again');
  paid += d;
  await checkLoan(accId, paid);

  // ---- reports agree with each other and with the payments
  const stats = await ok(get('/api/dashboard/stats'), 'stats');
  const dayList = await ok(get(`/api/daily-collections?date=${T}`), 'day list');
  const day = collectionDaySummary(dayList);
  assert.equal(stats.todayExpected, day.expected, 'Home today expected = day list');
  assert.equal(stats.todayCollected, day.collected, 'Home today collected = day list');
  const allPayments = (await ok(get('/api/payments'), 'payments')).filter((p: any) => p.status !== 'CANCELLED');
  for (const month of [...new Set([start.slice(0, 7), T.slice(0, 7)])]) {
    const [y, m] = month.split('-').map(Number);
    const report = await ok(get(`/api/reports/monthly?month=${m}&year=${y}`), 'monthly report');
    const row = report.rows.find((r: any) => r.collectionAccountId === accId);
    const inMonth = allPayments.filter((p: any) => p.collection_account_id === accId && p.collection_date.startsWith(month));
    const cells = Object.values(row.dailyCollections as Record<string, number>).reduce((s, v) => s + v, 0);
    assert.equal(roundMoney(cells), roundMoney(inMonth.reduce((s: number, p: any) => s + p.amount_paid, 0)), `${month}: cells = payments`);
    assert.equal(row.actualMonthlyCollection, roundMoney(cells));
    assert.equal(row.monthlyPending, Math.max(0, roundMoney(row.expectedMonthlyCollection - row.actualMonthlyCollection)));
    const monthAll = allPayments.filter((p: any) => p.collection_date.startsWith(month)).reduce((s: number, p: any) => s + p.amount_paid, 0);
    assert.equal(report.totals.actualMonthly, roundMoney(monthAll), `${month}: register total = all payments`);
    if (month === T.slice(0, 7)) {
      assert.equal(stats.monthExpected, report.totals.expectedMonthly, 'Home month expected = register');
      assert.equal(stats.monthCollected, report.totals.actualMonthly, 'Home month collected = register');
    }
  }

  // ---- a collector sees and does only their own work
  const users = await ok(get('/api/users'), 'users');
  const colUser = users.find((u: any) => u.collector_id === collector.id);
  const cred = await ok(get(`/api/users/${colUser.id}/credentials`), 'credentials');
  const colToken = (await ok(post('/api/auth/login', { username: cred.username, password: cred.password, role: 'COLLECTOR' }, ''), 'collector login')).token;
  assert.equal((await get('/api/users', colToken)).status, 403, 'collector cannot list logins');
  assert.equal((await put(`/api/payments/${partPay.id}`, { amount_paid: 1 }, colToken)).status, 403, 'collector cannot edit payments');
  const other = dayList.find((r: any) => r.collector_id !== collector.id && r.paid_amount === 0);
  if (other) {
    const r = await post('/api/daily-collections/collect', { collection_account_id: other.collection_account_id, amount_paid: 1, collector_id: collector.id }, colToken);
    assert.equal(r.status, 403, "not on the collector's list");
  }

  // ---- closing the day: every collector reports, the office verifies, then the day is locked
  await ok(post('/api/daily-collections/assign', { changes: [] }), 'assign');
  const working = [...new Set((await ok(get(`/api/daily-collections?date=${T}`), 'day list')).map((r: any) => r.collector_id))];
  for (const id of working) {
    const report = await ok(post('/api/collector-reports', { collector_id: id, cash_notes: {}, coins: 0 }), 'report');
    await ok(post(`/api/collector-reports/${report.id}/verify`), 'verify');
  }
  const closing = await ok(post('/api/day-closings'), 'close the day');
  assert.equal(closing.totals.collected, day.collected, 'closing = day list');
  assert.equal((await collect(T, d)).status, 400, 'closed day: no collection');
  const lastPay = (await ok(get('/api/payments'), 'payments')).find((p: any) => p.collection_account_id === accId && p.collection_date === T && p.status !== 'CANCELLED');
  assert.equal((await post(`/api/payments/${lastPay.id}/undo`)).status, 400, 'closed day: no undo');
  assert.equal((await put(`/api/payments/${lastPay.id}`, { amount_paid: d / 2 })).status, 400, 'closed day: no edit');
  await ok(post(`/api/day-closings/${closing.id}/reopen`), 'reopen');
  await ok(post(`/api/payments/${lastPay.id}/undo`), 'undo after reopening');
  await checkLoan(accId, paid - d);
});

test('office records and the customer portal', async () => {
  const collectors = await ok(get('/api/collectors'), 'collectors');
  const col = collectors.find((c: any) => c.status === 'ACTIVE');
  const config = await ok(get('/api/config'), 'config');
  const product = config.loan_products.find((p: any) => p.status === 'ACTIVE');
  let amount = product.default_days * 100;
  if (product.min_amount > 0 && amount < product.min_amount) amount = product.min_amount;
  if (product.max_amount > 0 && amount > product.max_amount) amount = product.max_amount;
  const mobile = '8' + String(Date.now()).slice(-9);
  const loan = { product_id: product.id, requested_amount: amount, assigned_collector_id: col.id, collection_area: col.assigned_area };
  const cust = await ok(post('/api/customers', { personal: { full_name: 'Second Customer', mobile_number: mobile }, business: { shop_name: 'Old Shop' }, loan }), 'create');

  // ---- one customer per mobile number; one running loan per customer
  assert.equal((await post('/api/customers', { personal: { full_name: 'Copy', mobile_number: '+91 ' + mobile } })).status, 400, 'same mobile');
  assert.equal((await post('/api/collection-accounts', { customer_id: cust.id, ...loan })).status, 400, 'second running loan');

  // ---- editing a customer: its own keys never change; the name reaches the loan
  await ok(put(`/api/customers/${cust.id}`, { personal: { id: 'HACKED', full_name: 'Renamed Customer' }, business: { shop_name: 'New Shop' } }), 'edit');
  const acc = await ok(get(`/api/collection-accounts/${cust.activeAccount.id}`), 'account');
  assert.equal(acc.customer_id, cust.id);
  assert.equal(acc.customer_name, 'Renamed Customer');
  assert.equal(acc.shop_name, 'New Shop');
  assert.equal((await put(`/api/customers/${cust.id}`, { business: { default_margin_percentage: 150 } })).status, 400, 'margin range');

  // ---- editing a collector: the login password never lands on the collector record
  await ok(put(`/api/collectors/${col.id}`, { name: col.name, password: 'not-stored-here', id: 'HACKED' }), 'edit collector');
  const after = (await ok(get('/api/collectors'), 'collectors')).find((c: any) => c.id === col.id);
  assert.ok(after, 'collector keeps its id');
  assert.equal(after.password, undefined);
  const other = collectors.find((c: any) => c.id !== col.id);
  if (other) assert.equal((await put(`/api/collectors/${col.id}`, { mobile: other.mobile })).status, 400, 'same mobile');

  // ---- the customer portal: own data only, sensible requests
  const users = await ok(get('/api/users'), 'users');
  const login = users.find((u: any) => u.customer_id === cust.id);
  const cred = await ok(get(`/api/users/${login.id}/credentials`), 'credentials');
  const token = (await ok(post('/api/auth/login', { username: cred.username, password: cred.password, role: 'CUSTOMER' }, ''), 'customer login')).token;
  const someoneElse = (await ok(get('/api/customers'), 'customers')).find((c: any) => c.id !== cust.id);
  assert.equal((await get(`/api/customers/${someoneElse.id}/360`, token)).status, 403, 'not another customer');
  assert.equal((await get('/api/payments', token)).status, 403, 'not the payments list');
  assert.equal((await post('/api/customer/loan-request', { requested_amount: -5 }, token)).status, 400, 'bad amount');
  await ok(post('/api/customer/loan-request', { requested_amount: 5000 }, token), 'loan request');
  assert.equal((await post('/api/customer/loan-request', { requested_amount: 5000 }, token)).status, 400, 'one request at a time');
  const notes = await ok(get('/api/notifications?role=ADMIN', token), 'notifications');
  assert.ok(notes.every((n: any) => n.recipient_role === 'CUSTOMER' && n.customer_id === cust.id), 'only own notifications');
});
