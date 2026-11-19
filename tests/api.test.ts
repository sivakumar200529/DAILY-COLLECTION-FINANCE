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

test('notebook entry: many days at once, all checked before anything is saved', async () => {
  const collectors = await ok(get('/api/collectors'), 'collectors');
  const col = collectors.find((c: any) => c.status === 'ACTIVE');
  const config = await ok(get('/api/config'), 'config');
  const product = config.loan_products.find((p: any) => p.status === 'ACTIVE');
  let amount = product.default_days * 100;
  if (product.min_amount > 0 && amount < product.min_amount) amount = product.min_amount;
  if (product.max_amount > 0 && amount > product.max_amount) amount = product.max_amount;
  const start = addDaysIso(T, -6);
  const cust = await ok(post('/api/customers', {
    personal: { full_name: 'Notebook Customer', mobile_number: '7' + String(Date.now()).slice(-9) },
    loan: { product_id: product.id, requested_amount: amount, start_date: start, assigned_collector_id: col.id, collection_area: col.assigned_area },
  }), 'create');
  const accId = cust.activeAccount.id;
  const d = cust.activeAccount.daily_collection;
  const total = cust.activeAccount.total_repayment;
  const day = (n: number) => addDaysIso(start, n);

  const page = await ok(get(`/api/notebook?from=${start}&to=${T}&collector=${col.id}`), 'notebook');
  assert.ok(page.rows.some((r: any) => r.account_id === accId), 'the new loan is a row');
  assert.equal((await get(`/api/notebook?from=${T}&to=${start}`)).status, 400, 'dates the wrong way round');

  // Four days typed.
  const first = await ok(post('/api/notebook', { changes: [0, 1, 2, 3].map(n => ({ account_id: accId, date: day(n), amount: d })) }), 'save');
  assert.equal(first.saved, 4);
  await checkLoan(accId, 4 * d);

  // Change one, clear one, add one; plus one wrong cell (a future day): nothing at all is saved.
  const mixed = [
    { account_id: accId, date: day(1), amount: 2 * d },
    { account_id: accId, date: day(2), amount: 0 },
    { account_id: accId, date: day(4), amount: d },
  ];
  const refused = await post('/api/notebook', { changes: [...mixed, { account_id: accId, date: addDaysIso(T, 1), amount: d }] });
  assert.equal(refused.status, 400);
  assert.equal(refused.data.errors.length, 1, 'the wrong cell is named');
  await checkLoan(accId, 4 * d);
  assert.equal((await post('/api/notebook', { changes: [{ account_id: accId, date: day(5), amount: total }] })).status, 400, 'more than the loan owes');

  await ok(post('/api/notebook', { changes: mixed }), 'save mixed');
  await checkLoan(accId, 5 * d);
  const after = await ok(get(`/api/notebook?from=${start}&to=${T}`), 'notebook');
  const row = after.rows.find((r: any) => r.account_id === accId);
  assert.equal(row.cells[day(1)].amount, 2 * d);
  assert.equal(row.cells[day(2)], undefined, 'cleared day has no payment');
  assert.equal(row.balance, roundMoney(total - 5 * d));
});

