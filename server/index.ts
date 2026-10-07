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
import { todayIso, roundMoney, addDaysIso, scheduleDates } from '../shared/finance.ts';
import { CONFIG_SECTIONS, ConfigSection, LoanProduct as ConfigLoanProduct, MasterLists, Numbering, NumberingKind } from '../shared/config.ts';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Customer photos and document copies live in uploads/ (git-ignored), never in the data file.
const uploadsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');
app.use('/api/uploads', express.static(uploadsDir, { maxAge: '7d' }));

// Initialize DB schema & seeds
initializeDatabase();

// Helpers
function getParam(req: Request, key: string): string {
  const val = req.params[key];
  return Array.isArray(val) ? val[0] : val || '';
}

const safeRound = roundMoney;

/** Calendar days elapsed since the account started minus the days already paid for. */
function daysBehindSchedule(acc: CollectionAccount, dateStr: string): number {
  const elapsed = Math.floor((Date.parse(dateStr) - Date.parse(acc.start_date)) / 86400000);
  return Math.max(0, elapsed - acc.completed_days);
}

function isRunning(acc: CollectionAccount): boolean {
  return acc.status === 'ACTIVE' || acc.status === 'OVERDUE';
}

/** A running loan whose collection has started on or before the given date. */
function isCollecting(acc: CollectionAccount, dateStr: string): boolean {
  return isRunning(acc) && acc.start_date <= dateStr;
}

/** Adds how many days a running loan is behind its schedule (drives "Not paying"). */
function withDaysBehind(acc: CollectionAccount) {
  return { ...acc, days_behind: isRunning(acc) ? daysBehindSchedule(acc, todayIso()) : 0 };
}

/** Undone payments stay on record but never count toward totals. */
function isActivePayment(p: PaymentTransaction): boolean {
  return p.status !== 'CANCELLED';
}

/** Recomputes the derived totals of an account after its collected amount changes. */
function refreshAccountTotals(acc: CollectionAccount) {
  acc.remaining_amount = Math.max(0, safeRound(acc.total_repayment - acc.amount_collected, 2));
  acc.completed_days = Math.floor(acc.amount_collected / acc.daily_collection);
  acc.remaining_days = Math.max(0, acc.collection_days - acc.completed_days);
  acc.collection_percentage = safeRound((acc.amount_collected / acc.total_repayment) * 100, 1);
  acc.updated_at = new Date().toISOString();
}

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
  const log: AuditLog = {
    id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    user,
    role,
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
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password, role } = req.body;
  const db = repository.getDb();

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const cleanUser = String(username).trim();
  const cleanPass = String(password).trim();

  // Find user matching role and username/email/customer_id/phone
  let user = db.users.find(u => {
    const matchesUser =
      u.username.toLowerCase() === cleanUser.toLowerCase() ||
      u.email.toLowerCase() === cleanUser.toLowerCase() ||
      (u.customer_id && u.customer_id.toLowerCase() === cleanUser.toLowerCase()) ||
      (u.phone && u.phone.replace(/\D/g, '') === cleanUser.replace(/\D/g, ''));

    if (role && u.role !== role) return false;
    // Allow 'agent' or 'collector' to match the collector user USR005 / COL101
    if ((cleanUser.toLowerCase() === 'agent' || cleanUser.toLowerCase() === 'collector') && u.role === 'COLLECTOR') {
      return true;
    }
    return matchesUser;
  });

  // If collector login, also check collectors table directly if not yet in users table
  if (!user && role === 'COLLECTOR') {
    const col = db.collectors.find(
      c =>
        c.id.toLowerCase() === cleanUser.toLowerCase() ||
        c.mobile.replace(/\D/g, '') === cleanUser.replace(/\D/g, '') ||
        cleanUser.toLowerCase() === 'agent' ||
        cleanUser.toLowerCase() === 'collector' ||
        c.name.toLowerCase().includes(cleanUser.toLowerCase())
    ) || db.collectors[0];

    if (col) {
      user = {
        id: `USR-${col.id}`,
        username: col.id,
        email: col.email || `${col.id.toLowerCase()}@dailycollection.com`,
        role: 'COLLECTOR',
        collector_id: col.id,
        name: col.name,
        phone: col.mobile,
        is_active: col.status === 'ACTIVE',
        created_at: col.joining_date,
      };
    }
  }

  // If customer login, also check customers table directly if not yet in users table
  if (!user && role === 'CUSTOMER') {
    const cust = db.customers.find(
      c =>
        c.id.toLowerCase() === cleanUser.toLowerCase() ||
        c.mobile_number.replace(/\D/g, '') === cleanUser.replace(/\D/g, '')
    );
    if (cust && (cleanPass === '1234' || cleanPass === 'password' || cleanPass === 'customer')) {
      user = {
        id: `USR-${cust.id}`,
        username: cust.id,
        email: cust.email || `${cust.id.toLowerCase()}@krsfinance.com`,
        role: 'CUSTOMER',
        customer_id: cust.id,
        name: cust.full_name,
        phone: cust.mobile_number,
        is_active: cust.status === 'ACTIVE',
        created_at: cust.created_at,
      };
    }
  }

  // Password verification (flexible demo passwords)
  const isAcceptedPass = 
    (user?.password && user.password === cleanPass) ||
    cleanPass === '1234' ||
    cleanPass === 'admin123' ||
    cleanPass === 'admin' ||
    cleanPass === 'agent123' ||
    cleanPass === 'collector123' ||
    cleanPass === 'password';

  if (!user || !isAcceptedPass) {
    return res.status(401).json({ error: 'Invalid credentials. Please check your username/phone and password.' });
  }

  if (!user.is_active) {
    return res.status(403).json({ error: 'Account is deactivated. Please contact Daily Collection administration.' });
  }

  const { password: _, ...safeUser } = user;
  res.json({
    token: `dc_token_${user.id}_${Date.now()}`,
    user: safeUser,
  });
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const db = repository.getDb();
  const userId = token.split('_')[2];
  const user = db.users.find(u => u.id === userId) || db.users[0];
  const { password: _, ...safeUser } = user;
  res.json(safeUser);
});

