import express, { Request, Response } from 'express';
import cors from 'cors';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  repository,
  initializeDatabase,
  loadSampleData,
  nextId,
  CustomerPersonalDetails,
  CustomerAddress,
  BusinessDetails,
  CollectionAccount,
  DailyCollectionRecord,
  PaymentTransaction,
  Receipt,
  Collector,
  Area,
  CustomerDocument,
  Notification,
  CustomerNote,
  AuditLog,
  User,
} from './db.ts';
import { createLoanAccount, planLoan, commitLoan, LoanValidationError, IssueLoanInput, LoanParty, PlannedLoan } from './loans.ts';
import { todayIso, roundMoney, addDaysIso, scheduleDates, termProgress, monthExpected, monthBounds, monthDueDays } from '../shared/finance.ts';
import { activePayments, dayPosition, isActivePayment, isRunning, payStanding, settleStatus, syncDayRecord, syncLoan } from './ledger.ts';
import {
  CollectorReport,
  DayClosing,
  DayClosingCollector,
  activeClosing,
  canVerify,
  closingTotals,
  collectionDaySummary,
  countedCash,
  CASH_NOTES,
  CloseState,
  dayCloseChecks,
  isCashMode,
  longPendingCounts,
} from '../shared/collectorDay.ts';
import { CONFIG_SECTIONS, ConfigSection, LoanProduct as ConfigLoanProduct, MasterLists, Numbering, NumberingKind } from '../shared/config.ts';
import {
  STARTING_PIN,
  actor,
  bearerToken,
  closeSession,
  closeSessionsOf,
  openSession,
  passwordMatches,
  requireSignIn,
  sessionInfo,
  sessionUser,
  touchSession,
} from './auth.ts';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Customer photos and document copies live in uploads/ (git-ignored), never in the data file.
const uploadsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');
app.use('/api/uploads', express.static(uploadsDir, { maxAge: '7d' }));

// Initialize DB schema & seeds
initializeDatabase();

// Everything below needs a signed-in user; collectors and customers reach only their own work.
app.use(requireSignIn(id => repository.getDb().users.find(u => u.id === id)));

// Helpers
function getParam(req: Request, key: string): string {
  const val = req.params[key];
  return Array.isArray(val) ? val[0] : val || '';
}

const safeRound = roundMoney;

/**
 * Pending terms before a date: the same count the collector sees (money-based, never beyond the
 * loan's length), so "Not paying" in the office matches the collector's list.
 */
function daysBehindSchedule(acc: CollectionAccount, dateStr: string): number {
  return termProgress(acc, dateStr).missed;
}

/**
 * A loan being collected on a date: started by then, and still running then (a loan paid off later
 * was still being collected on its earlier days).
 */
function isCollecting(acc: CollectionAccount, dateStr: string): boolean {
  if (acc.status === 'CANCELLED' || acc.start_date > dateStr) return false;
  return isRunning(acc) || (!!acc.actual_completion_date && acc.actual_completion_date > dateStr);
}

/** Loans past their end date and still owing become OVERDUE (and back to ACTIVE if that changes). */
function refreshStatuses(db: ReturnType<typeof repository.getDb>) {
  const today = todayIso();
  for (const acc of db.collection_accounts) if (isRunning(acc)) settleStatus(db, acc, today);
}

/** Adds how many days a running loan is behind its schedule (drives "Not paying"). */
function withDaysBehind(acc: CollectionAccount) {
  return { ...acc, days_behind: isRunning(acc) ? daysBehindSchedule(acc, todayIso()) : 0 };
}


/** The name recorded for an action: the signed-in person (a name sent by the app is only a fallback). */
const byWho = (req: Request) => actor()?.name || String(req.body?.by || 'admin');

/** IDs for payments and receipts made in the same millisecond must still differ. */
const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Records who did what. The signed-in person is recorded when there is one; the name passed in is
 * only used for work done by the server itself.
 */
function logAudit(
  user: string,
  role: string,
  action: string,
  record_id: string,
  record_type: string,
  previous_value: any = null,
  new_value: any = null
) {
  const db = repository.getDb();
  const who = actor();
  const log: AuditLog = {
    id: `AUDIT-${uniqueSuffix()}`,
    user: who?.name || who?.username || user,
    role: who?.role || role,
    action,
    record_id,
    record_type,
    previous_value,
    new_value,
    timestamp: new Date().toISOString(),
  };
  db.audit_logs.unshift(log);
  repository.save();
}

function createNotification(
  recipient_role: 'ADMIN' | 'CUSTOMER' | 'COLLECTOR',
  title: string,
  message: string,
  type: 'PAYMENT' | 'MISSED' | 'OVERDUE' | 'KYC' | 'ACCOUNT' | 'SYSTEM',
  customer_id?: string
) {
  const db = repository.getDb();
  if (!db.config.company.notifications_enabled) return;
  const notif: Notification = {
    id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    recipient_role,
    customer_id,
    title,
    message,
    type,
    is_read: false,
    created_at: new Date().toISOString(),
  };
  db.notifications.unshift(notif);
  repository.save();
}

// -------------------------------------------------------------
// 1. AUTHENTICATION
// -------------------------------------------------------------
/** A login as sent to screens: the password only ever goes out through /credentials. */
function publicUser(user: User) {
  const { password: _, ...safeUser } = user;
  return { ...safeUser, ...sessionInfo(user.id) };
}

/** A login for someone added as a collector or customer, made the first time they sign in. */
function loginFor(person: { collector?: Collector; customer?: CustomerPersonalDetails }): User {
  const { collector: col, customer: cust } = person;
  const id = col ? col.id : cust!.id;
  return {
    id: `USR-${id}`,
    username: id,
    email: (col ? col.email : cust!.email) || '',
    password: STARTING_PIN,
    role: col ? 'COLLECTOR' : 'CUSTOMER',
    ...(col ? { collector_id: col.id } : { customer_id: cust!.id }),
    name: col ? col.name : cust!.full_name,
    phone: col ? col.mobile : cust!.mobile_number,
    is_active: col ? col.status === 'ACTIVE' : cust!.status === 'ACTIVE',
    created_at: (col ? col.joining_date : cust!.created_at) || todayIso(),
  };
}

const digitsOf = (v: string | undefined) => String(v || '').replace(/\D/g, '');

/**
 * Sign in with the user ID, email, collector/customer ID or mobile number, and that login's own
 * password or PIN. Collectors and customers added by the office sign in with the starting PIN until
 * it is changed.
 */
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password, role } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  const db = repository.getDb();
  const name = String(username).trim().toLowerCase();
  const digits = digitsOf(name);
  const pass = String(password).trim();
  // A mobile number matches on its last ten digits, so +91 or a leading 0 make no difference.
  const sameMobile = (phone: string | undefined) => digits.length >= 10 && digitsOf(phone).slice(-10) === digits.slice(-10);

  let user = db.users.find(u =>
    (!role || u.role === role) &&
    (u.username.toLowerCase() === name ||
      (!!u.email && u.email.toLowerCase() === name) ||
      (!!u.customer_id && u.customer_id.toLowerCase() === name) ||
      (!!u.collector_id && u.collector_id.toLowerCase() === name) ||
      sameMobile(u.phone))
  );
  let isNew = false;
  if (!user && role === 'COLLECTOR') {
    const col = db.collectors.find(c => c.id.toLowerCase() === name || sameMobile(c.mobile));
    if (col && !db.users.some(u => u.collector_id === col.id)) { user = loginFor({ collector: col }); isNew = true; }
  }
  if (!user && role === 'CUSTOMER') {
    const cust = db.customers.find(c => c.id.toLowerCase() === name || sameMobile(c.mobile_number));
    if (cust && !db.users.some(u => u.customer_id === cust.id)) { user = loginFor({ customer: cust }); isNew = true; }
  }

  if (!user || !passwordMatches(user, pass)) {
    return res.status(401).json({ error: 'Invalid credentials. Please check your username/phone and password.' });
  }
  if (!user.is_active) {
    return res.status(403).json({ error: 'Account is deactivated. Please contact the office.' });
  }

  if (isNew) db.users.push(user);
  user.last_login_at = new Date().toISOString();
  repository.save();
  res.json({ token: openSession(user.id), user: publicUser(user) });
});

/** The app is open: keeps its session active. */
app.post('/api/auth/heartbeat', (req: Request, res: Response) => {
  if (!touchSession(bearerToken(req))) return res.status(401).json({ error: 'Please sign in again.' });
  res.json({ ok: true });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  closeSession(bearerToken(req));
  res.json({ ok: true });
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  const userId = sessionUser(bearerToken(req));
  const user = userId ? repository.getDb().users.find(u => u.id === userId) : undefined;
  if (!user) return res.status(401).json({ error: 'Please sign in again.' });
  res.json(publicUser(user));
});

// -------------------------------------------------------------
// 1.1 USER CREDENTIALS & MANAGEMENT (Admin)
// -------------------------------------------------------------
// -------------------------------------------------------------
// 1.2 STARTUP SETUP: adding people from a form or a checked spreadsheet
// -------------------------------------------------------------
/** The area with this name (any capitalisation), created if it is new. */
function findOrAddArea(db: ReturnType<typeof repository.getDb>, name: string, collector: Collector | undefined, newAreas: string[]): string {
  const existing = db.areas.find(a => a.area_name.toLowerCase() === name.toLowerCase());
  if (existing) {
    if (!existing.assigned_collector_id && collector) {
      existing.assigned_collector_id = collector.id;
      existing.assigned_collector_name = collector.name;
    }
    return existing.area_name;
  }
  const loc = db.config.masters.default_location;
  db.areas.push({
    id: nextId(db, 'area', db.areas.map(a => a.id)),
    area_name: name,
    city: loc.city,
    district: loc.district,
    pincode: loc.pincode,
    assigned_collector_id: collector?.id ?? '',
    assigned_collector_name: collector?.name ?? '',
    customer_count: 0,
  });
  newAreas.push(name);
  return name;
}

/**
 * Adds customers or collectors in one save. Every row is checked again here; a row with a problem is
 * skipped and reported, and the others still go in. Each person gets a login with the default password.
 */
app.post('/api/setup/import', (req: Request, res: Response) => {
  const db = repository.getDb();
  const { kind, rows } = (req.body || {}) as { kind?: string; rows?: Record<string, unknown>[] };
  if ((kind !== 'customer' && kind !== 'collector') || !Array.isArray(rows)) {
    return res.status(400).json({ error: 'Send the kind (customer or collector) and the rows.' });
  }
  const text = (value: unknown) => String(value ?? '').trim();
  const skipped: { name: string; reason: string }[] = [];
  const newAreas: string[] = [];
  let created = 0;

  for (const row of rows) {
    const name = text(row.name);
    let mobile = text(row.mobile).replace(/\D/g, '');
    if (mobile.length > 10) mobile = mobile.slice(-10);
    if (!name) {
      skipped.push({ name: mobile || '-', reason: 'The name is missing.' });
      continue;
    }
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      skipped.push({ name, reason: 'Not a 10-digit mobile number.' });
      continue;
    }
    const taken = kind === 'customer'
      ? db.customers.some(c => c.mobile_number.replace(/\D/g, '').slice(-10) === mobile)
      : db.collectors.some(c => c.mobile.replace(/\D/g, '').slice(-10) === mobile);
    if (taken) {
      skipped.push({ name, reason: 'This mobile number is already added.' });
      continue;
    }

    const areaText = text(row.area);
    if (kind === 'collector') {
      const collector = addCollectorRecords(db, { name, mobile, email: text(row.email), address: text(row.address), assigned_area: areaText });
      if (areaText) collector.assigned_area = findOrAddArea(db, areaText, collector, newAreas);
      logAudit('admin', 'ADMIN', 'ADD_COLLECTOR', collector.id, 'collectors', null, collector);
    } else {
      const firstWorking = db.collectors.find(c => c.status === 'ACTIVE');
      const area = areaText ? findOrAddArea(db, areaText, firstWorking, newAreas) : '';
      const customer = addCustomerRecords(db, {
        personal: {
          full_name: name,
          mobile_number: mobile,
          alternate_number: text(row.alternate).replace(/\D/g, ''),
          father_or_husband_name: text(row.relative),
          email: text(row.email),
        },
        address: { street: text(row.address), area, landmark: text(row.landmark) },
        business: { shop_name: text(row.shop), shop_area: area, shop_address: text(row.address), landmark: text(row.landmark) },
      });
      logAudit('admin', 'ADMIN', 'CREATE_CUSTOMER', customer.id, 'customers', null, customer);
    }
    created++;
  }

  if (created > 0) repository.save();
  res.json({ created, skipped, new_areas: newAreas });
});

/** Another active office login besides this one. */
function otherActiveAdmin(db: ReturnType<typeof repository.getDb>, userId: string): boolean {
  return db.users.some(u => u.id !== userId && u.role === 'ADMIN' && u.is_active);
}

app.get('/api/users', (req: Request, res: Response) => {
  const db = repository.getDb();
  const role = req.query.role as string | undefined;

  // Every collector and customer has a login (with the starting PIN until it is changed).
  for (const col of db.collectors) {
    if (!db.users.some(u => u.collector_id === col.id || u.username.toLowerCase() === col.id.toLowerCase())) {
      db.users.push(loginFor({ collector: col }));
    }
  }
  for (const cust of db.customers) {
    if (!db.users.some(u => u.customer_id === cust.id || u.username.toLowerCase() === cust.id.toLowerCase())) {
      db.users.push(loginFor({ customer: cust }));
    }
  }

  let list = db.users;
  if (role) {
    list = list.filter(u => u.role === role);
  }

  res.json(list.map(publicUser));
});

/** User ID and password of one login, asked for only when the office opens that person's profile. */
app.get('/api/users/:id/credentials', (req: Request, res: Response) => {
  const user = repository.getDb().users.find(u => u.id === getParam(req, 'id'));
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ username: user.username, password: user.password || STARTING_PIN });
});