test('notebook card: the card makes the sheet; customers, loans and past payments are added together', async () => {
  const collectors = await ok(get('/api/collectors'), 'collectors');
  const col = collectors.find((c: any) => c.status === 'ACTIVE');
  const config = await ok(get('/api/config'), 'config');
  const product = config.loan_products.find((p: any) => p.status === 'ACTIVE' && p.allow_overrides);
  const start = addDaysIso(T, -9);
  const end = addDaysIso(start, 99); // 100 days, as on the card
  const daily = 200;
  const total = 20000;
  const card = { product_id: product.id, start_date: start, end_date: end, total, daily };
  const day = (n: number) => addDaysIso(start, n);
  const stamp = String(Date.now()).slice(-8);

  // A customer already in the app, without a loan.
  const existing = await ok(post('/api/customers', {
    personal: { full_name: 'Card Existing', mobile_number: '66' + stamp },
    address: { area: col.assigned_area },
  }), 'existing customer');
  const newRow = {
    name: 'Card New', mobile: '65' + stamp, area: col.assigned_area,
    payments: Object.fromEntries([0, 1, 2, 3, 4].map(n => [day(n), daily])),
  };
  const existingRow = {
    customer_id: existing.id, name: existing.full_name, mobile: existing.mobile_number, area: col.assigned_area,
    payments: { [day(0)]: daily, [day(2)]: 2 * daily },
  };
  const customersBefore = (await ok(get('/api/customers'), 'customers')).length;

  // The card's terms are checked first.
  assert.equal((await post('/api/notebook/card', { ...card, daily: 100, rows: [newRow] })).status, 400, 'daily too low for the total');
  assert.equal((await post('/api/notebook/card', { ...card, end_date: addDaysIso(start, -1), rows: [newRow] })).status, 400, 'end before start');

  // One wrong cell and one wrong row: nothing at all is saved, and each is named.
  const refused = await post('/api/notebook/card', {
    ...card,
    rows: [
      { ...newRow, payments: { ...newRow.payments, [addDaysIso(T, 1)]: daily } },
      existingRow,
      { name: 'Card Twin', mobile: newRow.mobile, area: col.assigned_area, payments: {} },
    ],
  });
  assert.equal(refused.status, 400);
  assert.deepEqual(refused.data.errors.map((e: any) => [e.row, !!e.date]).sort(), [[0, true], [2, false]]);
  assert.equal((await ok(get('/api/customers'), 'customers')).length, customersBefore, 'no customer added');

  const saved = await ok(post('/api/notebook/card', { ...card, rows: [newRow, existingRow] }), 'save card');
  assert.equal(saved.loans.length, 2);
  assert.equal(saved.customers_added, 1);
  assert.equal(saved.payments, 7);

  const [newLoan, existingLoan] = saved.loans;
  await checkLoan(newLoan.account_id, 5 * daily);
  await checkLoan(existingLoan.account_id, 3 * daily);
  const acc = await ok(get(`/api/collection-accounts/${newLoan.account_id}`), 'loan');
  assert.equal(acc.start_date, start);
  assert.equal(acc.expected_end_date, end);
  assert.equal(acc.total_repayment, total);
  assert.equal(acc.daily_collection, daily);
  assert.equal(acc.remaining_amount, total - 5 * daily);
  assert.equal(existingLoan.customer_id, existing.id, 'the picked customer got the loan');

  // No collector was chosen: the loan has none (not the area's), and today's work needs one for each.
  assert.equal(acc.assigned_collector_id, '', 'no collector taken from the area');
  const unassigned = await post('/api/daily-collections/assign', { changes: [] });
  assert.equal(unassigned.status, 400, 'each needs a collector for the day');
  assert.match(unassigned.data.error, /Card New/);
  await ok(post('/api/daily-collections/assign', {
    changes: saved.loans.map((l: any) => ({ collection_account_id: l.account_id, collector_id: col.id })),
  }), 'assign with a collector for each');
  const later = await ok(get(`/api/collection-accounts/${newLoan.account_id}`), 'loan');
  assert.equal(later.assigned_collector_id, '', 'only today was given a collector');

  // The loans carry on in the app: they are running loans in the notebook grid.
  const page = await ok(get(`/api/notebook?from=${start}&to=${T}`), 'notebook');
  assert.equal(page.rows.find((r: any) => r.account_id === newLoan.account_id).cells[day(4)].amount, daily);

  // A customer with a running loan cannot get a second card.
  assert.equal((await post('/api/notebook/card', { ...card, rows: [existingRow] })).status, 400, 'still has a running loan');
});