// -------------------------------------------------------------
// 1.1 USER CREDENTIALS & MANAGEMENT (Admin)
// -------------------------------------------------------------
app.get('/api/users', (req: Request, res: Response) => {
  const db = repository.getDb();
  const role = req.query.role as string | undefined;

  // Ensure collectors are synced into db.users if missing
  for (const col of db.collectors) {
    const existing = db.users.find(u => u.collector_id === col.id || u.username.toLowerCase() === col.id.toLowerCase());
    if (!existing) {
      db.users.push({
        id: `USR-${col.id}`,
        username: col.id,
        email: col.email || `${col.id.toLowerCase()}@dailycollection.com`,
        password: '1234',
        role: 'COLLECTOR',
        collector_id: col.id,
        name: col.name,
        phone: col.mobile,
        is_active: col.status === 'ACTIVE',
        created_at: col.joining_date || todayIso(),
      });
    }
  }

  // Ensure active customers are synced into db.users if missing
  for (const cust of db.customers) {
    const existing = db.users.find(u => u.customer_id === cust.id || u.username.toLowerCase() === cust.id.toLowerCase());
    if (!existing) {
      db.users.push({
        id: `USR-${cust.id}`,
        username: cust.id,
        email: cust.email || `${cust.id.toLowerCase()}@dailycollection.com`,
        password: '1234',
        role: 'CUSTOMER',
        customer_id: cust.id,
        name: cust.full_name,
        phone: cust.mobile_number,
        is_active: cust.status === 'ACTIVE',
        created_at: cust.created_at || todayIso(),
      });
    }
  }

  let list = db.users;
  if (role) {
    list = list.filter(u => u.role === role);
  }

  res.json(list);
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

  const cleanPass = String(password || '').trim() || (role === 'ADMIN' ? 'admin123' : '1234');
  const userId = `USR-${Date.now().toString(36).toUpperCase()}`;

  const newUser: User = {
    id: userId,
    username: cleanUser,
    email: (email || '').trim() || `${cleanUser.toLowerCase()}@dailycollection.com`,
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
  res.status(201).json(newUser);
});

app.put('/api/users/:id', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const user = db.users.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { username, password, name, phone, email, is_active, role } = req.body;

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

  logAudit('admin', 'ADMIN', 'UPDATE_USER_CREDENTIALS', id, 'users', null, { username: user.username, role: user.role });
  repository.save();
  res.json(user);
});

app.delete('/api/users/:id', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  if (id === 'USR001') {
    return res.status(400).json({ error: 'Cannot delete the primary Administrator account.' });
  }
  const idx = db.users.findIndex(u => u.id === id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });

  const deleted = db.users.splice(idx, 1)[0];
  logAudit('admin', 'ADMIN', 'DELETE_USER', id, 'users', deleted, null);
  repository.save();
  res.json({ success: true, message: 'User deleted successfully' });
});