app.post('/api/users', (req: Request, res: Response) => {
  const db = repository.getDb();
  const { username, password, role, name, phone, email, customer_id, collector_id } = req.body;

  if (!username || !String(username).trim()) {
    return res.status(400).json({ error: 'Username / User ID is required.' });
  }
  if (!role || !['ADMIN', 'COLLECTOR', 'CUSTOMER'].includes(role)) {
    return res.status(400).json({ error: 'Valid role (ADMIN, COLLECTOR, or CUSTOMER) is required.' });
  }

  const cleanUser = String(username).trim();
  if (db.users.some(u => u.username.toLowerCase() === cleanUser.toLowerCase())) {
    return res.status(400).json({ error: `User ID "${cleanUser}" already exists. Please choose a different one.` });
  }

  // An office login always gets its own password; collectors and customers may start with the PIN.
  const cleanPass = String(password || '').trim() || (role === 'ADMIN' ? '' : STARTING_PIN);
  if (role === 'ADMIN' && cleanPass.length < 6) {
    return res.status(400).json({ error: 'An office login needs a password of at least 6 characters.' });
  }
  const userId = `USR-${Date.now().toString(36).toUpperCase()}`;

  const newUser: User = {
    id: userId,
    username: cleanUser,
    email: (email || '').trim(),
    password: cleanPass,
    role,
    name: (name || cleanUser).trim(),
    phone: (phone || '').trim(),
    customer_id: customer_id?.trim() || undefined,
    collector_id: collector_id?.trim() || undefined,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  db.users.push(newUser);
  logAudit('admin', 'ADMIN', 'CREATE_USER', userId, 'users', null, { username: newUser.username, role: newUser.role });
  repository.save();
  res.status(201).json(publicUser(newUser));
});

app.put('/api/users/:id', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const user = db.users.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { username, password, name, phone, email, is_active, role } = req.body;

  // The office must always keep at least one active office login.
  const losesAdmin = user.role === 'ADMIN' && user.is_active &&
    ((is_active !== undefined && !is_active) || (role !== undefined && role !== 'ADMIN'));
  if (losesAdmin && !otherActiveAdmin(db, user.id)) {
    return res.status(400).json({ error: 'This is the only active office login; add another one first.' });
  }
  const signOut = user.id !== actor()?.id && (
    (password !== undefined && String(password).trim() !== '' && String(password).trim() !== user.password) ||
    (is_active !== undefined && !is_active) ||
    (role !== undefined && role !== user.role)
  );
  if (user.role === 'ADMIN' && password !== undefined && String(password).trim() !== '' && String(password).trim().length < 6) {
    return res.status(400).json({ error: 'An office login needs a password of at least 6 characters.' });
  }

  if (username && String(username).trim().toLowerCase() !== user.username.toLowerCase()) {
    const cleanUser = String(username).trim();
    const duplicate = db.users.find(u => u.id !== id && u.username.toLowerCase() === cleanUser.toLowerCase());
    if (duplicate) {
      return res.status(400).json({ error: `Username "${cleanUser}" is already taken.` });
    }
    user.username = cleanUser;
  }

  if (password !== undefined && String(password).trim() !== '') {
    user.password = String(password).trim();
  }

  if (name !== undefined) user.name = String(name).trim();
  if (phone !== undefined) user.phone = String(phone).trim();
  if (email !== undefined) user.email = String(email).trim();
  if (is_active !== undefined) user.is_active = Boolean(is_active);
  if (role !== undefined && ['ADMIN', 'COLLECTOR', 'CUSTOMER'].includes(role)) {
    user.role = role;
  }

  // Synchronize changes if linked to collector
  if (user.collector_id) {
    const col = db.collectors.find(c => c.id === user.collector_id);
    if (col) {
      if (name) col.name = String(name).trim();
      if (phone) col.mobile = String(phone).trim();
      if (is_active !== undefined) col.status = user.is_active ? 'ACTIVE' : 'INACTIVE';
    }
  }

  // Synchronize changes if linked to customer
  if (user.customer_id) {
    const cust = db.customers.find(c => c.id === user.customer_id);
    if (cust) {
      if (name) cust.full_name = String(name).trim();
      if (phone) cust.mobile_number = String(phone).trim();
    }
  }

  if (signOut) closeSessionsOf(user.id);
  logAudit('admin', 'ADMIN', 'UPDATE_USER_CREDENTIALS', id, 'users', null, { username: user.username, role: user.role });
  repository.save();
  res.json(publicUser(user));
});

app.delete('/api/users/:id', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const idx = db.users.findIndex(u => u.id === id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  if (id === actor()?.id) return res.status(400).json({ error: 'You cannot delete your own login.' });
  const target = db.users[idx];
  if (target.role === 'ADMIN' && target.is_active && !otherActiveAdmin(db, id)) {
    return res.status(400).json({ error: 'This is the only active office login; add another one first.' });
  }

  const deleted = db.users.splice(idx, 1)[0];
  closeSessionsOf(id);
  logAudit('admin', 'ADMIN', 'DELETE_USER', id, 'users', deleted, null);
  repository.save();
  res.json({ success: true, message: 'User deleted successfully' });
});

// -------------------------------------------------------------
// 2. DASHBOARD STATS & CHARTS
// -------------------------------------------------------------
/**
 * The whole month's collection: each loan's daily amount for its days this month, never more than it
 * could still pay. Anything paid above that counts as expected, so expected - collected = balance.
 */
function monthFigures(db: ReturnType<typeof repository.getDb>, month: string) {
  let expected = 0;
  let collected = 0;
  for (const acc of db.collection_accounts) {
    const { paidBefore, paidIn } = monthPaid(db, acc.id, month);
    expected += monthExpected(acc, paidBefore, paidIn, month);
    collected += paidIn;
  }
  return { monthExpected: safeRound(expected, 2), monthCollected: safeRound(collected, 2), monthBalance: safeRound(expected - collected, 2) };
}

/** A loan's payments before a month, within it, and the month's payments themselves. */
function monthPaid(db: ReturnType<typeof repository.getDb>, accountId: string, month: string) {
  const { start, end } = monthBounds(month);
  const list = activePayments(db, accountId);
  const inMonth = list.filter(p => p.collection_date >= start && p.collection_date <= end);
  return {
    paidBefore: safeRound(list.filter(p => p.collection_date < start).reduce((s, p) => s + p.amount_paid, 0), 2),
    paidIn: safeRound(inMonth.reduce((s, p) => s + p.amount_paid, 0), 2),
    inMonth,
  };
}

app.get('/api/dashboard/stats', (req: Request, res: Response) => {
  const db = repository.getDb();
  refreshStatuses(db);
  const todayStr = todayIso();
  const currentMonthStr = todayStr.slice(0, 7); // YYYY-MM

  const activeAccounts = db.collection_accounts.filter(isRunning);
  const collectingToday = activeAccounts.filter(a => isCollecting(a, todayStr));

  // Today's collections
  const today = collectionDaySummary(dayRecords(db, todayStr));
  const todayExpected = today.expected;
  const todayCollected = today.collected;
  const todayPending = today.pendingAmount;
  const todayCollectionRate = todayExpected > 0 ? safeRound((todayCollected / todayExpected) * 100, 1) : 0;

  // Monthly collections
  const monthlyPayments = db.payments.filter(p => isActivePayment(p) && p.collection_date.startsWith(currentMonthStr));
  const monthlyCollection = safeRound(monthlyPayments.reduce((sum, p) => sum + p.amount_paid, 0), 2);
  const notPayingCount = activeAccounts.filter(
    a => daysBehindSchedule(a, todayStr) >= db.config.masters.not_paying_after_days
  ).length;

  // Financial aggregates (cancelled loans never happened; only running loans still owe money)
  const liveAccounts = db.collection_accounts.filter(a => a.status !== 'CANCELLED');
  const totalOutstanding = safeRound(activeAccounts.reduce((sum, a) => sum + a.remaining_amount, 0), 2);
  const totalCollected = safeRound(liveAccounts.reduce((sum, a) => sum + a.amount_collected, 0), 2);
  const totalFinanceMargin = safeRound(liveAccounts.reduce((sum, a) => sum + a.finance_margin, 0), 2);
  const totalDisbursed = safeRound(liveAccounts.reduce((sum, a) => sum + a.disbursed_amount, 0), 2);
  const totalRepayment = safeRound(liveAccounts.reduce((sum, a) => sum + a.total_repayment, 0), 2);
  const overdueCustomersCount = db.collection_accounts.filter(a => a.status === 'OVERDUE').length;

  const openingBalance = Number(db.config.company.opening_balance) || 0;
  // Total Balance = Opening Capital + Total Collected - Total Disbursed (new customer loans deduct from this balance!)
  const totalBalance = safeRound(openingBalance + totalCollected - totalDisbursed, 2);

  res.json({
    ...monthFigures(db, currentMonthStr),
    totalCollectors: db.collectors.filter(c => c.status === 'ACTIVE').length,
    // The same rule as "Long pending" on the collector's screen (Settings → Collection rules).
    longStandingLoans: collectingToday.filter(a => termProgress(a, todayStr).missed >= db.config.masters.long_pending_after_terms).length,
    totalCustomers: db.customers.length,
    activeAccounts: activeAccounts.length,
    todayExpected,
    todayCollected,
    todayPending,
    todayCollectionRate,
    monthlyCollection,
    totalOutstanding,
    totalCollected,
    totalFinanceMargin,
    totalDisbursed,
    totalRepayment,
    overdueCustomersCount,
    notPayingCount,
    totalBalance,
    openingBalance,
  });
});

// -------------------------------------------------------------
// 3. CUSTOMER MANAGEMENT
// -------------------------------------------------------------
app.get('/api/customers', (req: Request, res: Response) => {
  const db = repository.getDb();
  refreshStatuses(db);
  const search = String(req.query.search || '').toLowerCase().trim();
  const status = req.query.status as string;
  const area = req.query.area as string;

  let list = db.customers.map(c => {
    const addr = db.customer_addresses.find(a => a.customer_id === c.id);
    const biz = db.business_details.find(b => b.customer_id === c.id);
    const accounts = db.collection_accounts.filter(a => a.customer_id === c.id);
    const activeAcc = accounts.find(isRunning);
    const latestAcc = [...accounts].sort((a, b) => a.created_at.localeCompare(b.created_at)).pop();

    return {
      ...c,
      address: addr,
      business: biz,
      activeAccount: activeAcc ? withDaysBehind(activeAcc) : undefined,
      latestAccount: latestAcc,
    };
  });

  if (search) {
    list = list.filter(c =>
      c.id.toLowerCase().includes(search) ||
      c.full_name.toLowerCase().includes(search) ||
      c.mobile_number.includes(search) ||
      (c.business && c.business.shop_name.toLowerCase().includes(search)) ||
      (c.address && c.address.area.toLowerCase().includes(search))
    );
  }

  if (status && status !== 'ALL') {
    list = list.filter(c => c.status === status);
  }

  if (area && area !== 'ALL') {
    list = list.filter(c => c.address?.area === area || c.business?.shop_area === area);
  }

  res.json(list);
});

/** A new customer with their address, shop and login. Saving is left to the caller. */
function addCustomerRecords(
  db: ReturnType<typeof repository.getDb>,
  { personal, address, business, username, password }: { personal: any; address?: any; business?: any; username?: string; password?: string }
): CustomerPersonalDetails {
  const loc = db.config.masters.default_location;
  const customerId = nextId(db, 'customer', db.customers.map(c => c.id));
  const now = new Date().toISOString();

  const newCustomer: CustomerPersonalDetails = {
    id: customerId,
    full_name: personal.full_name,
    profile_photo: personal.profile_photo || '',
    gender: personal.gender || 'Other',
    dob: personal.dob || '',
    father_or_husband_name: personal.father_or_husband_name || '',
    mother_name: personal.mother_name || '',
    marital_status: personal.marital_status || 'Other',
    mobile_number: personal.mobile_number,
    alternate_number: personal.alternate_number || '',
    whatsapp_number: personal.whatsapp_number || personal.mobile_number,
    email: personal.email || '',
    status: 'ACTIVE',
    created_at: now,
    updated_at: now,
  };
  db.customers.push(newCustomer);

  if (address) {
    const newAddress: CustomerAddress = {
      id: `ADDR-${customerId}`,
      customer_id: customerId,
      door_number: address.door_number || '',
      street: address.street || '',
      area: address.area || '',
      village_or_town: address.village_or_town || address.city || loc.city,
      city: address.city || loc.city,
      district: address.district || loc.district,
      state: address.state || loc.state,
      pincode: address.pincode || loc.pincode,
      landmark: address.landmark || '',
    };
    db.customer_addresses.push(newAddress);
  }

  if (business) {
    const newBiz: BusinessDetails = {
      id: `SHP-${customerId}`,
      customer_id: customerId,
      shop_name: business.shop_name || personal.full_name,
      owner_name: personal.full_name,
      business_type: business.business_type || '',
      business_category: business.business_category || '',
      shop_mobile: business.shop_mobile || personal.mobile_number,
      shop_address: business.shop_address || address?.street || '',
      shop_area: business.shop_area || address?.area || '',
      shop_city: business.shop_city || address?.city || loc.city,
      shop_district: business.shop_district || address?.district || loc.district,
      shop_pincode: business.shop_pincode || address?.pincode || loc.pincode,
      landmark: business.landmark || '',
      years_in_business: Number(business.years_in_business) || 0,
      approx_monthly_income: Number(business.approx_monthly_income) || 0,
      approx_daily_sales: Number(business.approx_daily_sales) || 0,
      business_status: 'ACTIVE',
      ...(business.default_margin_percentage !== undefined && business.default_margin_percentage !== ''
        ? { default_margin_percentage: Number(business.default_margin_percentage) }
        : {}),
      shop_photo: business.shop_photo || '',
    };
    db.business_details.push(newBiz);
  }

  // Customer portal login
  const custUsername = String(username || customerId).trim();
  const custPassword = String(password || STARTING_PIN).trim();
  const custUser: User = {
    id: `USR-${customerId}`,
    username: custUsername,
    email: newCustomer.email || '',
    password: custPassword,
    role: 'CUSTOMER',
    customer_id: customerId,
    name: newCustomer.full_name,
    phone: newCustomer.mobile_number,
    is_active: true,
    created_at: now,
  };
  db.users.push(custUser);

  return newCustomer;
}

app.post('/api/customers', (req: Request, res: Response) => {
  const db = repository.getDb();
  const { personal, address, business, loan } = req.body;
  const loc = db.config.masters.default_location;

  if (!personal || !personal.full_name || !personal.mobile_number) {
    return res.status(400).json({ error: 'Customer full name and mobile number are required.' });
  }
  const newMobile = String(personal.mobile_number).replace(/\D/g, '').slice(-10);
  if (newMobile.length < 10) return res.status(400).json({ error: 'Enter a 10-digit mobile number.' });
  if (db.customers.some(c => c.mobile_number.replace(/\D/g, '').slice(-10) === newMobile)) {
    return res.status(400).json({ error: 'A customer with this mobile number already exists.' });
  }
  const wantedUser = String(req.body.username || '').trim().toLowerCase();
  if (wantedUser && db.users.some(u => u.username.toLowerCase() === wantedUser)) {
    return res.status(400).json({ error: 'This user ID is already taken.' });
  }

  const party: LoanParty = {
    shop_name: business?.shop_name,
    shop_area: business?.shop_area || address?.area,
    home_area: address?.area,
  };

  // Validate the loan before anything is written, so a rejected loan leaves no partial customer.
  let plannedLoan: PlannedLoan | null = null;
  if (loan && Number(loan.requested_amount) > 0) {
    try {
      plannedLoan = planLoan(db, loan as IssueLoanInput, party);
    } catch (err) {
      if (err instanceof LoanValidationError) return res.status(400).json({ error: err.message });
      throw err;
    }
  }

  const newCustomer = addCustomerRecords(db, { personal, address, business, username: req.body.username, password: req.body.password });
  const customerId = newCustomer.id;

  logAudit('admin', 'ADMIN', 'CREATE_CUSTOMER', customerId, 'customers', null, newCustomer);
  createNotification('ADMIN', 'New Customer Added', `Customer ${newCustomer.full_name} (${customerId}) registered successfully.`, 'SYSTEM', customerId);

  let newAccount: CollectionAccount | null = null;
  if (plannedLoan) {
    newAccount = commitLoan(db, plannedLoan, newCustomer, party);
    recordLoanIssued(newAccount);
  }

  repository.save();
  res.status(201).json({ ...newCustomer, activeAccount: newAccount });
});