test('screens follow changes: the data version moves on saves; a cancelled loan counts nowhere', async () => {
  const v1 = (await ok(get('/api/data-version'), 'version')).version;
  await ok(get('/api/dashboard/stats'), 'stats');
  assert.equal((await ok(get('/api/data-version'), 'version')).version, v1, 'reading changes nothing');

  const config = await ok(get('/api/config'), 'config');
  const product = config.loan_products.find((p: any) => p.status === 'ACTIVE');
  const col = (await ok(get('/api/collectors'), 'collectors')).find((c: any) => c.status === 'ACTIVE');
  let amount = product.default_days * 100;
  if (product.min_amount > 0 && amount < product.min_amount) amount = product.min_amount;
  if (product.max_amount > 0 && amount > product.max_amount) amount = product.max_amount;
  const loan = { product_id: product.id, requested_amount: amount, assigned_collector_id: col.id, collection_area: col.assigned_area };
  const cust = await ok(post('/api/customers', { personal: { full_name: 'Cancel Test', mobile_number: '7' + String(Date.now()).slice(-9) }, loan }), 'create');
  const v2 = (await ok(get('/api/data-version'), 'version')).version;
  assert.ok(v2 > v1, 'a save moves the version');

  let page = await ok(get(`/api/customers/${cust.id}/360`), '360');
  assert.equal(page.metrics.totalRequested, amount);
  assert.equal(page.metrics.totalRemaining, page.accounts[0].total_repayment);

  await ok(call('DELETE', `/api/collection-accounts/${cust.activeAccount.id}`), 'cancel loan');
  page = await ok(get(`/api/customers/${cust.id}/360`), '360 after cancel');
  assert.equal(page.accounts.length, 1, 'the cancelled loan is still listed');
  assert.equal(page.metrics.totalRequested, 0, 'but counts in no total');
  assert.equal(page.metrics.totalDisbursed, 0);
  assert.equal(page.metrics.totalRemaining, 0);
  assert.equal(page.metrics.missedCount, 0);
  const report = await ok(get('/api/reports/monthly'), 'register');
  assert.ok(!report.rows.some((r: any) => r.collectionAccountId === cust.activeAccount.id), 'not in the register');
});

test('UPI claims: recorded in one step, never twice; a loan without a collector keeps today\'s collector', async () => {
  const config = await ok(get('/api/config'), 'config');
  const product = config.loan_products.find((p: any) => p.status === 'ACTIVE');
  const areas = await ok(get('/api/areas'), 'areas');
  const today = new Date();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const start = new Date(today); start.setDate(start.getDate() - 2);
  const end = new Date(start); end.setDate(end.getDate() + 99);
  const card = await ok(post('/api/notebook/card', {
    product_id: product.id, start_date: iso(start), end_date: iso(end), total: 20000, daily: 200,
    rows: [{ name: 'Upi Test', mobile: '6' + String(Date.now()).slice(-9), area: areas[0].area_name, payments: {} }],
  }), 'card');
  const loanId = card.loans[0].account_id;
  const customerId = card.loans[0].customer_id;
  const collector = (await ok(get('/api/collectors'), 'collectors')).find((c: any) => c.status === 'ACTIVE');
  const assignment = await ok(get(`/api/daily-collections/assignment?date=${iso(today)}`), 'assignment');
  if (!assignment.assigned) {
    const day = await ok(get(`/api/daily-collections?date=${iso(today)}`), 'day');
    const changes = day.filter((d: any) => !d.collector_id).map((d: any) => ({ collection_account_id: d.collection_account_id, collector_id: collector.id }));
    await ok(post('/api/daily-collections/assign', { changes }), 'assign');
  } else {
    await ok(post('/api/daily-collections/assign', { changes: [{ collection_account_id: loanId, collector_id: collector.id }] }), 'assign the new loan');
  }

  const users = await ok(get('/api/users'), 'users');
  const cred = await ok(get(`/api/users/${users.find((u: any) => u.customer_id === customerId).id}/credentials`), 'credentials');
  const token = (await ok(post('/api/auth/login', { username: cred.username, password: cred.password, role: 'CUSTOMER' }, ''), 'login')).token;
  await ok(post('/api/customer/payment-claim', { amount: 200, upi_reference: 'T-UPI-1' }, token), 'claim');
  const claim = (await ok(get('/api/payment-claims?status=PENDING'), 'claims')).find((c: any) => c.upi_reference === 'T-UPI-1');

  const done = await ok(post(`/api/payment-claims/${claim.id}/decision`, { decision: 'RECORDED', record: true }), 'record');
  assert.equal(done.status, 'RECORDED');
  assert.ok(done.receipt_number, 'the claim names its receipt');
  assert.equal((await post(`/api/payment-claims/${claim.id}/decision`, { decision: 'RECORDED', record: true })).status, 400, 'never twice');
  const payments = (await ok(get('/api/payments'), 'payments')).filter((p: any) => p.collection_account_id === loanId && p.status !== 'CANCELLED');
  assert.equal(payments.length, 1);
  assert.equal(payments[0].payment_mode, 'UPI');
  assert.equal(payments[0].collector_id, collector.id, 'credited to today\'s collector');
  const rec = (await ok(get(`/api/daily-collections?date=${iso(today)}`), 'day')).find((d: any) => d.collection_account_id === loanId);
  assert.equal(rec.collector_id, collector.id, 'today\'s collector is not blanked');
  await checkLoan(loanId, 200);

  // A second UPI the same day waits, with nothing saved.
  await ok(post('/api/customer/payment-claim', { amount: 100, upi_reference: 'T-UPI-2' }, token), 'claim 2');
  const claim2 = (await ok(get('/api/payment-claims?status=PENDING'), 'claims')).find((c: any) => c.upi_reference === 'T-UPI-2');
  const again = await post(`/api/payment-claims/${claim2.id}/decision`, { decision: 'RECORDED', record: true });
  assert.equal(again.status, 409);
  assert.match(again.data.error, /already paid today/);
  await checkLoan(loanId, 200);
});