// -------------------------------------------------------------
// 2. DASHBOARD STATS & CHARTS
// -------------------------------------------------------------
app.get('/api/dashboard/stats', (req: Request, res: Response) => {
  const db = repository.getDb();
  const todayStr = todayIso();
  const currentMonthStr = todayStr.slice(0, 7); // YYYY-MM

  const activeAccounts = db.collection_accounts.filter(isRunning);
  const collectingToday = activeAccounts.filter(a => isCollecting(a, todayStr));

  // Today's collections
  const todayCollections = db.daily_collections.filter(d => d.date === todayStr);
  const todayExpected = collectingToday.reduce((sum, a) => sum + a.daily_collection, 0);
  const todayCollected = todayCollections.reduce((sum, d) => sum + d.paid_amount, 0);
  const todayPending = Math.max(0, todayExpected - todayCollected);
  const todayCollectionRate = todayExpected > 0 ? safeRound((todayCollected / todayExpected) * 100, 1) : 0;

  // Monthly collections
  const monthlyPayments = db.payments.filter(p => isActivePayment(p) && p.collection_date.startsWith(currentMonthStr));
  const monthlyCollection = monthlyPayments.reduce((sum, p) => sum + p.amount_paid, 0);
  const notPayingCount = activeAccounts.filter(
    a => daysBehindSchedule(a, todayStr) >= db.config.masters.not_paying_after_days
  ).length;

  // Financial aggregates (cancelled loans never happened; only running loans still owe money)
  const liveAccounts = db.collection_accounts.filter(a => a.status !== 'CANCELLED');
  const totalOutstanding = activeAccounts.reduce((sum, a) => sum + a.remaining_amount, 0);
  const totalCollected = liveAccounts.reduce((sum, a) => sum + a.amount_collected, 0);
  const totalFinanceMargin = liveAccounts.reduce((sum, a) => sum + a.finance_margin, 0);
  const totalDisbursed = liveAccounts.reduce((sum, a) => sum + a.disbursed_amount, 0);
  const totalRepayment = liveAccounts.reduce((sum, a) => sum + a.total_repayment, 0);
  const overdueCustomersCount = db.collection_accounts.filter(a => a.status === 'OVERDUE').length;

  const openingBalance = db.config.company.opening_balance !== undefined
    ? Number(db.config.company.opening_balance)
    : 500000;
  // Total Balance = Opening Capital + Total Collected - Total Disbursed (new customer loans deduct from this balance!)
  const totalBalance = safeRound(openingBalance + totalCollected - totalDisbursed, 2);

  res.json({
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

app.post('/api/customers', (req: Request, res: Response) => {
  const db = repository.getDb();
  const { personal, address, business, loan } = req.body;
  const loc = db.config.masters.default_location;

  if (!personal || !personal.full_name || !personal.mobile_number) {
    return res.status(400).json({ error: 'Customer full name and mobile number are required.' });
  }
  if (db.customers.some(c => c.mobile_number === personal.mobile_number)) {
    return res.status(400).json({ error: 'A customer with this mobile number already exists.' });
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
      area: address.area || loc.area,
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
      shop_area: business.shop_area || address?.area || loc.area,
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
  const custUsername = String(req.body.username || customerId).trim();
  const custPassword = String(req.body.password || '1234').trim();
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

  const { personal, address, business, username, password } = req.body;
  const oldVal = { ...cust };

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
        password: String(password || '1234').trim(),
        role: 'CUSTOMER',
        customer_id: id,
        name: cust.full_name,
        phone: cust.mobile_number,
        is_active: cust.status === 'ACTIVE',
        created_at: cust.created_at || new Date().toISOString(),
      });
    }
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
  if (u) u.is_active = false;

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
  const oldMargin = biz.default_margin_percentage;
  biz.default_margin_percentage = Number(req.body.default_margin_percentage);
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

  const role = String(req.body?.role || 'ADMIN').toUpperCase();
  const by = String(req.body?.by || 'admin');

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

  const collector = collector_id ? (db.collectors.find(c => c.id === collector_id) || {
    id: acc.assigned_collector_id,
    name: acc.assigned_collector_name,
  }) : {
    id: acc.assigned_collector_id,
    name: acc.assigned_collector_name,
  };

  const perDayAmount = (daily_amount && Number(daily_amount) > 0) ? Number(daily_amount) : acc.daily_collection;
  const payMode = payment_mode || 'CASH';
  const handRemarks = remarks || 'Recorded from physical hand notebook (கை நோட்டு)';

  let recordedCount = 0;
  let totalRecordedAmount = 0;

  for (const dayNum of targetDays) {
    const dateStr = allDates[dayNum - 1];
    if (!dateStr) continue;

    // Check if payment already exists for this date
    const existingPayment = db.payments.find(p => p.collection_account_id === acc.id && p.collection_date === dateStr && isActivePayment(p));
    if (existingPayment && !overwrite_existing) {
      // Already recorded and not overwriting, leave as is
      continue;
    }

    if (existingPayment && overwrite_existing) {
      existingPayment.status = 'CANCELLED';
      existingPayment.cancelled_at = new Date().toISOString();
      existingPayment.remarks = 'Replaced by bulk hand note upload';
    }

    const receiptNum = nextId(db, 'receipt', db.receipts.map(r => r.receipt_number));
    const paymentId = `PAY-${Date.now()}-${dayNum}-${Math.floor(Math.random() * 1000)}`;
    const receiptId = `REC-${Date.now()}-${dayNum}-${Math.floor(Math.random() * 1000)}`;

    const prevBalance = acc.remaining_amount;

    const paymentTx: PaymentTransaction = {
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
      previous_balance: prevBalance,
      remaining_balance: Math.max(0, safeRound(prevBalance - perDayAmount, 2)),
      status: 'SUCCESS',
      remarks: handRemarks,
      created_at: new Date().toISOString(),
    };
    db.payments.push(paymentTx);

    const newReceipt: Receipt = {
      id: receiptId,
      receipt_number: receiptNum,
      payment_id: paymentId,
      collection_account_id: acc.id,
      customer_id: acc.customer_id,
      customer_name: acc.customer_name,
      shop_name: acc.shop_name || '',
      daily_due: acc.daily_collection,
      amount_paid: perDayAmount,
      payment_mode: payMode,
      previous_balance: prevBalance,
      remaining_balance: Math.max(0, safeRound(prevBalance - perDayAmount, 2)),
      collector_name: collector.name,
      date: dateStr,
      created_at: new Date().toISOString(),
      remarks: handRemarks,
    };
    db.receipts.push(newReceipt);

    let dailyRecord = db.daily_collections.find(d => d.collection_account_id === acc.id && d.date === dateStr);
    if (!dailyRecord) {
      dailyRecord = {
        id: `DC-${dateStr}-${acc.id}`,
        collection_account_id: acc.id,
        customer_id: acc.customer_id,
        customer_name: acc.customer_name,
        shop_name: acc.shop_name || '',
        mobile_number: db.customers.find(c => c.id === acc.customer_id)?.mobile_number || '',
        collection_day_number: dayNum,
        calendar_date: dateStr,
        date: dateStr,
        daily_due: acc.daily_collection,
        paid_amount: perDayAmount,
        pending_amount: 0,
        advance_amount: 0,
        status: 'PAID',
        payment_mode: payMode,
        collector_id: collector.id,
        collector_name: collector.name,
        collection_area: acc.collection_area,
        receipt_id: receiptId,
        receipt_number: receiptNum,
        balance_remaining: Math.max(0, safeRound(prevBalance - perDayAmount, 2)),
        remarks: handRemarks,
      };
      db.daily_collections.push(dailyRecord);
    } else {
      dailyRecord.paid_amount = perDayAmount;
      dailyRecord.pending_amount = 0;
      dailyRecord.status = 'PAID';
      dailyRecord.payment_mode = payMode;
      dailyRecord.collector_id = collector.id;
      dailyRecord.collector_name = collector.name;
      dailyRecord.collection_area = acc.collection_area;
      dailyRecord.receipt_id = receiptId;
      dailyRecord.receipt_number = receiptNum;
      dailyRecord.balance_remaining = Math.max(0, safeRound(prevBalance - perDayAmount, 2));
      dailyRecord.remarks = handRemarks;
    }

    recordedCount++;
    totalRecordedAmount = safeRound(totalRecordedAmount + perDayAmount, 2);
  }

  // Recalculate account totals from all active payments to ensure absolute accuracy
  const allActiveAccountPayments = db.payments.filter(p => p.collection_account_id === acc.id && isActivePayment(p));
  acc.amount_collected = safeRound(allActiveAccountPayments.reduce((sum, p) => sum + p.amount_paid, 0), 2);
  refreshAccountTotals(acc);

  if (acc.remaining_amount === 0) {
    acc.status = 'COMPLETED';
    acc.actual_completion_date = allDates[targetDays[targetDays.length - 1] - 1] || todayIso();
  } else if (acc.status === 'COMPLETED') {
    acc.status = 'ACTIVE';
    acc.actual_completion_date = undefined;
  }

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

app.get('/api/daily-collections', (req: Request, res: Response) => {
  const db = repository.getDb();
  const dateStr = (req.query.date as string) || todayIso();
  const area = req.query.area as string;
  const street = req.query.street as string;
  const collector = req.query.collector as string;
  const status = req.query.status as string;
  const search = String(req.query.search || '').toLowerCase().trim();

  // Find or create the day's working record for every loan being collected on that date
  const activeAccounts = db.collection_accounts.filter(a => isCollecting(a, dateStr));
  const collectingIds = new Set(activeAccounts.map(a => a.id));

  activeAccounts.forEach((acc, index) => {
    let rec = db.daily_collections.find(d => d.collection_account_id === acc.id && d.date === dateStr);
    
    // Calculate missed days based on start_date, completed days, and account status
    const missedDays = daysBehindSchedule(acc, dateStr);
    const missedAmount = safeRound(missedDays * acc.daily_collection, 2);

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
        pending_amount: acc.daily_collection,
        advance_amount: 0,
        status: 'PENDING',
        collector_id: acc.assigned_collector_id,
        collector_name: acc.assigned_collector_name,
        collection_area: acc.collection_area,
        balance_remaining: acc.remaining_amount,
        route_order: index + 1,
        missed_days_count: missedDays,
        missed_amount: missedAmount,
      };
      db.daily_collections.push(rec);
    } else {
      rec.route_order = rec.route_order || (index + 1);
      rec.missed_days_count = missedDays;
      rec.missed_amount = missedAmount;
      rec.balance_remaining = acc.remaining_amount;
    }
  });

  // Loans that closed or have not started only appear if something happened on that day.
  let records = db.daily_collections.filter(
    d => d.date === dateStr && (collectingIds.has(d.collection_account_id) || d.paid_amount > 0 || d.status === 'MISSED')
  );

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
  const paid = is_missed ? 0 : Number(amount_paid);

  const account = db.collection_accounts.find(a => a.id === collection_account_id);
  if (!account) {
    return res.status(404).json({ error: 'Collection account not found' });
  }
  if (!isRunning(account)) {
    return res.status(400).json({ error: 'This loan is closed.' });
  }
  if (!is_missed && (!Number.isFinite(paid) || paid < 0)) {
    return res.status(400).json({ error: 'Enter a valid amount.' });
  }
  if (paid > account.remaining_amount) {
    return res.status(400).json({ error: `The amount is more than the balance (₹${account.remaining_amount}).` });
  }
  // One collection per customer per day: a wrong entry is undone first, then collected again.
  const existingRecord = db.daily_collections.find(d => d.collection_account_id === account.id && d.date === dateStr);
  if (existingRecord?.receipt_number &&
      db.payments.some(p => p.receipt_number === existingRecord.receipt_number && isActivePayment(p))) {
    return res.status(409).json({ error: 'Already collected for this day. Undo it first to change it.' });
  }

  const collector = db.collectors.find(c => c.id === collector_id) || {
    id: account.assigned_collector_id,
    name: account.assigned_collector_name,
  };

  const dailyDue = account.daily_collection;
  let status: 'PAID' | 'PARTIAL' | 'PENDING' | 'MISSED' | 'ADVANCE' = 'PAID';
  let pendingAmount = 0;
  let advanceAmount = 0;

  if (is_missed || paid === 0) {
    status = 'MISSED';
    pendingAmount = dailyDue;
  } else if (paid < dailyDue) {
    status = 'PARTIAL';
    pendingAmount = safeRound(dailyDue - paid, 2);
  } else if (paid > dailyDue) {
    status = 'ADVANCE';
    advanceAmount = safeRound(paid - dailyDue, 2);
  } else {
    status = 'PAID';
    pendingAmount = 0;
  }

  // Find or update daily collection record
  let dailyRecord = db.daily_collections.find(
    d => d.collection_account_id === account.id && d.date === dateStr
  );
  const oldPaid = dailyRecord ? (dailyRecord.paid_amount || 0) : 0;
  const netPaidDiff = safeRound(paid - oldPaid, 2);

  // Update Account Financials accurately (Remaining balance strictly decreases as amount is collected!)
  const prevBalance = account.remaining_amount;
  account.amount_collected = safeRound(account.amount_collected + netPaidDiff, 2);
  refreshAccountTotals(account);

  if (account.remaining_amount === 0) {
    account.status = 'COMPLETED';
    account.actual_completion_date = dateStr;
  }

  const receiptNum = nextId(db, 'receipt', db.receipts.map(r => r.receipt_number));
  const paymentId = `PAY-${Date.now()}`;
  const receiptId = `REC-${Date.now()}`;

  if (!dailyRecord) {
    dailyRecord = {
      id: `DC-${dateStr}-${account.id}`,
      collection_account_id: account.id,
      customer_id: account.customer_id,
      customer_name: account.customer_name,
      shop_name: account.shop_name || '',
      mobile_number: db.customers.find(c => c.id === account.customer_id)?.mobile_number || '',
      date: dateStr,
      daily_due: dailyDue,
      paid_amount: paid,
      pending_amount: pendingAmount,
      advance_amount: advanceAmount,
      status,
      payment_mode: paid > 0 ? (payment_mode || db.config.masters.default_payment_mode) : undefined,
      collector_id: collector.id,
      collector_name: collector.name,
      collection_area: account.collection_area,
      reason,
      remarks,
      receipt_id: paid > 0 ? receiptId : undefined,
      receipt_number: paid > 0 ? receiptNum : undefined,
      balance_remaining: account.remaining_amount,
    };
    db.daily_collections.push(dailyRecord);
  } else {
    dailyRecord.paid_amount = paid;
    dailyRecord.pending_amount = pendingAmount;
    dailyRecord.advance_amount = advanceAmount;
    dailyRecord.status = status;
    dailyRecord.payment_mode = paid > 0 ? (payment_mode || db.config.masters.default_payment_mode) : undefined;
    dailyRecord.collector_id = collector.id;
    dailyRecord.collector_name = collector.name;
    dailyRecord.reason = reason;
    dailyRecord.remarks = remarks;
    dailyRecord.receipt_id = paid > 0 ? receiptId : undefined;
    dailyRecord.receipt_number = paid > 0 ? receiptNum : undefined;
    dailyRecord.balance_remaining = account.remaining_amount;
  }

  let createdReceipt: Receipt | null = null;

  // If customer paid money, create PaymentTransaction and Receipt
  if (paid > 0) {
    const paymentTx: PaymentTransaction = {
      id: paymentId,
      receipt_number: receiptNum,
      collection_account_id: account.id,
      customer_id: account.customer_id,
      customer_name: account.customer_name,
      shop_name: account.shop_name || '',
      collection_date: dateStr,
      daily_due: dailyDue,
      amount_paid: paid,
      advance_amount: advanceAmount,
      payment_mode: payment_mode || db.config.masters.default_payment_mode,
      collector_id: collector.id,
      collector_name: collector.name,
      previous_balance: prevBalance,
      remaining_balance: account.remaining_amount,
      status: advanceAmount > 0 ? 'ADVANCE' : (pendingAmount > 0 ? 'PARTIAL' : 'SUCCESS'),
      transaction_ref: resolvedTxRef,
      remarks,
      created_at: new Date().toISOString(),
    };
    db.payments.push(paymentTx);

    const newReceipt: Receipt = {
      id: receiptId,
      receipt_number: receiptNum,
      payment_id: paymentId,
      collection_account_id: account.id,
      customer_id: account.customer_id,
      customer_name: account.customer_name,
      shop_name: account.shop_name || '',
      daily_due: dailyDue,
      amount_paid: paid,
      payment_mode: payment_mode || db.config.masters.default_payment_mode,
      transaction_ref: resolvedTxRef,
      previous_balance: prevBalance,
      remaining_balance: account.remaining_amount,
      collector_name: collector.name,
      date: dateStr,
      created_at: new Date().toISOString(),
      remarks: remarks || 'Thank you for your prompt payment.',
    };
    createdReceipt = newReceipt;
    db.receipts.push(newReceipt);

    createNotification(
      'CUSTOMER',
      `Payment Received: ₹${paid}`,
      `Received ₹${paid} for account ${account.id}. Balance remaining: ₹${account.remaining_amount}. Receipt #${receiptNum}`,
      'PAYMENT',
      account.customer_id
    );

    logAudit(collector.name, 'COLLECTOR', 'COLLECT_PAYMENT', account.id, 'payments', { balance: prevBalance }, { paid, newBalance: account.remaining_amount, receiptNum });
  } else {
    // Missed collection record
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

  res.json({
    success: true,
    dailyRecord,
    account,
    receipt: createdReceipt,
  });
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

  const role = String(req.body?.role || 'ADMIN').toUpperCase();
  const by = String(req.body?.by || 'admin');

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
  const collectorId = req.body.collector_id || payment.collector_id;
  const collectorName = req.body.collector_name || (collectorId ? db.collectors.find(c => c.id === collectorId)?.name : payment.collector_name) || payment.collector_name;

  if (!Number.isFinite(newAmount) || newAmount <= 0) {
    return res.status(400).json({ error: 'Please enter a valid positive payment amount.' });
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
  payment.advance_amount = Math.max(0, safeRound(newAmount - account.daily_collection, 2));
  payment.status = newAmount > account.daily_collection ? 'ADVANCE' : (newAmount < account.daily_collection ? 'PARTIAL' : 'SUCCESS');
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

  // Recalculate account totals strictly based on all active payments
  const allActive = db.payments.filter(p => p.collection_account_id === account.id && isActivePayment(p));
  account.amount_collected = safeRound(allActive.reduce((s, p) => s + p.amount_paid, 0), 2);
  refreshAccountTotals(account);

  if (account.remaining_amount === 0) {
    account.status = 'COMPLETED';
    account.actual_completion_date = newDate;
  } else if (account.status === 'COMPLETED' && account.remaining_amount > 0) {
    account.status = 'ACTIVE';
    delete account.actual_completion_date;
  }

  payment.remaining_balance = account.remaining_amount;
  if (receipt) {
    receipt.remaining_balance = account.remaining_amount;
  }

  // Sync daily collection records for oldDate and newDate
  const updateDailyRecordForDate = (targetDate: string) => {
    const dayPayments = db.payments.filter(
      p => p.collection_account_id === account.id && p.collection_date === targetDate && isActivePayment(p)
    );
    const dayPaid = safeRound(dayPayments.reduce((s, p) => s + p.amount_paid, 0), 2);
    let dailyRec = db.daily_collections.find(
      d => d.collection_account_id === account.id && d.date === targetDate
    );

    if (dayPaid === 0) {
      if (dailyRec) {
        dailyRec.paid_amount = 0;
        dailyRec.pending_amount = dailyRec.daily_due;
        dailyRec.advance_amount = 0;
        dailyRec.status = 'PENDING';
        dailyRec.payment_mode = undefined;
        dailyRec.receipt_id = undefined;
        dailyRec.receipt_number = undefined;
        dailyRec.balance_remaining = account.remaining_amount;
      }
    } else {
      const dailyDue = account.daily_collection;
      const advance = Math.max(0, safeRound(dayPaid - dailyDue, 2));
      const pending = Math.max(0, safeRound(dailyDue - dayPaid, 2));
      const status = advance > 0 ? 'ADVANCE' : (pending > 0 ? 'PARTIAL' : 'PAID');
      const latestPay = dayPayments[dayPayments.length - 1];

      if (!dailyRec) {
        dailyRec = {
          id: `DC-${targetDate}-${account.id}`,
          collection_account_id: account.id,
          customer_id: account.customer_id,
          customer_name: account.customer_name,
          shop_name: account.shop_name || '',
          mobile_number: db.customers.find(c => c.id === account.customer_id)?.mobile_number || '',
          date: targetDate,
          daily_due: dailyDue,
          paid_amount: dayPaid,
          pending_amount: pending,
          advance_amount: advance,
          status,
          payment_mode: latestPay.payment_mode,
          collector_id: latestPay.collector_id,
          collector_name: latestPay.collector_name,
          collection_area: account.collection_area,
          remarks: latestPay.remarks,
          receipt_id: latestPay.id,
          receipt_number: latestPay.receipt_number,
          balance_remaining: account.remaining_amount,
        };
        db.daily_collections.push(dailyRec);
      } else {
        dailyRec.paid_amount = dayPaid;
        dailyRec.pending_amount = pending;
        dailyRec.advance_amount = advance;
        dailyRec.status = status;
        dailyRec.payment_mode = latestPay.payment_mode;
        dailyRec.collector_id = latestPay.collector_id;
        dailyRec.collector_name = latestPay.collector_name;
        dailyRec.remarks = latestPay.remarks;
        dailyRec.receipt_number = latestPay.receipt_number;
        dailyRec.balance_remaining = account.remaining_amount;
      }
    }
  };

  updateDailyRecordForDate(oldDate);
  if (newDate !== oldDate) {
    updateDailyRecordForDate(newDate);
  }

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

  const by = String(req.body?.by || 'admin');
  const role = String(req.body?.role || 'ADMIN').toUpperCase();
  const isAdmin = role === 'ADMIN';

  // Collectors are restricted to today; Admins can undo payments across any month!
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

  // Recalculate account totals from remaining active payments
  const allActive = db.payments.filter(p => p.collection_account_id === account.id && isActivePayment(p));
  account.amount_collected = safeRound(allActive.reduce((s, p) => s + p.amount_paid, 0), 2);
  refreshAccountTotals(account);
  if (account.status === 'COMPLETED' && account.remaining_amount > 0) {
    account.status = 'ACTIVE';
    delete account.actual_completion_date;
  }

  // Sync daily collection record for that payment date
  const dayPayments = db.payments.filter(
    p => p.collection_account_id === account.id && p.collection_date === payment.collection_date && isActivePayment(p)
  );
  const dayPaid = safeRound(dayPayments.reduce((s, p) => s + p.amount_paid, 0), 2);
  const dailyRecord = db.daily_collections.find(
    d => d.collection_account_id === account.id && d.date === payment.collection_date
  );

  if (dailyRecord) {
    if (dayPaid === 0) {
      dailyRecord.paid_amount = 0;
      dailyRecord.pending_amount = dailyRecord.daily_due;
      dailyRecord.advance_amount = 0;
      dailyRecord.status = 'PENDING';
      dailyRecord.payment_mode = undefined;
      dailyRecord.receipt_id = undefined;
      dailyRecord.receipt_number = undefined;
      dailyRecord.reason = undefined;
      dailyRecord.remarks = 'Payment undone by admin';
      dailyRecord.balance_remaining = account.remaining_amount;
    } else {
      dailyRecord.paid_amount = dayPaid;
      dailyRecord.pending_amount = Math.max(0, safeRound(dailyRecord.daily_due - dayPaid, 2));
      dailyRecord.advance_amount = Math.max(0, safeRound(dayPaid - dailyRecord.daily_due, 2));
      dailyRecord.status = dailyRecord.advance_amount > 0 ? 'ADVANCE' : (dailyRecord.pending_amount > 0 ? 'PARTIAL' : 'PAID');
      dailyRecord.balance_remaining = account.remaining_amount;
    }
  }

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
app.get('/api/reports/monthly', (req: Request, res: Response) => {
  const db = repository.getDb();
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
  const rows = accounts.map(acc => {
    const cust = db.customers.find(c => c.id === acc.customer_id);
    const addr = db.customer_addresses.find(a => a.customer_id === acc.customer_id);
    const biz = db.business_details.find(b => b.customer_id === acc.customer_id);

    // Get daily payments for this account in this month
    const dailyCollections: { [day: number]: number } = {};
    let monthlyTotal = 0;
    let scheduledDaysInMonth = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${monthPrefix}-${String(day).padStart(2, '0')}`;
      const rec = db.daily_collections.find(d => d.collection_account_id === acc.id && d.date === dateStr);
      const paid = rec ? rec.paid_amount : 0;
      dailyCollections[day] = paid;
      monthlyTotal += paid;

      // Section 13: Calculate monthly totals according to actual calendar dates
      if (dateStr >= acc.start_date && dateStr <= acc.expected_end_date) {
        scheduledDaysInMonth++;
      }
    }

    const expectedMonthly = safeRound(acc.daily_collection * scheduledDaysInMonth, 2);
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
    dailyTotals[day] = rows.reduce((sum, r) => sum + (r.dailyCollections[day] || 0), 0);
  }

  const totals = {
    requested: rows.reduce((s, r) => s + r.requestedAmount, 0),
    disbursed: rows.reduce((s, r) => s + r.disbursedAmount, 0),
    totalRepayment: rows.reduce((s, r) => s + r.totalRepayment, 0),
    financeMargin: rows.reduce((s, r) => s + r.financeMargin, 0),
    monthlyTotal: rows.reduce((s, r) => s + r.monthlyTotal, 0),
    expectedMonthly: rows.reduce((s, r) => s + r.expectedMonthlyCollection, 0),
    actualMonthly: rows.reduce((s, r) => s + r.actualMonthlyCollection, 0),
    monthlyPending: rows.reduce((s, r) => s + r.monthlyPending, 0),
    collectionPercentage: rows.length > 0
      ? safeRound(rows.reduce((s, r) => s + r.collectionPercentage, 0) / rows.length, 1)
      : 0,
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

    return {
      ...col,
      today_customers_count: assignedAccounts.length,
      today_collected_amount: todayCollected,
      monthly_collected_amount: assignedAccounts.reduce((sum, a) => sum + a.amount_collected, 0),
    };
  });
  res.json(list);
});

app.post('/api/collectors', (req: Request, res: Response) => {
  const db = repository.getDb();
  const colId = nextId(db, 'collector', db.collectors.map(c => c.id));
  const newCol: Collector = {
    id: colId,
    name: req.body.name,
    photo: req.body.photo || '',
    mobile: req.body.mobile,
    email: req.body.email,
    address: req.body.address || '',
    assigned_area: req.body.assigned_area || db.config.masters.default_location.area,
    joining_date: req.body.joining_date || todayIso(),
    target_amount: Number(req.body.target_amount) || 0,
    status: 'ACTIVE',
  };

  db.collectors.push(newCol);

  // Sync login credentials in db.users
  const colUsername = String(req.body.username || colId).trim();
  const colPassword = String(req.body.password || '1234').trim();
  const colUser: User = {
    id: `USR-${colId}`,
    username: colUsername,
    email: newCol.email || `${colId.toLowerCase()}@dailycollection.com`,
    password: colPassword,
    role: 'COLLECTOR',
    collector_id: colId,
    name: newCol.name,
    phone: newCol.mobile,
    is_active: true,
    created_at: newCol.joining_date,
  };
  db.users.push(colUser);

  logAudit('admin', 'ADMIN', 'ADD_COLLECTOR', colId, 'collectors', null, newCol);
  repository.save();
  res.status(201).json(newCol);
});

app.put('/api/collectors/:id', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const col = db.collectors.find(c => c.id === id);
  if (!col) return res.status(404).json({ error: 'Collector not found' });
  const oldCol = { ...col };
  Object.assign(col, req.body);

  // Sync login credentials in db.users
  const colUser = db.users.find(u => u.collector_id === id);
  if (colUser) {
    if (req.body.username) colUser.username = String(req.body.username).trim();
    if (req.body.password) colUser.password = String(req.body.password).trim();
    if (req.body.name) colUser.name = String(req.body.name).trim();
    if (req.body.mobile) colUser.phone = String(req.body.mobile).trim();
    if (req.body.status) colUser.is_active = req.body.status === 'ACTIVE';
  } else if (req.body.username || req.body.password) {
    db.users.push({
      id: `USR-${id}`,
      username: String(req.body.username || id).trim(),
      email: col.email || `${id.toLowerCase()}@dailycollection.com`,
      password: String(req.body.password || '1234').trim(),
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
    if (db.config.masters.default_location.area === from) db.config.masters.default_location.area = newName;
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

app.put('/api/notifications/read-all', (req: Request, res: Response) => {
  const db = repository.getDb();
  db.notifications.forEach(n => { n.is_read = true; });
  repository.save();
  res.json({ success: true });
});

app.post('/api/customer/loan-request', (req: Request, res: Response) => {
  const { customer_id, requested_amount, collection_days, purpose, remarks } = req.body;
  if (!customer_id || !requested_amount) {
    return res.status(400).json({ error: 'Customer ID and requested amount are required' });
  }
  const db = repository.getDb();
  const customer = db.customers.find(c => c.id === customer_id);
  const biz = db.business_details.find(b => b.customer_id === customer_id);
  const now = new Date().toISOString();
  const reqId = `LR-${Date.now().toString().slice(-6)}`;

  const customerName = customer ? customer.full_name : customer_id;
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
    requested_amount: Number(requested_amount),
    collection_days: Number(collection_days || 100),
    purpose: purpose || 'Working Capital',
    remarks: remarks || '',
    status: 'PENDING' as const,
    created_at: now,
  };
  db.loan_requests.unshift(requestRecord);

  repository.save();
  res.json({ success: true, request: requestRecord });
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