app.put('/api/customers/:id', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const cust = db.customers.find(c => c.id === id);
  if (!cust) return res.status(404).json({ error: 'Customer not found' });

  const { personal: personalIn, address: addressIn, business: businessIn, username, password } = req.body;
  // The record's own keys never come from the screen.
  const strip = (o: any) => {
    if (!o || typeof o !== 'object') return undefined;
    const { id: _id, customer_id: _cid, created_at: _created, status: _status, ...rest } = o;
    return rest;
  };
  const personal = strip(personalIn);
  const address = strip(addressIn);
  const business = strip(businessIn);
  const oldVal = { ...cust };

  if (personal?.full_name !== undefined && !String(personal.full_name).trim()) {
    return res.status(400).json({ error: 'The customer name cannot be empty.' });
  }
  const mobile = personal?.mobile_number !== undefined ? String(personal.mobile_number).replace(/\D/g, '') : undefined;
  if (mobile !== undefined) {
    if (mobile.length < 10) return res.status(400).json({ error: 'Enter a 10-digit mobile number.' });
    if (db.customers.some(c => c.id !== id && c.mobile_number.replace(/\D/g, '').slice(-10) === mobile.slice(-10))) {
      return res.status(400).json({ error: 'Another customer already has this mobile number.' });
    }
  }
  const login = db.users.find(u => u.customer_id === id);
  if (username && db.users.some(u => u.id !== login?.id && u.username.toLowerCase() === String(username).trim().toLowerCase())) {
    return res.status(400).json({ error: 'This user ID is already taken.' });
  }
  if (business?.default_margin_percentage !== undefined) {
    const m = Number(business.default_margin_percentage);
    if (!Number.isFinite(m) || m < 0 || m >= 100) return res.status(400).json({ error: 'The usual margin must be between 0 and 100.' });
    business.default_margin_percentage = m;
  }

  if (personal) {
    Object.assign(cust, personal, { updated_at: new Date().toISOString() });
  }

  if (address) {
    let addr = db.customer_addresses.find(a => a.customer_id === id);
    if (addr) {
      Object.assign(addr, address);
    } else {
      db.customer_addresses.push({
        id: `ADDR-${id}`,
        customer_id: id,
        ...address,
      });
    }
  }

  if (business) {
    let biz = db.business_details.find(b => b.customer_id === id);
    if (biz) {
      Object.assign(biz, business);
    } else {
      db.business_details.push({
        id: `SHP-${id}`,
        customer_id: id,
        ...business,
      });
    }
  }

  // Update or create user credentials
  if (username || password || personal?.full_name || personal?.mobile_number) {
    let custUser = db.users.find(u => u.customer_id === id);
    if (custUser) {
      if (username) custUser.username = String(username).trim();
      if (password) custUser.password = String(password).trim();
      if (personal?.full_name) custUser.name = personal.full_name;
      if (personal?.mobile_number) custUser.phone = personal.mobile_number;
    } else if (username || password) {
      db.users.push({
        id: `USR-${id}`,
        username: String(username || id).trim(),
        email: cust.email || '',
        password: String(password || STARTING_PIN).trim(),
        role: 'CUSTOMER',
        customer_id: id,
        name: cust.full_name,
        phone: cust.mobile_number,
        is_active: cust.status === 'ACTIVE',
        created_at: cust.created_at || new Date().toISOString(),
      });
    }
  }

  // Loans and their day lists show the customer's current name, shop and phone (payments and
  // receipts keep what they were issued with).
  const shopName = db.business_details.find(b => b.customer_id === id)?.shop_name;
  for (const acc of db.collection_accounts.filter(a => a.customer_id === id)) {
    acc.customer_name = cust.full_name;
    if (shopName) acc.shop_name = shopName;
  }
  for (const rec of db.daily_collections.filter(d => d.customer_id === id)) {
    rec.customer_name = cust.full_name;
    rec.mobile_number = cust.mobile_number;
    if (shopName) rec.shop_name = shopName;
  }

  logAudit('admin', 'ADMIN', 'UPDATE_CUSTOMER', id, 'customers', oldVal, cust);
  repository.save();
  res.json(cust);
});

app.delete('/api/customers/:id', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const cust = db.customers.find(c => c.id === id);
  if (!cust) return res.status(404).json({ error: 'Customer not found' });

  cust.status = 'INACTIVE';
  cust.updated_at = new Date().toISOString();

  // Deactivate login
  const u = db.users.find(usr => usr.customer_id === id);
  if (u) {
    u.is_active = false;
    closeSessionsOf(u.id);
  }

  logAudit('admin', 'ADMIN', 'DEACTIVATE_CUSTOMER', id, 'customers', { status: 'ACTIVE' }, { status: 'INACTIVE' });
  repository.save();
  res.json({ message: 'Customer deactivated successfully' });
});

// Update Shop Default Finance Margin %
app.put('/api/customers/:id/business-margin', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const biz = db.business_details.find(b => b.customer_id === id);
  if (!biz) return res.status(404).json({ error: 'Shop details not found' });
  const margin = Number(req.body.default_margin_percentage);
  if (!Number.isFinite(margin) || margin < 0 || margin >= 100) {
    return res.status(400).json({ error: 'The usual margin must be between 0 and 100.' });
  }
  const oldMargin = biz.default_margin_percentage;
  biz.default_margin_percentage = margin;
  logAudit('admin', 'ADMIN', 'UPDATE_SHOP_MARGIN', biz.id, 'business_details', { default_margin: oldMargin }, { default_margin: biz.default_margin_percentage });
  repository.save();
  res.json(biz);
});

// -------------------------------------------------------------
// 4. CUSTOMER 360° VIEW & NOTES
// -------------------------------------------------------------
app.get('/api/customers/:id/360', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  refreshStatuses(db);

  const customer = db.customers.find(c => c.id === id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const address = db.customer_addresses.find(a => a.customer_id === id);
  const business = db.business_details.find(b => b.customer_id === id);
  const accounts = db.collection_accounts
    .filter(a => a.customer_id === id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const running = accounts.find(isRunning);
  const activeAccount = running ? withDaysBehind(running) : undefined;
  const latestAccount = accounts[0];
  const recentPayments = db.payments.filter(p => p.customer_id === id);
  const receipts = db.receipts.filter(r => r.customer_id === id);
  const documents = db.documents.filter(d => d.customer_id === id);
  const notes = db.customer_notes.filter(n => n.customer_id === id);
  const accountIds = new Set(accounts.map(a => a.id));
  const auditLogs = db.audit_logs.filter(l => l.record_id === id || accountIds.has(l.record_id));

  const totalRequested = accounts.reduce((s, a) => s + a.requested_amount, 0);
  const totalDisbursed = accounts.reduce((s, a) => s + a.disbursed_amount, 0);
  const totalRepayment = accounts.reduce((s, a) => s + a.total_repayment, 0);
  const totalCollected = accounts.reduce((s, a) => s + a.amount_collected, 0);
  const totalRemaining = accounts.reduce((s, a) => s + a.remaining_amount, 0);
  const completedDays = activeAccount ? activeAccount.completed_days : 0;
  const remainingDays = activeAccount ? activeAccount.remaining_days : 0;
  const overallPercentage = totalRepayment > 0 ? safeRound((totalCollected / totalRepayment) * 100, 1) : 0;

  const missedCount = db.daily_collections.filter(d => d.customer_id === id && d.status === 'MISSED').length;

  res.json({
    personal: customer,
    address,
    business,
    accounts,
    activeAccount,
    latestAccount,
    recentPayments,
    receipts,
    documents,
    notes,
    auditLogs,
    metrics: {
      totalRequested,
      totalDisbursed,
      totalRepayment,
      totalCollected,
      totalRemaining,
      completedDays,
      remainingDays,
      overallPercentage,
      missedCount,
      overdueDays: activeAccount?.days_behind ?? 0,
    },
  });
});

app.post('/api/customers/:id/notes', (req: Request, res: Response) => {
  const customer_id = getParam(req, 'id');
  const { note, created_by } = req.body;
  const db = repository.getDb();

  if (!note || !String(note).trim()) {
    return res.status(400).json({ error: 'Note content cannot be empty' });
  }

  const newNote: CustomerNote = {
    id: `NOTE-${Date.now()}`,
    customer_id,
    note: String(note).trim(),
    created_by: created_by || 'Admin',
    created_at: new Date().toISOString(),
  };

  db.customer_notes.unshift(newNote);
  logAudit(created_by || 'Admin', 'ADMIN', 'ADD_NOTE', customer_id, 'customer_notes', null, newNote);
  repository.save();

  res.status(201).json(newNote);
});

// -------------------------------------------------------------
// 5. CONFIGURATION (loan products, master lists, numbering, company)
// -------------------------------------------------------------
app.get('/api/config', (req: Request, res: Response) => {
  res.json(repository.getDb().config);
});

app.put('/api/config/:section', (req: Request, res: Response) => {
  const section = getParam(req, 'section') as ConfigSection;
  if (!CONFIG_SECTIONS.includes(section)) {
    return res.status(404).json({ error: `Unknown configuration section: ${section}` });
  }
  const db = repository.getDb();
  const previous = db.config[section];
  const value = req.body;
  const isArraySection = Array.isArray(previous);
  if (isArraySection !== Array.isArray(value) || value === null || typeof value !== 'object') {
    return res.status(400).json({ error: `Invalid value for configuration section "${section}".` });
  }

  if (section === 'loan_products') {
    const products = value as ConfigLoanProduct[];
    const ids = new Set<string>();
    for (const p of products) {
      if (!p.id || !p.name) return res.status(400).json({ error: 'Every loan product needs an ID and a name.' });
      if (ids.has(p.id)) return res.status(400).json({ error: `Duplicate loan product ID: ${p.id}` });
      ids.add(p.id);
      if (!(p.margin_percentage >= 0 && p.margin_percentage < 100)) return res.status(400).json({ error: `"${p.name}": margin % must be between 0 and 100.` });
      if (!Array.isArray(p.day_options) || p.day_options.length === 0 || p.day_options.some(d => !(d > 0))) {
        return res.status(400).json({ error: `"${p.name}": add at least one collection period.` });
      }
      if (!p.day_options.includes(p.default_days)) return res.status(400).json({ error: `"${p.name}": default days must be one of its collection periods.` });
      if (p.max_amount > 0 && p.min_amount > p.max_amount) return res.status(400).json({ error: `"${p.name}": minimum amount is above the maximum.` });
    }
    // Products already used by accounts cannot be removed, only deactivated.
    const removed = (previous as ConfigLoanProduct[]).filter(p => !ids.has(p.id));
    const inUse = removed.filter(p => db.collection_accounts.some(a => a.plan_id === p.id));
    if (inUse.length > 0) {
      return res.status(400).json({ error: `Cannot delete ${inUse.map(p => p.name).join(', ')}: used by existing accounts. Set it inactive instead.` });
    }
  }

  if (section === 'masters') {
    const m = value as Partial<MasterLists>;
    if (!Array.isArray(m.payment_modes) || m.payment_modes.length === 0) {
      return res.status(400).json({ error: 'Add at least one way to pay.' });
    }
    if (!Array.isArray(m.not_paid_reasons) || m.not_paid_reasons.length === 0) {
      return res.status(400).json({ error: 'Add at least one reason for "Not paid".' });
    }
    if (!(Number(m.not_paying_after_days) >= 1)) {
      return res.status(400).json({ error: '"Not paying" days must be 1 or more.' });
    }
    if (!(Number.isInteger(Number(m.long_pending_after_terms)) && Number(m.long_pending_after_terms) >= 1)) {
      return res.status(400).json({ error: '"Long pending" terms must be 1 or more.' });
    }
    m.long_pending_after_terms = Number(m.long_pending_after_terms);
    if (!(Number.isInteger(Number(m.report_send_limit)) && Number(m.report_send_limit) >= 1)) {
      return res.status(400).json({ error: 'Report sending limit must be 1 or more.' });
    }
    m.report_send_limit = Number(m.report_send_limit);
  }

  if (section === 'numbering') {
    // Counters never move backwards, even if the editor was opened before new IDs were issued.
    const current = previous as Numbering;
    for (const kind of Object.keys(current) as NumberingKind[]) {
      const rule = (value as Partial<Numbering>)[kind];
      if (rule) {
        rule.next = Math.max(current[kind].next, Number(rule.next) || 0);
        rule.pad = Math.max(1, Math.min(10, Number(rule.pad) || current[kind].pad));
      }
    }
  }

  (db.config as unknown as Record<string, unknown>)[section] = isArraySection ? value : { ...previous, ...value };
  logAudit('admin', 'ADMIN', 'UPDATE_CONFIG', section, 'config', previous, db.config[section]);
  repository.save();
  res.json(db.config);
});

// -------------------------------------------------------------
// 6. COLLECTION ACCOUNTS
// -------------------------------------------------------------
app.get('/api/collection-accounts', (req: Request, res: Response) => {
  const db = repository.getDb();
  refreshStatuses(db);
  res.json(db.collection_accounts.map(withDaysBehind));
});

/** Audit trail and notifications for a newly issued loan, including any product overrides. */
function recordLoanIssued(account: CollectionAccount) {
  logAudit('admin', 'ADMIN', 'DISBURSE_COLLECTION_ACCOUNT', account.id, 'collection_accounts', null, account);
  if (account.overrides && account.overrides.length > 0) {
    logAudit('admin', 'ADMIN', 'OVERRIDE_LOAN_TERMS', account.id, 'collection_accounts',
      { product: account.plan_id, terms: account.overrides.map(o => ({ [o.field]: o.product_value })) },
      { terms: account.overrides.map(o => ({ [o.field]: o.applied_value })) });
  }
  createNotification(
    'ADMIN',
    'New Collection Account Disbursed',
    `Account ${account.id} disbursed to ${account.customer_name}: ₹${account.disbursed_amount} disbursed for ₹${account.requested_amount} requested at ${account.margin_percentage}% margin.`,
    'ACCOUNT',
    account.customer_id
  );
  createNotification(
    'CUSTOMER',
    'Loan Account Activated',
    `Your collection account ${account.id} is active! ₹${account.disbursed_amount} disbursed. Daily collection: ₹${account.daily_collection} for ${account.collection_days} days.`,
    'ACCOUNT',
    account.customer_id
  );
}

app.post('/api/collection-accounts', (req: Request, res: Response) => {
  const db = repository.getDb();
  try {
    const account = createLoanAccount(db, req.body as IssueLoanInput);
    recordLoanIssued(account);
    repository.save();
    res.status(201).json(account);
  } catch (err) {
    if (err instanceof LoanValidationError) return res.status(400).json({ error: err.message });
    throw err;
  }
});

app.get('/api/collection-accounts/:id', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  refreshStatuses(db);
  const acc = db.collection_accounts.find(a => a.id === id);
  if (!acc) return res.status(404).json({ error: 'Collection account not found' });
  res.json(withDaysBehind(acc));
});