test('settings drive the app: payment modes, rules, numbering, loan types and company name', async () => {
  const original = await ok(get('/api/config'), 'config');
  const restore = async () => {
    for (const section of ['company', 'loan_products', 'masters', 'numbering']) {
      await ok(put(`/api/config/${section}`, original[section]), `restore ${section}`);
    }
  };
  try {
    // ---- bad settings are refused
    assert.equal((await put('/api/config/masters', { ...original.masters, payment_modes: [] })).status, 400, 'no way to pay');
    assert.equal((await put('/api/config/masters', { ...original.masters, not_paid_reasons: [] })).status, 400, 'no reason');
    assert.equal((await put('/api/config/masters', { ...original.masters, report_send_limit: 0 })).status, 400, 'report limit');
    assert.equal((await put('/api/config/loan_products', [{ ...original.loan_products[0], default_days: 7 }])).status, 400, 'usual days not offered');

    // ---- rules: "not paying" and "long pending" follow their numbers
    const strict = { ...original.masters, not_paying_after_days: 1, long_pending_after_terms: 1, payment_modes: ['Cash', 'UPI', 'Bank'], default_payment_mode: 'UPI' };
    await ok(put('/api/config/masters', strict), 'strict rules');
    const strictStats = await ok(get('/api/dashboard/stats'), 'stats');
    await ok(put('/api/config/masters', { ...strict, not_paying_after_days: 9999, long_pending_after_terms: 9999 }), 'loose rules');
    const looseStats = await ok(get('/api/dashboard/stats'), 'stats');
    assert.ok(strictStats.notPayingCount > 0, 'some loans are behind in the sample');
    assert.equal(looseStats.notPayingCount, 0, '"not paying" follows the setting');
    assert.equal(looseStats.longStandingLoans, 0, '"long pending" follows the setting');

    // ---- a payment with no mode named gets the usual one from Settings
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const assignment = await ok(get(`/api/daily-collections/assignment?date=${iso}`), 'assignment');
    const day = await ok(get(`/api/daily-collections?date=${iso}`), 'day');
    if (!assignment.assigned) {
      const collector = (await ok(get('/api/collectors'), 'collectors')).find((c: any) => c.status === 'ACTIVE');
      const changes = day.filter((d: any) => !d.collector_id).map((d: any) => ({ collection_account_id: d.collection_account_id, collector_id: collector.id }));
      await ok(post('/api/daily-collections/assign', { changes }), 'assign');
    }
    const unpaid = day.find((d: any) => !d.paid_amount && d.balance_remaining >= 50);
    const paid = await ok(post('/api/daily-collections/collect', { collection_account_id: unpaid.collection_account_id, amount_paid: 50 }), 'collect');
    assert.equal(paid.receipt.payment_mode, 'UPI', 'usual way to pay');

    // ---- numbering: new IDs follow the rule
    await ok(put('/api/config/numbering', { ...original.numbering, customer: { prefix: 'TST', include_year: false, pad: 6, next: original.numbering.customer.next + 500 } }), 'numbering');
    // ...and never moves backwards, so an old screen cannot hand out a used number again
    await ok(put('/api/config/numbering', { ...original.numbering, customer: { prefix: 'TST', include_year: false, pad: 6, next: 1 } }), 'numbering back');
    const cust = await ok(post('/api/customers', { personal: { full_name: 'Numbered', mobile_number: '5' + String(Date.now()).slice(-9) } }), 'customer');
    const expectedNo = original.numbering.customer.next + 500;
    assert.equal(cust.id, 'TST' + String(expectedNo).padStart(6, '0'));
    assert.equal((await ok(get('/api/config'), 'config')).numbering.customer.next, expectedNo + 1, 'the counter moves on');

    // ---- loan types: a request without a period gets the usual one of the first active type
    const first = original.loan_products.find((p: any) => p.status === 'ACTIVE');
    const products = original.loan_products.map((p: any) => p.id === first.id ? { ...p, day_options: [...new Set([...p.day_options, 45])], default_days: 45 } : p);
    await ok(put('/api/config/loan_products', products), 'loan types');
    const users = await ok(get('/api/users'), 'users');
    const cred = await ok(get(`/api/users/${users.find((u: any) => u.customer_id === cust.id).id}/credentials`), 'credentials');
    const token = (await ok(post('/api/auth/login', { username: cred.username, password: cred.password, role: 'CUSTOMER' }, ''), 'login')).token;
    const request = (await ok(post('/api/customer/loan-request', { requested_amount: 5000 }, token), 'request')).request;
    assert.equal(request.collection_days, 45);

    // ---- company name: everyone reads it, and saving it moves the change counter
    const v = (await ok(get('/api/data-version'), 'version')).version;
    await ok(put('/api/config/company', { ...original.company, company_name: 'Test Finance' }), 'company');
    assert.equal((await ok(get('/api/config', ''), 'public config')).company.company_name, 'Test Finance');
    assert.ok((await ok(get('/api/data-version'), 'version')).version > v, 'open screens reload settings');
  } finally {
    await restore();
  }
});

test('payment modes: the ones in Settings, plus "Others" with how it was paid; reports show each mode', async () => {
  const original = await ok(get('/api/config'), 'config');
  try {
    await ok(put('/api/config/masters', { ...original.masters, payment_modes: ['Cash', 'UPI', 'Cheque'], default_payment_mode: 'Cash' }), 'modes');
    assert.equal((await put('/api/config/masters', { ...original.masters, payment_modes: ['Cash', 'others'] })).status, 400, '"Others" is built in');

    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (!(await ok(get(`/api/daily-collections/assignment?date=${iso}`), 'assignment')).assigned) {
      const day0 = await ok(get(`/api/daily-collections?date=${iso}`), 'day');
      const collector = (await ok(get('/api/collectors'), 'collectors')).find((c: any) => c.status === 'ACTIVE');
      const changes = day0.filter((d: any) => !d.collector_id).map((d: any) => ({ collection_account_id: d.collection_account_id, collector_id: collector.id }));
      await ok(post('/api/daily-collections/assign', { changes }), 'assign');
    }
    const day = await ok(get(`/api/daily-collections?date=${iso}`), 'day');
    const unpaid = day.filter((d: any) => !d.paid_amount && d.balance_remaining >= 50 && d.collector_id);
    const collectorId = unpaid[0].collector_id;
    const mine = unpaid.filter((d: any) => d.collector_id === collectorId);
    assert.ok(mine.length >= 2, 'two customers to collect from');
    const pay = (rec: any, extra: any) => post('/api/daily-collections/collect', { collection_account_id: rec.collection_account_id, amount_paid: 50, ...extra });

    // A mode that is not in Settings is refused; "Others" needs a description.
    assert.equal((await pay(mine[0], { payment_mode: 'Gold' })).status, 400, 'unknown mode');
    assert.equal((await pay(mine[0], { payment_mode: 'Others' })).status, 400, 'no description');
    assert.equal((await pay(mine[0], { payment_mode: 'Others', payment_mode_note: '   ' })).status, 400, 'blank description');

    const other = await ok(pay(mine[0], { payment_mode: 'Others', payment_mode_note: 'Paid by son, bank transfer' }), 'others');
    assert.equal(other.receipt.payment_mode, 'Others');
    assert.equal(other.receipt.payment_mode_note, 'Paid by son, bank transfer');
    const cheque = await ok(pay(mine[1], { payment_mode: 'cheque' }), 'cheque');
    assert.equal(cheque.receipt.payment_mode, 'Cheque', 'saved with the name from Settings');
    assert.equal(cheque.receipt.payment_mode_note, undefined);

    const after = await ok(get(`/api/daily-collections?date=${iso}`), 'day');
    assert.equal(after.find((d: any) => d.collection_account_id === mine[0].collection_account_id).payment_mode_note, 'Paid by son, bank transfer', 'day record');

    // The office changes it to a mode in Settings: the description goes.
    const pays = await ok(get(`/api/payments?customer_id=${other.receipt.customer_id}`), 'payments');
    const p = pays.find((x: any) => x.receipt_number === other.receipt.receipt_number);
    const changed = await ok(put(`/api/payments/${p.id}`, { payment_mode: 'UPI' }), 'edit');
    assert.equal((changed.payment || changed).payment_mode_note, undefined);
    await ok(put(`/api/payments/${p.id}`, { payment_mode: 'Others', payment_mode_note: 'Paid by son, bank transfer' }), 'edit back');

    // The collector's report: cash, then every other mode by name.
    const report = (await ok(post('/api/collector-reports', { collector_id: collectorId, cash_notes: {}, coins: 0 }), 'report'));
    const totals = Object.fromEntries(report.mode_totals.map((m: any) => [m.mode, m.amount]));
    assert.ok('UPI' in totals && 'Cheque' in totals, 'every mode in Settings is listed');
    assert.ok(totals.Cheque >= 50 && totals.Others >= 50, 'each mode has its own amount');
    assert.equal(report.mode_totals.reduce((s: number, m: any) => s + m.amount, 0), report.upi_in_app, 'the modes add up to the money that is not cash');
  } finally {
    await ok(put('/api/config/masters', original.masters), 'restore');
  }
});