app.get('/api/collection-accounts/:id/schedule', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const schedule = db.daily_collections
    .filter(d => d.collection_account_id === id)
    .sort((a, b) => (a.collection_day_number || 0) - (b.collection_day_number || 0) || a.date.localeCompare(b.date));
  res.json(schedule);
});

// Only who collects and where can change on a running loan; money terms are fixed once issued.
app.put('/api/collection-accounts/:id', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const acc = db.collection_accounts.find(a => a.id === id);
  if (!acc) return res.status(404).json({ error: 'Collection account not found' });

  const { assigned_collector_id, collection_area } = req.body;
  const collector = assigned_collector_id ? db.collectors.find(c => c.id === assigned_collector_id) : undefined;
  if (assigned_collector_id && !collector) return res.status(400).json({ error: 'Collector not found' });
  if (!collector && !collection_area) return res.status(400).json({ error: 'Nothing to change' });

  const oldVal = { collector: acc.assigned_collector_id, area: acc.collection_area };
  if (collector) {
    acc.assigned_collector_id = collector.id;
    acc.assigned_collector_name = collector.name;
  }
  if (collection_area) acc.collection_area = collection_area;
  acc.updated_at = new Date().toISOString();

  // Days still to be collected move to the new collector / area.
  const todayStr = todayIso();
  db.daily_collections
    .filter(d => d.collection_account_id === acc.id && d.date >= todayStr && d.status === 'PENDING')
    .forEach(d => {
      d.collector_id = acc.assigned_collector_id;
      d.collector_name = acc.assigned_collector_name;
      d.collection_area = acc.collection_area;
    });

  logAudit('admin', 'ADMIN', 'UPDATE_COLLECTION_ACCOUNT', acc.id, 'collection_accounts', oldVal,
    { collector: acc.assigned_collector_id, area: acc.collection_area });
  repository.save();
  res.json(withDaysBehind(acc));
});

/**
 * BULK HAND-NOTE ENTRY / FAST UPLOAD FOR EXISTING CUSTOMERS (STRICTLY ADMIN ONLY)
 * Allows office admin to easily upload past collections from physical hand notebooks ("hand note" - கை நோட்டு).
 */
app.post('/api/collection-accounts/:id/bulk-hand-note', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const acc = db.collection_accounts.find(a => a.id === id);
  if (!acc) return res.status(404).json({ error: 'Collection account not found' });

  const role = actor()?.role || 'ADMIN';
  const by = byWho(req);

  // STRICT ACCESS: Only office administrators can record bulk hand-note entries!
  if (role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied: Only office administrators can upload hand note collections.' });
  }

  const {
    up_to_day,
    day_numbers,
    daily_amount,
    payment_mode,
    collector_id,
    remarks,
    overwrite_existing,
  } = req.body;

  const allDates = scheduleDates(acc.start_date, acc.collection_days);
  const targetDays: number[] = [];

  if (typeof up_to_day === 'number' && up_to_day >= 1) {
    const maxDay = Math.min(up_to_day, acc.collection_days);
    for (let d = 1; d <= maxDay; d++) targetDays.push(d);
  } else if (Array.isArray(day_numbers)) {
    day_numbers.forEach(d => {
      const n = Number(d);
      if (Number.isInteger(n) && n >= 1 && n <= acc.collection_days && !targetDays.includes(n)) {
        targetDays.push(n);
      }
    });
    targetDays.sort((a, b) => a - b);
  }

  if (targetDays.length === 0) {
    return res.status(400).json({ error: 'No valid collection days specified to record.' });
  }
  for (const dayNum of targetDays) {
    const closed = closedDayError(db, allDates[dayNum - 1]);
    if (closed) return res.status(400).json({ error: closed });
  }

  const collector = collector_id ? (db.collectors.find(c => c.id === collector_id) || {
    id: acc.assigned_collector_id,
    name: acc.assigned_collector_name,
  }) : {
    id: acc.assigned_collector_id,
    name: acc.assigned_collector_name,
  };

  const perDayAmount = (daily_amount && Number(daily_amount) > 0) ? safeRound(Number(daily_amount), 2) : acc.daily_collection;
  const payMode = payment_mode || db.config.masters.default_payment_mode;
  const handRemarks = remarks || 'Recorded from physical hand notebook (கை நோட்டு)';

  // Which days get a payment, and what that does to the balance, is checked before anything changes.
  const paidOn = (dateStr: string) => activePayments(db, acc.id).filter(p => p.collection_date === dateStr);
  const toRecord = targetDays
    .map(n => allDates[n - 1])
    .filter(dateStr => !!dateStr && (overwrite_existing || paidOn(dateStr).length === 0));
  if (toRecord.length === 0) {
    return res.status(400).json({ error: 'Every chosen day already has a payment.' });
  }
  if (toRecord.some(d => d > todayIso())) {
    return res.status(400).json({ error: 'Hand-note days cannot be after today.' });
  }
  for (const dateStr of toRecord) {
    const closed = closedDayError(db, dateStr);
    if (closed) return res.status(400).json({ error: closed });
  }
  const replaced = overwrite_existing ? toRecord.flatMap(paidOn) : [];
  const replacedTotal = safeRound(replaced.reduce((sum, p) => sum + p.amount_paid, 0), 2);
  const owed = safeRound(acc.total_repayment - (acc.amount_collected - replacedTotal), 2);
  const totalRecordedAmount = safeRound(perDayAmount * toRecord.length, 2);
  if (totalRecordedAmount > owed) {
    return res.status(400).json({ error: `These days add up to ₹${totalRecordedAmount}, more than the balance of ₹${owed}.` });
  }

  const now = new Date().toISOString();
  for (const p of replaced) {
    p.status = 'CANCELLED';
    p.cancelled_at = now;
    p.remarks = 'Replaced by bulk hand note upload';
    const r = db.receipts.find(x => x.payment_id === p.id || x.receipt_number === p.receipt_number);
    if (r) {
      r.status = 'CANCELLED';
      r.cancelled_at = now;
    }
  }

  let balance = owed;
  for (const dateStr of toRecord) {
    const receiptNum = nextId(db, 'receipt', db.receipts.map(r => r.receipt_number));
    const paymentId = `PAY-${uniqueSuffix()}`;
    const after = Math.max(0, safeRound(balance - perDayAmount, 2));
    db.payments.push({
      id: paymentId,
      receipt_number: receiptNum,
      collection_account_id: acc.id,
      customer_id: acc.customer_id,
      customer_name: acc.customer_name,
      shop_name: acc.shop_name || '',
      collection_date: dateStr,
      daily_due: acc.daily_collection,
      amount_paid: perDayAmount,
      advance_amount: 0,
      payment_mode: payMode,
      collector_id: collector.id,
      collector_name: collector.name,
      previous_balance: balance,
      remaining_balance: after,
      status: 'SUCCESS',
      remarks: handRemarks,
      created_at: now,
    });
    db.receipts.push({
      id: `REC-${uniqueSuffix()}`,
      receipt_number: receiptNum,
      payment_id: paymentId,
      collection_account_id: acc.id,
      customer_id: acc.customer_id,
      customer_name: acc.customer_name,
      shop_name: acc.shop_name || '',
      daily_due: acc.daily_collection,
      amount_paid: perDayAmount,
      payment_mode: payMode,
      previous_balance: balance,
      remaining_balance: after,
      collector_name: collector.name,
      date: dateStr,
      created_at: now,
      remarks: handRemarks,
    });
    balance = after;
  }

  syncLoan(db, acc, [...toRecord, ...replaced.map(p => p.collection_date)]);
  const recordedCount = toRecord.length;

  logAudit(by, role, 'BULK_HAND_NOTE_UPLOAD', acc.id, 'collection_accounts', null, {
    recorded_days: recordedCount,
    total_amount: totalRecordedAmount,
    new_collected: acc.amount_collected,
    new_balance: acc.remaining_amount,
  });

  repository.save();

  res.json({
    success: true,
    count: recordedCount,
    totalAmountRecorded: totalRecordedAmount,
    account: withDaysBehind(acc),
  });
});

// Cancel a loan issued by mistake. Only allowed before any payment has been taken.
app.delete('/api/collection-accounts/:id', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const acc = db.collection_accounts.find(a => a.id === id);
  if (!acc) return res.status(404).json({ error: 'Collection account not found' });
  if (!isRunning(acc)) return res.status(400).json({ error: 'This loan is already closed.' });
  if (db.payments.some(p => p.collection_account_id === id && isActivePayment(p))) {
    return res.status(400).json({ error: 'This loan already has payments, so it cannot be cancelled.' });
  }

  acc.status = 'CANCELLED';
  acc.updated_at = new Date().toISOString();
  // Drop the days that were only scheduled; keep any day that has a record of activity.
  db.daily_collections = db.daily_collections.filter(d => d.collection_account_id !== id || d.status !== 'PENDING');

  logAudit('admin', 'ADMIN', 'CANCEL_LOAN', id, 'collection_accounts', { status: 'ACTIVE' }, { status: 'CANCELLED' });
  repository.save();
  res.json({ message: 'Loan cancelled' });
});

// -------------------------------------------------------------
// 7. DAILY COLLECTION SCREEN & PAYMENT PROCESSING
// -------------------------------------------------------------
function get7DayHistory(accId: string, startDate: string, dateStr: string, db: any) {
  const history: Array<{
    date: string;
    amount: number;
    status: 'PAID' | 'MISSED' | 'PENDING' | 'BEFORE_START';
    mode?: string;
    receipt_number?: string;
    reason?: string;
  }> = [];

  for (let i = -6; i <= 0; i++) {
    const dIso = addDaysIso(dateStr, i);
    const payment = db.payments?.find((p: any) => p.collection_account_id === accId && p.collection_date === dIso && p.status !== 'CANCELLED');
    const dailyRec = db.daily_collections?.find((d: any) => d.collection_account_id === accId && d.date === dIso);

    if (payment) {
      history.push({
        date: dIso,
        amount: payment.amount_paid,
        status: 'PAID',
        mode: payment.payment_mode,
        receipt_number: payment.receipt_number,
      });
    } else if (dailyRec && dailyRec.paid_amount > 0) {
      history.push({
        date: dIso,
        amount: dailyRec.paid_amount,
        status: 'PAID',
        mode: dailyRec.payment_mode,
        receipt_number: dailyRec.receipt_number,
      });
    } else if (dailyRec && dailyRec.status === 'MISSED') {
      history.push({
        date: dIso,
        amount: 0,
        status: 'MISSED',
        reason: dailyRec.reason || 'Missed',
      });
    } else if (dIso === dateStr) {
      history.push({
        date: dIso,
        amount: 0,
        status: 'PENDING',
      });
    } else if (dIso < startDate) {
      history.push({
        date: dIso,
        amount: 0,
        status: 'BEFORE_START',
      });
    } else {
      history.push({
        date: dIso,
        amount: 0,
        status: 'MISSED',
        reason: 'Not paid',
      });
    }
  }
  return history;
}

/**
 * The working record of every loan being collected on a date (created on first use), plus loans
 * that closed or have not started but had a payment or "not paid" that day.
 */
function dayRecords(db: ReturnType<typeof repository.getDb>, dateStr: string): DailyCollectionRecord[] {
  refreshStatuses(db);
  const activeAccounts = db.collection_accounts.filter(a => isCollecting(a, dateStr));
  const collectingIds = new Set(activeAccounts.map(a => a.id));

  activeAccounts.forEach((acc, index) => {
    let rec = db.daily_collections.find(d => d.collection_account_id === acc.id && d.date === dateStr);
    
    // Terms pending and the balance as they stood that morning (later payments do not change them).
    const pos = dayPosition(db, acc, dateStr);
    const missedDays = pos.missedDays;
    const missedAmount = pos.missedAmount;

    if (!rec) {
      const cust = db.customers.find(c => c.id === acc.customer_id);
      rec = {
        id: `DC-${dateStr}-${acc.id}`,
        collection_account_id: acc.id,
        customer_id: acc.customer_id,
        customer_name: acc.customer_name,
        shop_name: acc.shop_name || '',
        mobile_number: cust?.mobile_number || '',
        date: dateStr,
        daily_due: acc.daily_collection,
        paid_amount: 0,
        pending_amount: pos.due,
        advance_amount: 0,
        status: 'PENDING',
        collector_id: acc.assigned_collector_id,
        collector_name: acc.assigned_collector_name,
        collection_area: acc.collection_area,
        balance_remaining: pos.balanceAfter,
        route_order: index + 1,
        missed_days_count: missedDays,
        missed_amount: missedAmount,
      };
      db.daily_collections.push(rec);
    } else {
      rec.route_order = rec.route_order || (index + 1);
    }
    // Paid, pending, standing and balances from the payments, the same as after every change.
    syncDayRecord(db, acc, dateStr, undefined, rec);
  });

  // Loans that closed or have not started only appear if something happened on that day.
  return db.daily_collections.filter(
    d => d.date === dateStr && (collectingIds.has(d.collection_account_id) || d.paid_amount > 0 || d.status === 'MISSED')
  );
}

app.get('/api/daily-collections', (req: Request, res: Response) => {
  const db = repository.getDb();
  const dateStr = (req.query.date as string) || todayIso();
  const area = req.query.area as string;
  const street = req.query.street as string;
  const collector = req.query.collector as string;
  const status = req.query.status as string;
  const search = String(req.query.search || '').toLowerCase().trim();

  const records = dayRecords(db, dateStr);

  // Enrich with customer address, business details, whatsapp, and 7-day history
  let enriched = records.map(rec => {
    const cust = db.customers.find(c => c.id === rec.customer_id);
    const addr = db.customer_addresses?.find(a => a.customer_id === rec.customer_id);
    const biz = db.business_details?.find(b => b.customer_id === rec.customer_id);
    const acc = db.collection_accounts.find(a => a.id === rec.collection_account_id);

    const streetName = biz?.shop_address || addr?.street || rec.collection_area || '';
    const landmark = biz?.landmark || addr?.landmark || '';
    const shopAddress = biz?.shop_address || addr?.street || '';
    const whatsapp = cust?.whatsapp_number || cust?.mobile_number || rec.mobile_number || '';

    return {
      ...rec,
      street: streetName,
      landmark: landmark,
      shop_address: shopAddress,
      whatsapp_number: whatsapp,
      recent_history: get7DayHistory(rec.collection_account_id, acc?.start_date || rec.date, dateStr, db),
    };
  });

  if (area && area !== 'ALL') {
    enriched = enriched.filter(r => r.collection_area === area);
  }
  if (street && street !== 'ALL') {
    enriched = enriched.filter(r => r.street === street || r.collection_area === street);
  }
  if (collector && collector !== 'ALL') {
    enriched = enriched.filter(r => r.collector_id === collector || r.collector_name === collector);
  }
  if (status === 'MISSED_DAYS') {
    enriched = enriched.filter(r => (r.missed_days_count || 0) > 0);
  } else if (status && status !== 'ALL') {
    enriched = enriched.filter(r => r.status === status);
  }
  if (search) {
    enriched = enriched.filter(r =>
      r.customer_id.toLowerCase().includes(search) ||
      r.customer_name.toLowerCase().includes(search) ||
      r.shop_name.toLowerCase().includes(search) ||
      r.mobile_number.includes(search) ||
      (r.street && r.street.toLowerCase().includes(search)) ||
      (r.landmark && r.landmark.toLowerCase().includes(search))
    );
  }

  // Sort by route_order by default
  enriched.sort((a, b) => (a.route_order || 9999) - (b.route_order || 9999));

  res.json(enriched);
});

/** Why a day's collections cannot change: the office closed that day's business. */
function closedDayError(db: ReturnType<typeof repository.getDb>, date: string): string | null {
  const closing = activeClosing(db.day_closings, date);
  return closing ? `The business of ${date} was closed by ${closing.closed_by}. Reopen the day on Home to change it.` : null;
}

app.get('/api/daily-collections/assignment', (req: Request, res: Response) => {
  const dateStr = (req.query.date as string) || todayIso();
  const assignment = repository.getDb().day_assignments?.find(a => a.date === dateStr);
  res.json({ assigned: !!assignment, ...assignment });
});

/**
 * The office assigns today's work, which lets collectors start. `changes` move customers to another
 * collector for today only; the loan keeps its usual collector for the following days.
 */
app.post('/api/daily-collections/assign', (req: Request, res: Response) => {
  const db = repository.getDb();
  const { changes, assigned_by } = (req.body || {}) as {
    changes?: Array<{ collection_account_id: string; collector_id: string }>;
    assigned_by?: string;
  };
  const date = todayIso();
  const closed = closedDayError(db, date);
  if (closed) return res.status(400).json({ error: closed });
  const records = dayRecords(db, date);

  for (const change of changes ?? []) {
    const record = records.find(r => r.collection_account_id === change.collection_account_id);
    const collector = db.collectors.find(c => c.id === change.collector_id && c.status === 'ACTIVE');
    if (!record) return res.status(404).json({ error: 'This customer is not in today\'s work.' });
    if (!collector) return res.status(400).json({ error: 'Choose a working collector.' });
    if (record.paid_amount > 0 && record.collector_id !== collector.id) {
      return res.status(400).json({ error: `${record.customer_name} has already paid today and cannot be moved.` });
    }
  }
  for (const change of changes ?? []) {
    const record = records.find(r => r.collection_account_id === change.collection_account_id)!;
    const collector = db.collectors.find(c => c.id === change.collector_id)!;
    record.collector_id = collector.id;
    record.collector_name = collector.name;
  }

  if (!db.day_assignments) db.day_assignments = [];
  const assignedBy = String(assigned_by || 'Office');
  const assignedAt = new Date().toISOString();
  let assignment = db.day_assignments.find(a => a.date === date);
  if (assignment) {
    assignment.assigned_by = assignedBy;
    assignment.assigned_at = assignedAt;
  } else {
    assignment = { date, assigned_by: assignedBy, assigned_at: assignedAt };
    db.day_assignments.push(assignment);
  }
  logAudit(assignedBy, 'ADMIN', 'ASSIGN_DAY_WORK', date, 'day_assignments', null, { changes: changes ?? [] });
  repository.save();
  res.json({ assigned: true, ...assignment });
});

app.post('/api/daily-collections/reorder-route', (req: Request, res: Response) => {
  const db = repository.getDb();
  const { items } = req.body as { items: Array<{ id: string; route_order: number }> };
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'Items array is required' });
  }

  items.forEach(item => {
    const rec = db.daily_collections.find(d => d.id === item.id);
    if (rec) {
      rec.route_order = item.route_order;
    }
  });

  repository.save();
  res.json({ ok: true });
});

/**
 * COLLECT PAYMENT (Supports Regular, Partial, Advance, Missed)
 */
app.post('/api/daily-collections/collect', (req: Request, res: Response) => {
  const db = repository.getDb();
  const {
    collection_account_id,
    collection_date,
    amount_paid,
    payment_mode,
    collector_id,
    reason,
    remarks,
    is_missed,
    transaction_ref,
    razorpay_payment_id,
  } = req.body;

  const resolvedTxRef = transaction_ref || razorpay_payment_id || undefined;
  const dateStr = collection_date || todayIso();
  const paid = is_missed ? 0 : safeRound(Number(amount_paid), 2);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || dateStr > todayIso()) {
    return res.status(400).json({ error: 'A collection cannot be entered for a future date.' });
  }
  const closed = closedDayError(db, dateStr);
  if (closed) return res.status(400).json({ error: closed });

  const account = db.collection_accounts.find(a => a.id === collection_account_id);
  if (!account) {
    return res.status(404).json({ error: 'Collection account not found' });
  }
  // A collector collects only from customers on their own list for that day.
  const who = actor();
  if (who?.role === 'COLLECTOR') {
    const record = db.daily_collections.find(d => d.collection_account_id === account.id && d.date === dateStr);
    if (dateStr !== todayIso() || !record || record.collector_id !== who.collector_id) {
      return res.status(403).json({ error: 'This customer is not on your list today.' });
    }
  }
  if (!isRunning(account)) {
    return res.status(400).json({ error: 'This loan is closed.' });
  }
  if (dateStr < account.start_date) {
    return res.status(400).json({ error: 'This loan had not started on that date.' });
  }
  if (!is_missed && (!Number.isFinite(paid) || paid <= 0)) {
    return res.status(400).json({ error: 'Enter a valid amount.' });
  }
  if (paid > account.remaining_amount) {
    return res.status(400).json({ error: `The amount is more than the balance (₹${account.remaining_amount}).` });
  }
  // One collection per customer per day: a wrong entry is undone first, then collected again.
  if (activePayments(db, account.id).some(p => p.collection_date === dateStr)) {
    return res.status(409).json({ error: 'Already collected for this day. Undo it first to change it.' });
  }

  const collector = db.collectors.find(c => c.id === collector_id) || {
    id: account.assigned_collector_id,
    name: account.assigned_collector_name,
  };
  const mode = payment_mode || db.config.masters.default_payment_mode;
  const pos = dayPosition(db, account, dateStr);
  const prevBalance = account.remaining_amount;
  let createdReceipt: Receipt | null = null;

  if (paid > 0) {
    const standing = payStanding(paid, pos);
    const receiptNum = nextId(db, 'receipt', db.receipts.map(r => r.receipt_number));
    const paymentId = `PAY-${uniqueSuffix()}`;
    const newBalance = Math.max(0, safeRound(prevBalance - paid, 2));
    const createdAt = new Date().toISOString();
    db.payments.push({
      id: paymentId,
      receipt_number: receiptNum,
      collection_account_id: account.id,
      customer_id: account.customer_id,
      customer_name: account.customer_name,
      shop_name: account.shop_name || '',
      collection_date: dateStr,
      daily_due: account.daily_collection,
      amount_paid: paid,
      advance_amount: standing.advance,
      payment_mode: mode,
      collector_id: collector.id,
      collector_name: collector.name,
      previous_balance: prevBalance,
      remaining_balance: newBalance,
      status: standing.status === 'ADVANCE' ? 'ADVANCE' : standing.status === 'PARTIAL' ? 'PARTIAL' : 'SUCCESS',
      transaction_ref: resolvedTxRef,
      remarks,
      created_at: createdAt,
    });
    createdReceipt = {
      id: `REC-${uniqueSuffix()}`,
      receipt_number: receiptNum,
      payment_id: paymentId,
      collection_account_id: account.id,
      customer_id: account.customer_id,
      customer_name: account.customer_name,
      shop_name: account.shop_name || '',
      daily_due: account.daily_collection,
      amount_paid: paid,
      payment_mode: mode,
      transaction_ref: resolvedTxRef,
      previous_balance: prevBalance,
      remaining_balance: newBalance,
      collector_name: collector.name,
      date: dateStr,
      created_at: createdAt,
      remarks: remarks || 'Thank you for your prompt payment.',
    };
    db.receipts.push(createdReceipt);
  }

  syncLoan(db, account, [dateStr]);
  // The day's record (created when the day's list was first opened, or now).
  let dailyRecord = db.daily_collections.find(d => d.collection_account_id === account.id && d.date === dateStr);
  if (!dailyRecord) {
    dayRecords(db, dateStr);
    dailyRecord = db.daily_collections.find(d => d.collection_account_id === account.id && d.date === dateStr)!;
  }
  dailyRecord.collector_id = collector.id;
  dailyRecord.collector_name = collector.name;
  dailyRecord.reason = paid > 0 ? undefined : reason;
  dailyRecord.remarks = remarks;
  if (paid === 0) {
    dailyRecord.status = 'MISSED';
    dailyRecord.pending_amount = pos.due;
  }

  if (paid > 0) {
    createNotification(
      'CUSTOMER',
      `Payment Received: ₹${paid}`,
      `Received ₹${paid} for account ${account.id}. Balance remaining: ₹${account.remaining_amount}. Receipt #${createdReceipt!.receipt_number}`,
      'PAYMENT',
      account.customer_id
    );
    logAudit(collector.name, 'COLLECTOR', 'COLLECT_PAYMENT', account.id, 'payments', { balance: prevBalance }, { paid, newBalance: account.remaining_amount, receiptNum: createdReceipt!.receipt_number });
  } else {
    createNotification(
      'ADMIN',
      `Missed Collection: ${account.customer_name}`,
      `Collection missed for account ${account.id} on ${dateStr}. Reason: ${reason || 'Not specified'}.`,
      'MISSED',
      account.customer_id
    );
    logAudit(collector.name, 'COLLECTOR', 'MISSED_COLLECTION', account.id, 'daily_collections', null, { date: dateStr, reason, remarks });
  }

  repository.save();
  res.json({ success: true, dailyRecord, account, receipt: createdReceipt });
});

// -------------------------------------------------------------
// 8. PAYMENTS & RECEIPTS
// -------------------------------------------------------------
app.get('/api/payments', (req: Request, res: Response) => {
  const db = repository.getDb();
  const search = String(req.query.search || '').toLowerCase().trim();
  const mode = req.query.mode as string;
  const customerId = req.query.customer_id as string;

  let list = [...db.payments].reverse();

  if (customerId) {
    list = list.filter(p => p.customer_id === customerId);
  }
  if (mode && mode !== 'ALL') {
    list = list.filter(p => p.payment_mode === mode);
  }
  if (search) {
    list = list.filter(p =>
      p.receipt_number.toLowerCase().includes(search) ||
      p.customer_name.toLowerCase().includes(search) ||
      p.shop_name.toLowerCase().includes(search) ||
      p.collection_account_id.toLowerCase().includes(search)
    );
  }

  res.json(list);
});

app.get('/api/receipts', (req: Request, res: Response) => {
  const db = repository.getDb();
  const customerId = req.query.customer_id as string;
  let list = [...db.receipts].reverse();
  if (customerId) {
    list = list.filter(r => r.customer_id === customerId);
  }
  res.json(list);
});

app.get('/api/receipts/:id', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const receipt = db.receipts.find(r => r.id === id || r.receipt_number === id);
  if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
  res.json(receipt);
});

/**
 * MODIFY / EDIT A CUSTOMER PAYMENT TRANSACTION (STRICTLY ADMIN ONLY)
 * Admin can adjust amount_paid, collection_date (past or future month), payment_mode, collector, and remarks.
 */
app.put('/api/payments/:id', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const payment = db.payments.find(p => p.id === id || p.receipt_number === id);
  if (!payment) return res.status(404).json({ error: 'Payment record not found' });
  if (!isActivePayment(payment)) return res.status(400).json({ error: 'Cannot modify a cancelled payment' });

  const role = actor()?.role || 'ADMIN';
  const by = byWho(req);

  // STRICT RULE: ONLY ADMIN can modify customer payment history!
  if (role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied: Only office administrators can modify payment history.' });
  }

  const account = db.collection_accounts.find(a => a.id === payment.collection_account_id);
  if (!account) return res.status(404).json({ error: 'Collection loan account not found' });

  const oldAmount = payment.amount_paid;
  const oldDate = payment.collection_date;
  const oldMode = payment.payment_mode;

  const newAmount = req.body.amount_paid !== undefined ? safeRound(Number(req.body.amount_paid), 2) : oldAmount;
  const newDate = (req.body.collection_date || oldDate).trim();
  const newMode = req.body.payment_mode || oldMode;
  const newRemarks = req.body.remarks !== undefined ? req.body.remarks : payment.remarks;
  const closed = closedDayError(db, oldDate) || closedDayError(db, newDate);
  if (closed) return res.status(400).json({ error: closed });
  const collectorId = req.body.collector_id || payment.collector_id;
  const collectorName = req.body.collector_name || (collectorId ? db.collectors.find(c => c.id === collectorId)?.name : payment.collector_name) || payment.collector_name;

  if (!Number.isFinite(newAmount) || newAmount <= 0) {
    return res.status(400).json({ error: 'Please enter a valid positive payment amount.' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate) || newDate > todayIso()) {
    return res.status(400).json({ error: 'A payment cannot be dated in the future.' });
  }
  if (newDate < account.start_date) {
    return res.status(400).json({ error: `This loan started on ${account.start_date}; a payment cannot be dated before that.` });
  }
  if (newDate !== oldDate && activePayments(db, account.id).some(p => p.collection_date === newDate)) {
    return res.status(409).json({ error: 'That day already has a payment. Edit or undo that one instead.' });
  }

  // Ensure new amount does not exceed the total repayment minus other payments
  const otherPaymentsTotal = db.payments
    .filter(p => p.collection_account_id === account.id && p.id !== payment.id && isActivePayment(p))
    .reduce((s, p) => s + p.amount_paid, 0);

  const maxAllowed = safeRound(account.total_repayment - otherPaymentsTotal, 2);
  if (newAmount > maxAllowed) {
    return res.status(400).json({ error: `Amount cannot exceed maximum remaining loan limit of ₹${maxAllowed}` });
  }

  // Update payment object
  payment.amount_paid = newAmount;
  payment.collection_date = newDate;
  payment.payment_mode = newMode;
  payment.collector_id = collectorId;
  payment.collector_name = collectorName;
  payment.remarks = newRemarks;
  (payment as any).updated_at = new Date().toISOString();
  (payment as any).modified_by_admin = by;

  // Update corresponding receipt
  const receipt = db.receipts.find(r => r.payment_id === payment.id || r.receipt_number === payment.receipt_number);
  if (receipt) {
    receipt.amount_paid = newAmount;
    receipt.date = newDate;
    receipt.payment_mode = newMode;
    receipt.collector_name = collectorName;
    receipt.remarks = newRemarks;
    (receipt as any).updated_at = new Date().toISOString();
  }

  // The loan, its status and the day records of both dates (and the days after) follow the payments.
  syncLoan(db, account, [oldDate, newDate]);
  const standing = payStanding(newAmount, dayPosition(db, account, newDate));
  payment.advance_amount = standing.advance;
  payment.status = standing.status === 'ADVANCE' ? 'ADVANCE' : standing.status === 'PARTIAL' ? 'PARTIAL' : 'SUCCESS';
  const editedPos = dayPosition(db, account, newDate);
  payment.previous_balance = editedPos.morningBalance;
  payment.remaining_balance = editedPos.balanceAfter;
  if (receipt) receipt.previous_balance = payment.previous_balance;
  if (receipt) receipt.remaining_balance = payment.remaining_balance;

  logAudit(by, 'ADMIN', 'EDIT_PAYMENT', account.id, 'payments',
    { amount: oldAmount, date: oldDate, mode: oldMode },
    { amount: newAmount, date: newDate, mode: newMode }
  );

  repository.save();
  res.json({ success: true, payment, account: withDaysBehind(account) });
});