test('organisation details: logo, email and opening balance are checked, kept and used', async () => {
  const original = await ok(get('/api/config'), 'config');
  const company = original.company;
  try {
    const logo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    assert.equal((await put('/api/config/company', { ...company, company_logo: 'javascript:alert(1)' })).status, 400, 'not a picture');
    assert.equal((await put('/api/config/company', { ...company, company_logo: 'data:image/svg+xml;base64,PHN2Zz4=' })).status, 400, 'no SVG');
    assert.equal((await put('/api/config/company', { ...company, company_email: 'not an email' })).status, 400, 'email');
    assert.equal((await put('/api/config/company', { ...company, opening_balance: -5 })).status, 400, 'opening balance');
    assert.equal((await put('/api/config/company', { ...company, company_name: '  ' })).status, 400, 'name');

    await ok(put('/api/config/company', { ...company, company_logo: logo, company_tagline: 'Trusted daily', company_email: 'office@example.com', opening_balance: '250000' }), 'save');
    const pub = (await ok(get('/api/config', ''), 'public config')).company;
    assert.equal(pub.company_logo, logo, 'everyone sees the logo (login page, receipts)');
    assert.equal(pub.company_tagline, 'Trusted daily');
    assert.equal(pub.company_email, 'office@example.com');
    assert.equal(pub.opening_balance, 250000, 'kept as a number');

    const stats = await ok(get('/api/dashboard/stats'), 'stats');
    assert.equal(stats.openingBalance, 250000);
    assert.equal(stats.totalBalance, roundMoney(250000 + stats.totalCollected - stats.totalDisbursed), 'money in hand');

    await ok(put('/api/config/company', { ...company, company_logo: '', opening_balance: '' }), 'clear');
    assert.equal((await ok(get('/api/config'), 'config')).company.opening_balance, 0, 'empty means 0');
  } finally {
    await ok(put('/api/config/company', company), 'restore');
  }
});