/**
 * UNDO A PAYMENT.
 * Admin can undo payments from ANY date (past months before or current/future dates).
 * Field collectors can only undo today's payment.
 */
app.post('/api/payments/:id/undo', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const payment = db.payments.find(p => p.id === id || p.receipt_number === id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  if (!isActivePayment(payment)) return res.status(400).json({ error: 'This payment was already undone.' });

  // Who undoes it and with what rights comes from the sign-in, never from the request.
  const who = actor();
  const by = who?.name || byWho(req);
  const role = who?.role || 'ADMIN';
  const isAdmin = role === 'ADMIN';

  const closed = closedDayError(db, payment.collection_date);
  if (closed) return res.status(400).json({ error: closed });

  // Collectors undo only their own payments, and only today's; the office can undo any date.
  if (!isAdmin && payment.collector_id !== who?.collector_id) {
    return res.status(403).json({ error: 'You can only undo your own collections.' });
  }
  if (!isAdmin && payment.collection_date !== todayIso()) {
    return res.status(400).json({ error: "Only today's payments can be undone by collectors. Office admin can undo any date." });
  }

  const account = db.collection_accounts.find(a => a.id === payment.collection_account_id);
  if (!account) return res.status(404).json({ error: 'Collection account not found' });

  const balanceBefore = account.remaining_amount;
  const now = new Date().toISOString();
  payment.status = 'CANCELLED';
  payment.cancelled_at = now;
  const receipt = db.receipts.find(r => r.payment_id === payment.id || r.receipt_number === payment.receipt_number);
  if (receipt) {
    receipt.status = 'CANCELLED';
    receipt.cancelled_at = now;
  }

  syncLoan(db, account, [payment.collection_date]);
  const dailyRecord = db.daily_collections.find(
    d => d.collection_account_id === account.id && d.date === payment.collection_date
  );
  if (dailyRecord && dailyRecord.paid_amount === 0) dailyRecord.remarks = 'Payment undone';

  logAudit(by, role, 'UNDO_PAYMENT', account.id, 'payments',
    { receipt: payment.receipt_number, paid: payment.amount_paid, balance: balanceBefore },
    { balance: account.remaining_amount });
  createNotification(
    'CUSTOMER',
    `Payment cancelled: ₹${payment.amount_paid}`,
    `Receipt #${payment.receipt_number} was cancelled. Balance: ₹${account.remaining_amount}.`,
    'PAYMENT',
    account.customer_id
  );
  repository.save();
  res.json({ success: true, account: withDaysBehind(account), dailyRecord });
});

// -------------------------------------------------------------
// 9. MONTHLY EXCEL REPORT MATRIX
// -------------------------------------------------------------
// -------------------------------------------------------------
// COLLECTOR DAY REPORTS (tally of the app's figures against the cash the collector holds)
// -------------------------------------------------------------
app.get('/api/collector-reports', (req: Request, res: Response) => {
  const db = repository.getDb();
  const { date, collector_id, status } = req.query as Record<string, string | undefined>;
  const list = (db.collector_reports || []).filter(
    r => (!date || r.date === date) && (!collector_id || r.collector_id === collector_id) && (!status || r.status === status)
  );
  res.json(list.sort((a, b) => b.created_at.localeCompare(a.created_at)));
});

/**
 * The collector sends today's report. The figures are worked out here from the records, never taken
 * from the phone; only the counted cash comes from the collector. Up to the configured limit a report
 * is accepted straight away; after that it is a correction that waits for the office to approve it.
 */
app.post('/api/collector-reports', (req: Request, res: Response) => {
  const db = repository.getDb();
  const { collector_id, cash_notes, coins, note } = req.body || {};
  const collector = db.collectors.find(c => c.id === collector_id);
  if (!collector) return res.status(404).json({ error: 'Collector not found' });

  const date = todayIso();
  const closed = closedDayError(db, date);
  if (closed) return res.status(400).json({ error: closed });
  const records = dayRecords(db, date).filter(r => r.collector_id === collector.id);
  const summary = collectionDaySummary(records);
  const accountIds = new Set(records.map(r => r.collection_account_id));
  const todaysPayments = db.payments.filter(
    p => isActivePayment(p) && p.collection_date === date && accountIds.has(p.collection_account_id)
  );
  const cashInApp = safeRound(todaysPayments.filter(p => isCashMode(p.payment_mode)).reduce((s, p) => s + p.amount_paid, 0), 2);
  const upiInApp = safeRound(todaysPayments.filter(p => !isCashMode(p.payment_mode)).reduce((s, p) => s + p.amount_paid, 0), 2);

  const notes: Record<string, number> = {};
  for (const n of CASH_NOTES) notes[n] = Math.max(0, Math.floor(Number(cash_notes?.[n]) || 0));
  const coinAmount = Math.max(0, safeRound(Number(coins) || 0, 2));
  const cashCounted = countedCash(notes, coinAmount);
  const grandTotal = safeRound(cashCounted + upiInApp, 2);

  if (!db.collector_reports) db.collector_reports = [];
  const sentToday = db.collector_reports.filter(r => r.collector_id === collector.id && r.date === date).length;
  const attempt = sentToday + 1;
  const withinLimit = attempt <= db.config.masters.report_send_limit;

  const report: CollectorReport = {
    id: `CR-${date}-${collector.id}-${attempt}`,
    date,
    collector_id: collector.id,
    collector_name: collector.name,
    attempt,
    status: withinLimit ? 'ACCEPTED' : 'PENDING_APPROVAL',
    summary,
    cash_in_app: cashInApp,
    upi_in_app: upiInApp,
    cash_notes: notes,
    coins: coinAmount,
    cash_counted: cashCounted,
    grand_total: grandTotal,
    difference: safeRound(grandTotal - summary.collected, 2),
    note: String(note || '').trim() || undefined,
    created_at: new Date().toISOString(),
  };
  db.collector_reports.push(report);

  const tally = report.difference === 0
    ? 'matches the app'
    : `is ₹${Math.abs(report.difference).toLocaleString('en-IN')} ${report.difference < 0 ? 'short' : 'extra'}`;
  db.notifications.unshift({
    id: `NOTIF-${Date.now()}-R`,
    recipient_role: 'ADMIN',
    type: 'ACCOUNT',
    title: withinLimit ? 'Collector report received' : 'Collector report correction to approve',
    message: `${collector.name}: collected ₹${summary.collected.toLocaleString('en-IN')} of ₹${summary.expected.toLocaleString('en-IN')}; cash + UPI ${tally}.`,
    is_read: false,
    created_at: report.created_at,
  });
  logAudit(collector.name, 'COLLECTOR', 'SEND_COLLECTOR_REPORT', report.id, 'collector_reports', null, report);
  repository.save();
  res.status(201).json(report);
});

app.post('/api/collector-reports/:id/decision', (req: Request, res: Response) => {
  const db = repository.getDb();
  const report = (db.collector_reports || []).find(r => r.id === getParam(req, 'id'));
  if (!report) return res.status(404).json({ error: 'Report not found' });
  if (report.status !== 'PENDING_APPROVAL') return res.status(400).json({ error: 'This report does not need approval.' });
  const decision = req.body?.decision;
  if (decision !== 'APPROVED' && decision !== 'REJECTED') return res.status(400).json({ error: 'Choose approve or reject.' });

  const previous = { ...report };
  report.status = decision;
  report.decided_by = byWho(req);
  report.decided_at = new Date().toISOString();
  if (decision === 'APPROVED') {
    report.verified_by = report.decided_by;
    report.verified_at = report.decided_at;
  }
  logAudit(report.decided_by, 'ADMIN', `${decision}_COLLECTOR_REPORT`, report.id, 'collector_reports', previous, report);
  repository.save();
  res.json(report);
});

/** The office checked a report against the cash handed over. Only the newest report in force can be verified. */
app.post('/api/collector-reports/:id/verify', (req: Request, res: Response) => {
  const db = repository.getDb();
  const reports = db.collector_reports || [];
  const report = reports.find(r => r.id === getParam(req, 'id'));
  if (!report) return res.status(404).json({ error: 'Report not found' });
  if (report.verified_at) return res.status(400).json({ error: `Already verified by ${report.verified_by}.` });
  if (!canVerify(report, reports)) {
    return res.status(400).json({
      error: report.status === 'PENDING_APPROVAL' ? 'Approve or reject this correction instead.' : 'A newer report was sent. Verify that one.',
    });
  }
  const previous = { ...report };
  report.verified_by = byWho(req);
  report.verified_at = new Date().toISOString();
  logAudit(report.verified_by, 'ADMIN', 'VERIFY_COLLECTOR_REPORT', report.id, 'collector_reports', previous, report);
  repository.save();
  res.json(report);
});

// -------------------------------------------------------------
// DAY CLOSING (the office formally closes a day's business once every report is verified)
// -------------------------------------------------------------
app.get('/api/day-closings', (req: Request, res: Response) => {
  const { date } = req.query as Record<string, string | undefined>;
  const list = (repository.getDb().day_closings || []).filter(c => !date || c.date === date);
  res.json([...list].sort((a, b) => b.closed_at.localeCompare(a.closed_at)));
});

/**
 * Closes today's business. Every collector with work today must have sent a report, with no correction
 * waiting and nothing collected since, and the office must have verified it. The closing keeps each
 * collector's verified figures; the day's collections are then locked.
 */
app.post('/api/day-closings', (req: Request, res: Response) => {
  const db = repository.getDb();
  const date = todayIso();
  const by = byWho(req);
  if (activeClosing(db.day_closings, date)) return res.status(400).json({ error: 'Today is already closed.' });
  if (!db.day_assignments?.some(a => a.date === date)) return res.status(400).json({ error: "Today's work was not assigned." });

  const records = dayRecords(db, date);
  const checks = dayCloseChecks(date, records, db.collector_reports || []);
  if (checks.length === 0) return res.status(400).json({ error: 'There is no collection today.' });
  const reasons: Record<string, string> = {
    'not-sent': 'has not sent the report',
    'correction-waiting': 'has a correction waiting for approval',
    changed: 'collected more after the report; a correction is needed',
    'to-verify': 'report is not verified yet',
  };
  const notReady = (Object.keys(reasons) as CloseState[]).map(state => checks.find(c => c.state === state)).find(Boolean);
  if (notReady) return res.status(400).json({ error: `${notReady.collector_name} ${reasons[notReady.state]}.` });

  const collectors: DayClosingCollector[] = checks.map(({ collector_id, collector_name, report }) => {
    const longPending = longPendingCounts(records.filter(r => r.collector_id === collector_id), db.config.masters.long_pending_after_terms);
    return {
      collector_id,
      collector_name,
      report_id: report!.id,
      customers_assigned: report!.summary.customersAssigned,
      customers_paid: report!.summary.customersPaid,
      expected: report!.summary.expected,
      collected: report!.summary.collected,
      balance: report!.summary.pendingAmount,
      long_pending: longPending.total,
      long_pending_unpaid: longPending.pending,
      cash_in_app: report!.cash_in_app,
      upi_in_app: report!.upi_in_app,
      cash_counted: report!.cash_counted,
      verified_by: report!.verified_by,
    };
  });
  if (!db.day_closings) db.day_closings = [];
  const closing: DayClosing = {
    id: `DCL-${date}-${db.day_closings.filter(c => c.date === date).length + 1}`,
    date,
    closed_at: new Date().toISOString(),
    closed_by: by,
    collectors,
    totals: closingTotals(collectors),
    note: String(req.body?.note || '').trim() || undefined,
  };
  db.day_closings.push(closing);
  logAudit(by, 'ADMIN', 'CLOSE_DAY', closing.id, 'day_closings', null, closing);
  repository.save();
  res.status(201).json(closing);
});

/** Opens a closed day again so its collections can change; the closing stays on record as reopened. */
app.post('/api/day-closings/:id/reopen', (req: Request, res: Response) => {
  const db = repository.getDb();
  const closing = (db.day_closings || []).find(c => c.id === getParam(req, 'id'));
  if (!closing) return res.status(404).json({ error: 'Closing not found' });
  if (closing.reopened_at) return res.status(400).json({ error: 'This day was already reopened.' });
  const previous = { ...closing };
  closing.reopened_by = byWho(req);
  closing.reopened_at = new Date().toISOString();
  logAudit(closing.reopened_by, 'ADMIN', 'REOPEN_DAY', closing.id, 'day_closings', previous, closing);
  repository.save();
  res.json(closing);
});

app.get('/api/reports/monthly', (req: Request, res: Response) => {
  const db = repository.getDb();
  refreshStatuses(db);
  const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
  const year = parseInt(req.query.year as string) || new Date().getFullYear();
  const collector = req.query.collector as string;
  const area = req.query.area as string;
  const customerId = req.query.customer_id as string;
  const status = req.query.status as string;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = monthNames[month - 1] || 'Current Month';
  const daysInMonth = new Date(year, month, 0).getDate();

  // Filter accounts
  let accounts = db.collection_accounts;
  if (collector && collector !== 'ALL') {
    accounts = accounts.filter(a => a.assigned_collector_id === collector || a.assigned_collector_name === collector);
  }
  if (area && area !== 'ALL') {
    accounts = accounts.filter(a => a.collection_area === area);
  }
  if (customerId && customerId !== 'ALL') {
    accounts = accounts.filter(a => a.customer_id === customerId);
  }
  if (status && status !== 'ALL') {
    accounts = accounts.filter(a => a.status === status);
  }

  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const { start: monthStart } = monthBounds(monthPrefix);
  // Loans that belong to the month: due on some of its days, or paid in it.
  accounts = accounts.filter(acc =>
    monthDueDays(acc, monthPrefix) > 0 &&
    (isRunning(acc) || !acc.actual_completion_date || acc.actual_completion_date >= monthStart ||
      monthPaid(db, acc.id, monthPrefix).paidIn > 0)
  );
  const rows = accounts.map(acc => {
    const cust = db.customers.find(c => c.id === acc.customer_id);
    const addr = db.customer_addresses.find(a => a.customer_id === acc.customer_id);
    const biz = db.business_details.find(b => b.customer_id === acc.customer_id);

    // Each day's cell is what was paid that day (undone payments never count).
    const { paidBefore, paidIn, inMonth } = monthPaid(db, acc.id, monthPrefix);
    const dailyCollections: { [day: number]: number } = {};
    for (let day = 1; day <= daysInMonth; day++) dailyCollections[day] = 0;
    for (const p of inMonth) {
      const day = Number(p.collection_date.slice(8, 10));
      dailyCollections[day] = safeRound(dailyCollections[day] + p.amount_paid, 2);
    }
    const monthlyTotal = paidIn;
    const scheduledDaysInMonth = monthDueDays(acc, monthPrefix);
    const expectedMonthly = monthExpected(acc, paidBefore, paidIn, monthPrefix);
    const monthlyPending = Math.max(0, safeRound(expectedMonthly - monthlyTotal, 2));
    const collectionPercentage = expectedMonthly > 0 ? safeRound((monthlyTotal / expectedMonthly) * 100, 1) : (monthlyTotal > 0 ? 100 : 0);

    return {
      customerId: acc.customer_id,
      customerName: acc.customer_name,
      mobile: cust?.mobile_number || '',
      shopName: acc.shop_name || biz?.shop_name || '',
      shopAddress: biz?.shop_address || addr?.street || '',
      area: acc.collection_area,
      collector: acc.assigned_collector_name,
      collectionAccountId: acc.id,
      requestedAmount: acc.requested_amount,
      marginPercentage: acc.margin_percentage,
      marginAmount: acc.margin_amount,
      disbursedAmount: acc.disbursed_amount,
      dailyCollection: acc.daily_collection,
      collectionDays: acc.collection_days,
      totalRepayment: acc.total_repayment,
      financeMargin: acc.finance_margin,
      amountCollected: acc.amount_collected,
      remainingAmount: acc.remaining_amount,
      startDate: acc.start_date,
      endDate: acc.expected_end_date,
      scheduledDaysInMonth,
      completedDays: acc.completed_days,
      remainingDays: acc.remaining_days,
      status: acc.status,
      dailyCollections,
      monthlyTotal,
      expectedMonthlyCollection: expectedMonthly,
      actualMonthlyCollection: monthlyTotal,
      monthlyPending,
      collectionPercentage,
    };
  });

  // Calculate totals
  const dailyTotals: { [day: number]: number } = {};
  for (let day = 1; day <= daysInMonth; day++) {
    dailyTotals[day] = safeRound(rows.reduce((sum, r) => sum + (r.dailyCollections[day] || 0), 0), 2);
  }

  const total = (pick: (r: (typeof rows)[number]) => number) => safeRound(rows.reduce((s, r) => s + pick(r), 0), 2);
  const expectedAll = total(r => r.expectedMonthlyCollection);
  const actualAll = total(r => r.actualMonthlyCollection);
  const totals = {
    requested: total(r => r.requestedAmount),
    disbursed: total(r => r.disbursedAmount),
    totalRepayment: total(r => r.totalRepayment),
    financeMargin: total(r => r.financeMargin),
    monthlyTotal: total(r => r.monthlyTotal),
    expectedMonthly: expectedAll,
    actualMonthly: actualAll,
    monthlyPending: total(r => r.monthlyPending),
    // Collected against expected for the whole month (not an average of the rows' percentages).
    collectionPercentage: expectedAll > 0 ? safeRound((actualAll / expectedAll) * 100, 1) : (actualAll > 0 ? 100 : 0),
    dailyTotals,
  };

  res.json({
    month,
    year,
    monthName,
    daysInMonth,
    rows,
    totals,
  });
});

// -------------------------------------------------------------
// 10. COLLECTORS & AREAS
// -------------------------------------------------------------
app.get('/api/collectors', (req: Request, res: Response) => {
  const db = repository.getDb();
  const list = db.collectors.map(col => {
    const assignedAccounts = db.collection_accounts.filter(a => a.assigned_collector_id === col.id);
    const todayStr = todayIso();
    const todayRecs = db.daily_collections.filter(d => d.collector_id === col.id && d.date === todayStr);
    const todayCollected = todayRecs.reduce((sum, d) => sum + d.paid_amount, 0);

    const runningAccounts = assignedAccounts.filter(isRunning);

    return {
      ...col,
      running_loans: runningAccounts.length,
      balance_to_collect: safeRound(runningAccounts.reduce((sum, a) => sum + a.remaining_amount, 0), 2),
      month_collected: safeRound(
        db.payments
          .filter(p => p.collector_id === col.id && isActivePayment(p) && p.collection_date.startsWith(todayStr.slice(0, 7)))
          .reduce((sum, p) => sum + p.amount_paid, 0),
        2
      ),
      today_customers_count: assignedAccounts.length,
      today_collected_amount: todayCollected,
      monthly_collected_amount: assignedAccounts.reduce((sum, a) => sum + a.amount_collected, 0),
    };
  });
  res.json(list);
});

/** A new collector with their login. Saving is left to the caller. */
function addCollectorRecords(db: ReturnType<typeof repository.getDb>, input: any): Collector {
  const colId = nextId(db, 'collector', db.collectors.map(c => c.id));
  const newCol: Collector = {
    id: colId,
    name: input.name,
    photo: input.photo || '',
    mobile: input.mobile,
    email: input.email,
    address: input.address || '',
    assigned_area: input.assigned_area || '',
    joining_date: input.joining_date || todayIso(),
    target_amount: Number(input.target_amount) || 0,
    status: 'ACTIVE',
  };

  db.collectors.push(newCol);

  // Sync login credentials in db.users
  const colUsername = String(input.username || colId).trim();
  const colPassword = String(input.password || STARTING_PIN).trim();
  const colUser: User = {
    id: `USR-${colId}`,
    username: colUsername,
    email: newCol.email || '',
    password: colPassword,
    role: 'COLLECTOR',
    collector_id: colId,
    name: newCol.name,
    phone: newCol.mobile,
    is_active: true,
    created_at: newCol.joining_date,
  };
  db.users.push(colUser);

  return newCol;
}

/** Why a collector's name, mobile or user ID cannot be used (null when they can). */
function collectorProblem(db: ReturnType<typeof repository.getDb>, body: any, selfId?: string): string | null {
  if (body.name !== undefined && !String(body.name).trim()) return 'Enter the collector name.';
  if (body.mobile !== undefined) {
    const mobile = String(body.mobile).replace(/\D/g, '').slice(-10);
    if (mobile.length < 10) return 'Enter a 10-digit mobile number.';
    if (db.collectors.some(c => c.id !== selfId && String(c.mobile).replace(/\D/g, '').slice(-10) === mobile)) {
      return 'Another collector already has this mobile number.';
    }
  }
  const login = selfId ? db.users.find(u => u.collector_id === selfId) : undefined;
  const wanted = String(body.username || '').trim().toLowerCase();
  if (wanted && db.users.some(u => u.id !== login?.id && u.username.toLowerCase() === wanted)) {
    return 'This user ID is already taken.';
  }
  if (body.status !== undefined && body.status !== 'ACTIVE' && body.status !== 'INACTIVE') return 'Unknown status.';
  return null;
}

app.post('/api/collectors', (req: Request, res: Response) => {
  const db = repository.getDb();
  const problem = collectorProblem(db, { ...req.body, name: req.body?.name ?? '', mobile: req.body?.mobile ?? '' });
  if (problem) return res.status(400).json({ error: problem });
  const newCol = addCollectorRecords(db, req.body);
  const colId = newCol.id;

  logAudit('admin', 'ADMIN', 'ADD_COLLECTOR', colId, 'collectors', null, newCol);
  repository.save();
  res.status(201).json(newCol);
});

app.put('/api/collectors/:id', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const col = db.collectors.find(c => c.id === id);
  if (!col) return res.status(404).json({ error: 'Collector not found' });
  const problem = collectorProblem(db, req.body || {}, id);
  if (problem) return res.status(400).json({ error: problem });
  const oldCol = { ...col };
  // Only the collector's own details; the login's user ID and password live on the login.
  const editable = ['name', 'photo', 'mobile', 'email', 'address', 'assigned_area', 'joining_date', 'target_amount', 'status'] as const;
  for (const key of editable) {
    if (req.body[key] === undefined) continue;
    (col as any)[key] = key === 'target_amount' ? Number(req.body[key]) || 0 : typeof req.body[key] === 'string' ? req.body[key].trim() : req.body[key];
  }
  // Their loans and today's / later day lists show the current name.
  if (col.name !== oldCol.name) {
    for (const acc of db.collection_accounts) if (acc.assigned_collector_id === id) acc.assigned_collector_name = col.name;
    for (const area of db.areas) if (area.assigned_collector_id === id) area.assigned_collector_name = col.name;
    const todayStr = todayIso();
    for (const d of db.daily_collections) if (d.collector_id === id && d.date >= todayStr) d.collector_name = col.name;
  }

  // Sync login credentials in db.users
  const colUser = db.users.find(u => u.collector_id === id);
  if (colUser) {
    if (req.body.username) colUser.username = String(req.body.username).trim();
    if (req.body.password) colUser.password = String(req.body.password).trim();
    if (req.body.name) colUser.name = String(req.body.name).trim();
    if (req.body.mobile) colUser.phone = String(req.body.mobile).trim();
    if (req.body.status) colUser.is_active = req.body.status === 'ACTIVE';
    if (!colUser.is_active) closeSessionsOf(colUser.id);
  } else if (req.body.username || req.body.password) {
    db.users.push({
      id: `USR-${id}`,
      username: String(req.body.username || id).trim(),
      email: col.email || '',
      password: String(req.body.password || STARTING_PIN).trim(),
      role: 'COLLECTOR',
      collector_id: id,
      name: col.name,
      phone: col.mobile,
      is_active: col.status === 'ACTIVE',
      created_at: col.joining_date || todayIso(),
    });
  }

  logAudit('admin', 'ADMIN', 'UPDATE_COLLECTOR', id, 'collectors', oldCol, col);
  repository.save();
  res.json(col);
});

app.delete('/api/collectors/:id', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const idx = db.collectors.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Collector not found' });
  if (db.collection_accounts.some(a => a.assigned_collector_id === id && isRunning(a))) {
    return res.status(400).json({ error: 'This collector still has running loans. Switch "Working" off instead, or move the loans first.' });
  }
  const [removed] = db.collectors.splice(idx, 1);
  // Their login goes too, and anyone signed in with it is signed out.
  const login = db.users.find(u => u.collector_id === id);
  if (login) {
    closeSessionsOf(login.id);
    db.users = db.users.filter(u => u.id !== login.id);
  }
  logAudit('admin', 'ADMIN', 'DELETE_COLLECTOR', id, 'collectors', removed, null);
  repository.save();
  res.json({ message: 'Collector deleted successfully' });
});

app.get('/api/areas', (req: Request, res: Response) => {
  const db = repository.getDb();
  const list = db.areas.map(a => ({
    ...a,
    customer_count: db.collection_accounts.filter(acc => acc.collection_area === a.area_name && isRunning(acc)).length,
  }));
  res.json(list);
});

app.post('/api/areas', (req: Request, res: Response) => {
  const db = repository.getDb();
  const name = String(req.body.area_name || '').trim();
  if (!name) return res.status(400).json({ error: 'Enter the area name.' });
  if (db.areas.some(a => a.area_name.toLowerCase() === name.toLowerCase())) {
    return res.status(400).json({ error: 'An area with this name already exists.' });
  }
  const areaId = nextId(db, 'area', db.areas.map(a => a.id));
  const loc = db.config.masters.default_location;
  const newArea: Area = {
    id: areaId,
    area_name: name,
    city: req.body.city || loc.city,
    district: req.body.district || loc.district,
    pincode: req.body.pincode || loc.pincode,
    assigned_collector_id: req.body.assigned_collector_id,
    assigned_collector_name: req.body.assigned_collector_name,
    customer_count: 0,
  };
  db.areas.push(newArea);
  logAudit('admin', 'ADMIN', 'ADD_AREA', areaId, 'areas', null, newArea);
  repository.save();
  res.status(201).json(newArea);
});

// Records refer to areas by name, so a rename is carried over to everything that uses the old name.
app.put('/api/areas/:id', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const area = db.areas.find(a => a.id === id);
  if (!area) return res.status(404).json({ error: 'Area not found' });
  const oldArea = { ...area };

  const newName = req.body.area_name !== undefined ? String(req.body.area_name).trim() : area.area_name;
  if (!newName) return res.status(400).json({ error: 'Enter the area name.' });
  if (db.areas.some(a => a.id !== id && a.area_name.toLowerCase() === newName.toLowerCase())) {
    return res.status(400).json({ error: 'An area with this name already exists.' });
  }
  if (req.body.assigned_collector_id) {
    const collector = db.collectors.find(c => c.id === req.body.assigned_collector_id);
    if (!collector) return res.status(400).json({ error: 'Collector not found' });
    area.assigned_collector_id = collector.id;
    area.assigned_collector_name = collector.name;
  }

  if (newName !== oldArea.area_name) {
    const from = oldArea.area_name;
    area.area_name = newName;
    db.collection_accounts.forEach(a => { if (a.collection_area === from) a.collection_area = newName; });
    db.daily_collections.forEach(d => { if (d.collection_area === from) d.collection_area = newName; });
    db.customer_addresses.forEach(a => { if (a.area === from) a.area = newName; });
    db.business_details.forEach(b => { if (b.shop_area === from) b.shop_area = newName; });
    db.collectors.forEach(c => { if (c.assigned_area === from) c.assigned_area = newName; });
  }

  logAudit('admin', 'ADMIN', 'UPDATE_AREA', id, 'areas', oldArea, area);
  repository.save();
  res.json(area);
});