test('ID numbers and alerts follow Settings', async () => {
  const original = await ok(get('/api/config'), 'config');
  try {
    // Start letters are checked; the year can be added; new receipts follow the rule.
    assert.equal((await put('/api/config/numbering', { ...original.numbering, receipt: { ...original.numbering.receipt, prefix: 'R E C' } })).status, 400, 'spaces refused');
    assert.equal((await put('/api/config/numbering', { ...original.numbering, receipt: { ...original.numbering.receipt, prefix: 'ABCDEFGHIJKLM' } })).status, 400, 'too long');
    const saved = await ok(put('/api/config/numbering', { ...original.numbering, receipt: { prefix: 'rc-', include_year: true, pad: 4, next: original.numbering.receipt.next } }), 'numbering');
    assert.equal(saved.numbering.receipt.prefix, 'RC-', 'stored in capitals');

    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (!(await ok(get(`/api/daily-collections/assignment?date=${iso}`), 'assignment')).assigned) {
      const day0 = await ok(get(`/api/daily-collections?date=${iso}`), 'day');
      const collector = (await ok(get('/api/collectors'), 'collectors')).find((c: any) => c.status === 'ACTIVE');
      const changes = day0.filter((d: any) => !d.collector_id).map((d: any) => ({ collection_account_id: d.collection_account_id, collector_id: collector.id }));
      await ok(post('/api/daily-collections/assign', { changes }), 'assign');
    }
    const day = await ok(get(`/api/daily-collections?date=${iso}`), 'day');
    const rec = day.find((d: any) => !d.paid_amount && d.balance_remaining >= 10);

    // Alerts off: a payment makes no new alert.
    await ok(put('/api/config/company', { ...original.company, notifications_enabled: false }), 'alerts off');
    const before = (await ok(get('/api/notifications'), 'notifications')).length;
    const paid = await ok(post('/api/daily-collections/collect', { collection_account_id: rec.collection_account_id, amount_paid: 10, payment_mode: 'Cash' }), 'collect');
    assert.match(paid.receipt.receipt_number, new RegExp(`^RC-${today.getFullYear()}-\\d{4,}$`), 'receipt number follows the rule');
    assert.equal((await ok(get('/api/notifications'), 'notifications')).length, before, 'no alert while switched off');
  } finally {
    await ok(put('/api/config/company', original.company), 'restore company');
    await ok(put('/api/config/numbering', original.numbering), 'restore numbering');
  }
});

test('removing the data keeps settings, office logins and (when asked) the staff', async () => {
  assert.equal((await post('/api/data/clear', { keep_staff: true })).status, 400, 'needs the typed confirmation');
  const collectorsBefore = (await ok(get('/api/collectors'), 'collectors')).length;
  const products = (await ok(get('/api/config'), 'config')).loan_products.length;
  await ok(post('/api/data/clear', { confirm: 'DELETE', keep_staff: true }), 'clear');
  assert.equal((await ok(get('/api/customers'), 'customers')).length, 0);
  assert.equal((await ok(get('/api/collection-accounts'), 'loans')).length, 0);
  assert.equal((await ok(get('/api/payments'), 'payments')).length, 0);
  assert.equal((await ok(get('/api/collectors'), 'collectors')).length, collectorsBefore, 'collectors kept');
  assert.equal((await ok(get('/api/config'), 'config')).loan_products.length, products, 'settings kept');
  const users = await ok(get('/api/users'), 'users');
  assert.ok(users.every((u: any) => u.role !== 'CUSTOMER'), 'customer logins removed');
  assert.ok(users.some((u: any) => u.role === 'ADMIN'), 'office login kept');
  const stats = await ok(get('/api/dashboard/stats'), 'Home still works');
  assert.equal(stats.monthCollected, 0);
  await ok(post('/api/data/clear', { confirm: 'DELETE', keep_staff: false }), 'clear staff too');
  assert.equal((await ok(get('/api/collectors'), 'collectors')).length, 0);
  assert.equal((await ok(get('/api/areas'), 'areas')).length, 0);
});