app.delete('/api/areas/:id', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const idx = db.areas.findIndex(a => a.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Area not found' });
  const name = db.areas[idx].area_name;
  if (db.collection_accounts.some(a => a.collection_area === name && isRunning(a))) {
    return res.status(400).json({ error: 'This area still has running loans, so it cannot be removed.' });
  }
  const [removed] = db.areas.splice(idx, 1);
  logAudit('admin', 'ADMIN', 'DELETE_AREA', id, 'areas', removed, null);
  repository.save();
  res.json({ message: 'Area deleted successfully' });
});

// -------------------------------------------------------------
// 11. PHOTOS & DOCUMENTS
// -------------------------------------------------------------

// Saves a photo taken or chosen in the app (already shrunk in the browser) and returns its URL.
app.post('/api/uploads', (req: Request, res: Response) => {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.data_url || ''));
  if (!match) return res.status(400).json({ error: 'Send a JPEG, PNG or WebP photo.' });
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 5 * 1024 * 1024) return res.status(400).json({ error: 'The photo is too large.' });

  fs.mkdirSync(uploadsDir, { recursive: true });
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  fs.writeFileSync(path.join(uploadsDir, name), bytes);
  res.status(201).json({ url: `/api/uploads/${name}` });
});

app.get('/api/documents', (req: Request, res: Response) => {
  const db = repository.getDb();
  const customerId = req.query.customer_id as string;
  const status = req.query.status as string;

  let list = db.documents;
  if (customerId) {
    list = list.filter(d => d.customer_id === customerId);
  }
  if (status && status !== 'ALL') {
    list = list.filter(d => d.verification_status === status);
  }
  res.json(list);
});

app.post('/api/documents', (req: Request, res: Response) => {
  const db = repository.getDb();
  const { customer_id, document_type, document_number, file_url, file_name, uploaded_by, remarks } = req.body;

  if (!customer_id || !document_type || !file_url) {
    return res.status(400).json({ error: 'Customer, document type and photo are required' });
  }

  const docId = `DOC-${Date.now()}`;
  const newDoc: CustomerDocument = {
    id: docId,
    customer_id,
    document_type,
    document_number: document_number || '',
    file_url,
    file_name: file_name || path.basename(String(file_url)),
    upload_date: todayIso(),
    uploaded_by: uploaded_by || 'Admin',
    verification_status: 'Pending Verification',
    remarks,
  };

  db.documents.push(newDoc);
  logAudit(uploaded_by || 'Admin', 'ADMIN', 'UPLOAD_DOCUMENT', docId, 'documents', null, newDoc);
  createNotification('ADMIN', 'New KYC Document Uploaded', `${document_type} uploaded for customer ${customer_id}. Verification required.`, 'KYC', customer_id);
  repository.save();

  res.status(201).json(newDoc);
});

app.put('/api/documents/:id/verify', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const doc = db.documents.find(d => d.id === id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const { verification_status, remarks } = req.body;
  if (!['Pending Verification', 'Verified', 'Rejected'].includes(verification_status)) {
    return res.status(400).json({ error: 'Choose verified or rejected.' });
  }
  const prevStatus = doc.verification_status;
  doc.verification_status = verification_status;
  if (remarks) doc.remarks = remarks;

  logAudit('admin', 'ADMIN', 'VERIFY_DOCUMENT', id, 'documents', { status: prevStatus }, { status: verification_status, remarks });
  createNotification('CUSTOMER', `Document ${verification_status}`, `Your ${doc.document_type} has been ${verification_status.toLowerCase()} by Daily Collection administration.`, 'KYC', doc.customer_id);
  repository.save();

  res.json(doc);
});

app.delete('/api/documents/:id', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const idx = db.documents.findIndex(d => d.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Document not found' });

  const deleted = db.documents.splice(idx, 1)[0];
  logAudit('admin', 'ADMIN', 'DELETE_DOCUMENT', id, 'documents', deleted, null);
  repository.save();
  res.json({ message: 'Document deleted successfully' });
});

// -------------------------------------------------------------
// 12. NOTIFICATIONS & AUDIT LOGS & SETTINGS
// -------------------------------------------------------------
app.get('/api/notifications', (req: Request, res: Response) => {
  const db = repository.getDb();
  const role = req.query.role as string;
  const customerId = req.query.customer_id as string;

  let list = db.notifications;
  if (role) {
    list = list.filter(n => n.recipient_role === role);
  }
  if (customerId) {
    list = list.filter(n => n.customer_id === customerId);
  }
  res.json(list.slice(0, 30));
});

app.put('/api/notifications/:id/read', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const n = db.notifications.find(notif => notif.id === id);
  if (n) {
    n.is_read = true;
    repository.save();
  }
  res.json({ success: true });
});

/** Marks the signed-in person's own notifications read (the office's, a collector's, or one customer's). */
app.put('/api/notifications/read-all', (req: Request, res: Response) => {
  const db = repository.getDb();
  const role = (req.query.role as string) || actor()?.role;
  const customerId = req.query.customer_id as string | undefined;
  db.notifications
    .filter(n => (!role || n.recipient_role === role) && (!customerId || n.customer_id === customerId))
    .forEach(n => { n.is_read = true; });
  repository.save();
  res.json({ success: true });
});

app.post('/api/customer/loan-request', (req: Request, res: Response) => {
  const { customer_id, purpose, remarks } = req.body;
  const amount = safeRound(Number(req.body.requested_amount), 2);
  const days = req.body.collection_days ? Math.floor(Number(req.body.collection_days)) : 100;
  if (!customer_id || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Enter the amount you need.' });
  }
  if (!Number.isFinite(days) || days <= 0) return res.status(400).json({ error: 'Enter the number of days.' });
  const db = repository.getDb();
  const customer = db.customers.find(c => c.id === customer_id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  if ((db.loan_requests || []).some(r => r.customer_id === customer_id && r.status === 'PENDING')) {
    return res.status(400).json({ error: 'Your earlier request is still with the office. Please wait for their answer.' });
  }
  const requested_amount = amount;
  const collection_days = days;
  const biz = db.business_details.find(b => b.customer_id === customer_id);
  const now = new Date().toISOString();
  const reqId = `LR-${uniqueSuffix()}`;
  const customerName = customer.full_name;
  const shopName = biz?.shop_name || customerName;

  // Add notification for Admin
  const adminNotif: any = {
    id: `NOTIF-${Date.now()}-A`,
    recipient_role: 'ADMIN',
    type: 'LOAN_REQUEST',
    title: 'New Loan Renewal Request',
    message: `${customerName} (${shopName}) has requested a new loan of ₹${Number(requested_amount).toLocaleString('en-IN')} for ${collection_days || 100} days.${purpose ? ` Purpose: ${purpose}` : ''}`,
    created_at: now,
    is_read: false,
    customer_id,
  };
  db.notifications.unshift(adminNotif);

  // Add confirmation notification for Customer
  const custNotif: any = {
    id: `NOTIF-${Date.now()}-C`,
    recipient_role: 'CUSTOMER',
    type: 'LOAN_REQUEST',
    title: 'Loan Renewal Request Received',
    message: `Your request for ₹${Number(requested_amount).toLocaleString('en-IN')} has been submitted successfully (Ref: ${reqId}). The office team will contact you.`,
    created_at: now,
    is_read: false,
    customer_id,
  };
  db.notifications.unshift(custNotif);

  if (!db.loan_requests) db.loan_requests = [];
  const requestRecord = {
    id: reqId,
    customer_id,
    customer_name: customerName,
    shop_name: shopName,
    requested_amount,
    collection_days,
    purpose: purpose || 'Working Capital',
    remarks: remarks || '',
    status: 'PENDING' as const,
    created_at: now,
  };
  db.loan_requests.unshift(requestRecord);

  repository.save();
  res.json({ success: true, request: requestRecord });
});

/**
 * The customer says they paid by UPI. Nothing is added to the loan here: the office is told,
 * checks the money arrived, and records it through Daily Collection like any other payment.
 */
app.post('/api/customer/payment-claim', (req: Request, res: Response) => {
  const { customer_id, amount, upi_reference } = req.body;
  const paid = Number(amount);
  if (!customer_id || !Number.isFinite(paid) || paid <= 0) {
    return res.status(400).json({ error: 'Enter the amount you paid.' });
  }
  const db = repository.getDb();
  const customer = db.customers.find(c => c.id === customer_id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const now = new Date().toISOString();
  const stamp = Date.now();
  const rupees = `₹${paid.toLocaleString('en-IN')}`;
  const reference = String(upi_reference || '').trim();
  const officeNotice: Notification = {
    id: `NOTIF-${stamp}-A`,
    recipient_role: 'ADMIN',
    customer_id,
    type: 'PAYMENT',
    title: 'UPI payment to check',
    message: `${customer.full_name} says they paid ${rupees} by UPI${reference ? ` (ref ${reference})` : ''}. Check the bank account, then record it in Daily Collection.`,
    is_read: false,
    created_at: now,
  };
  const customerNotice: Notification = {
    id: `NOTIF-${stamp}-C`,
    recipient_role: 'CUSTOMER',
    customer_id,
    type: 'PAYMENT',
    title: 'Payment sent for checking',
    message: `We received your message about ${rupees}. It will show in your passbook after the office checks it.`,
    is_read: false,
    created_at: now,
  };
  db.notifications.unshift(officeNotice, customerNotice);

  const business = db.business_details.find(b => b.customer_id === customer_id);
  const runningLoan = db.collection_accounts.find(a => a.customer_id === customer_id && isRunning(a));
  if (!db.payment_claims) db.payment_claims = [];
  db.payment_claims.unshift({
    id: `UPI-${uniqueSuffix()}`,
    customer_id,
    customer_name: customer.full_name,
    shop_name: business?.shop_name,
    collection_account_id: runningLoan?.id,
    amount: paid,
    upi_reference: reference || undefined,
    status: 'PENDING',
    created_at: now,
  });
  repository.save();
  res.json({ success: true });
});

app.get('/api/payment-claims', (req: Request, res: Response) => {
  const db = repository.getDb();
  const { status, customer_id } = req.query as Record<string, string | undefined>;
  res.json((db.payment_claims || []).filter(c => (!status || c.status === status) && (!customer_id || c.customer_id === customer_id)));
});

/**
 * The office has checked the bank account. RECORDED is sent after the payment itself has been saved
 * (with its receipt number); NOT_RECEIVED tells the customer it was not found.
 */
app.post('/api/payment-claims/:id/decision', (req: Request, res: Response) => {
  const db = repository.getDb();
  const claim = (db.payment_claims || []).find(c => c.id === getParam(req, 'id'));
  if (!claim) return res.status(404).json({ error: 'Payment message not found' });
  if (claim.status !== 'PENDING') return res.status(400).json({ error: 'This payment was already handled.' });
  const { decision, receipt_number } = req.body || {};
  if (decision !== 'RECORDED' && decision !== 'NOT_RECEIVED') return res.status(400).json({ error: 'Choose recorded or not received.' });

  const previous = { ...claim };
  claim.status = decision;
  claim.decided_by = byWho(req);
  claim.decided_at = new Date().toISOString();
  if (receipt_number) claim.receipt_number = String(receipt_number);
  const rupees = `₹${claim.amount.toLocaleString('en-IN')}`;
  db.notifications.unshift({
    id: `NOTIF-${Date.now()}-C`,
    recipient_role: 'CUSTOMER',
    customer_id: claim.customer_id,
    type: 'PAYMENT',
    title: decision === 'RECORDED' ? 'UPI payment recorded' : 'UPI payment not found',
    message: decision === 'RECORDED'
      ? `Your UPI payment of ${rupees} is recorded${claim.receipt_number ? ` (receipt ${claim.receipt_number})` : ''}.`
      : `We could not find your UPI payment of ${rupees} in our account. Please call the office.`,
    is_read: false,
    created_at: claim.decided_at,
  });
  logAudit(claim.decided_by, 'ADMIN', `PAYMENT_CLAIM_${decision}`, claim.id, 'payment_claims', previous, claim);
  repository.save();
  res.json(claim);
});

/** Approve (after the loan was given, with its account) or reject a customer's new-loan request. */
app.post('/api/loan-requests/:id/decision', (req: Request, res: Response) => {
  const db = repository.getDb();
  const request = (db.loan_requests || []).find(r => r.id === getParam(req, 'id'));
  if (!request) return res.status(404).json({ error: 'Loan request not found' });
  if (request.status !== 'PENDING') return res.status(400).json({ error: 'This request was already handled.' });
  const { decision, account_id } = req.body || {};
  if (decision !== 'APPROVED' && decision !== 'REJECTED') return res.status(400).json({ error: 'Choose approve or reject.' });

  const previous = { ...request };
  request.status = decision;
  request.decided_by = byWho(req);
  request.decided_at = new Date().toISOString();
  if (account_id) request.account_id = String(account_id);
  db.notifications.unshift({
    id: `NOTIF-${Date.now()}-C`,
    recipient_role: 'CUSTOMER',
    customer_id: request.customer_id,
    type: 'LOAN_REQUEST',
    title: decision === 'APPROVED' ? 'New loan approved' : 'Loan request not approved',
    message: decision === 'APPROVED'
      ? `Your request for ₹${request.requested_amount.toLocaleString('en-IN')} is approved. Your collector will meet you.`
      : `Your request for ₹${request.requested_amount.toLocaleString('en-IN')} was not approved this time. Please call the office.`,
    is_read: false,
    created_at: request.decided_at,
  });
  logAudit(request.decided_by, 'ADMIN', `LOAN_REQUEST_${decision}`, request.id, 'loan_requests', previous, request);
  repository.save();
  res.json(request);
});

app.get('/api/customer/loan-requests', (req: Request, res: Response) => {
  const customerId = req.query.customer_id as string;
  const db = repository.getDb();
  let list = db.loan_requests || [];
  if (customerId) {
    list = list.filter(r => r.customer_id === customerId);
  }
  res.json(list);
});

app.get('/api/audit-logs', (req: Request, res: Response) => {
  const db = repository.getDb();
  res.json(db.audit_logs.slice(0, 100));
});

// Replace the live data with the committed sample data set (data/sample_data.json).
app.post('/api/seed/reset', (req: Request, res: Response) => {
  try {
    loadSampleData();
    res.json({ message: 'Sample data loaded successfully.' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(` DAILY COLLECTION - Management Server`);
  console.log(` Listening on port http://localhost:${PORT}`);
  console.log(`=================================================\n`);
});
