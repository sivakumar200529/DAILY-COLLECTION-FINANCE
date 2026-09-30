import express, { Request, Response } from 'express';
import cors from 'cors';
import {
  repository,
  initializeDatabase,
  seedDatabase,
  CustomerPersonalDetails,
  CustomerAddress,
  BusinessDetails,
  CollectionPlan,
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
  SystemSettings,
  User,
} from './db.ts';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize DB schema & seeds
initializeDatabase();

// Helpers
function getParam(req: Request, key: string): string {
  const val = req.params[key];
  return Array.isArray(val) ? val[0] : val || '';
}

function safeRound(num: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
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
// 2. DASHBOARD STATS & CHARTS
// -------------------------------------------------------------
app.get('/api/dashboard/stats', (req: Request, res: Response) => {
  const db = repository.getDb();
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = todayStr.slice(0, 7); // YYYY-MM

  const activeAccounts = db.collection_accounts.filter(a => a.status === 'ACTIVE' || a.status === 'OVERDUE');
  
  // Today's collections
  const todayCollections = db.daily_collections.filter(d => d.date === todayStr);
  const todayExpected = activeAccounts.reduce((sum, a) => sum + a.daily_collection, 0);
  const todayCollected = todayCollections.reduce((sum, d) => sum + d.paid_amount, 0);
  const todayPending = Math.max(0, todayExpected - todayCollected);
  const todayCollectionRate = todayExpected > 0 ? safeRound((todayCollected / todayExpected) * 100, 1) : 0;

  // Monthly collections
  const monthlyPayments = db.payments.filter(p => p.collection_date.startsWith(currentMonthStr));
  const monthlyCollection = monthlyPayments.reduce((sum, p) => sum + p.amount_paid, 0);

  // Financial aggregates
  const totalOutstanding = db.collection_accounts.reduce((sum, a) => sum + a.remaining_amount, 0);
  const totalFinanceMargin = db.collection_accounts.reduce((sum, a) => sum + a.finance_margin, 0);
  const totalDisbursed = db.collection_accounts.reduce((sum, a) => sum + a.disbursed_amount, 0);
  const totalRepayment = db.collection_accounts.reduce((sum, a) => sum + a.total_repayment, 0);
  const overdueCustomersCount = db.collection_accounts.filter(a => a.status === 'OVERDUE').length;

  res.json({
    totalCustomers: db.customers.length,
    activeAccounts: activeAccounts.length,
    todayExpected,
    todayCollected,
    todayPending,
    todayCollectionRate,
    monthlyCollection,
    totalOutstanding,
    totalFinanceMargin,
    totalDisbursed,
    totalRepayment,
    overdueCustomersCount,
  });
});

app.get('/api/dashboard/charts', (req: Request, res: Response) => {
  const db = repository.getDb();

  // 1. Daily trend (past 14 days)
  const dailyTrend: { date: string; expected: number; collected: number; pending: number }[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const recs = db.daily_collections.filter(r => r.date === dateStr);
    const dayCollected = recs.reduce((sum, r) => sum + r.paid_amount, 0);
    const dayExpected = recs.length > 0 
      ? recs.reduce((sum, r) => sum + r.daily_due, 0)
      : db.collection_accounts.filter(a => a.status === 'ACTIVE').reduce((sum, a) => sum + a.daily_collection, 0);
    const dayPending = Math.max(0, dayExpected - dayCollected);

    dailyTrend.push({
      date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      expected: dayExpected,
      collected: dayCollected,
      pending: dayPending,
    });
  }

  // 2. Monthly trend
  const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
  const monthlyTrend = months.map((m, idx) => {
    const monthNum = String(idx + 4).padStart(2, '0');
    const monthStr = `2026-${monthNum}`;
    const pays = db.payments.filter(p => p.collection_date.startsWith(monthStr));
    const collected = pays.length > 0 ? pays.reduce((sum, p) => sum + p.amount_paid, 0) : (idx + 1) * 22000;
    const disbursed = (idx === 4 || idx === 5) ? 61600 : 44000;
    return {
      month: m,
      target: 65000,
      collected,
      disbursed,
    };
  });

  // 3. Payment Status breakdown for active accounts today
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayRecs = db.daily_collections.filter(r => r.date === todayStr);
  const paidCount = todayRecs.filter(r => r.status === 'PAID' || r.status === 'ADVANCE').length || 4;
  const partialCount = todayRecs.filter(r => r.status === 'PARTIAL').length || 1;
  const pendingCount = todayRecs.filter(r => r.status === 'PENDING').length || 1;
  const overdueCount = db.collection_accounts.filter(a => a.status === 'OVERDUE').length || 1;

  const paymentStatusDistribution = [
    { name: 'Paid in Full', value: paidCount, color: '#10b981' },
    { name: 'Partial Paid', value: partialCount, color: '#f59e0b' },
    { name: 'Pending Today', value: pendingCount, color: '#3b82f6' },
    { name: 'Overdue / Missed', value: overdueCount, color: '#ef4444' },
  ];

  // 4. Financial Summary
  const totalDisbursed = db.collection_accounts.reduce((sum, a) => sum + a.disbursed_amount, 0);
  const totalRepayment = db.collection_accounts.reduce((sum, a) => sum + a.total_repayment, 0);
  const totalCollected = db.collection_accounts.reduce((sum, a) => sum + a.amount_collected, 0);
  const totalOutstanding = db.collection_accounts.reduce((sum, a) => sum + a.remaining_amount, 0);
  const totalMargin = db.collection_accounts.reduce((sum, a) => sum + a.finance_margin, 0);

  const financeSummary = [
    { name: 'Disbursed', amount: totalDisbursed, fill: '#3b82f6' },
    { name: 'Repayment Goal', amount: totalRepayment, fill: '#8b5cf6' },
    { name: 'Collected', amount: totalCollected, fill: '#10b981' },
    { name: 'Outstanding', amount: totalOutstanding, fill: '#f59e0b' },
    { name: 'Margin', amount: totalMargin, fill: '#d97706' },
  ];

  // 5. Area Performance
  const areaPerformance = db.areas.map(a => {
    const areaAccs = db.collection_accounts.filter(acc => acc.collection_area === a.area_name);
    const collected = areaAccs.reduce((sum, acc) => sum + acc.amount_collected, 0);
    const target = areaAccs.reduce((sum, acc) => sum + acc.total_repayment, 0);
    return {
      area: a.area_name,
      collected,
      target: target > 0 ? target : 20000,
    };
  });

  res.json({
    dailyTrend,
    monthlyTrend,
    paymentStatusDistribution,
    financeSummary,
    areaPerformance,
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
    const activeAcc = db.collection_accounts.find(a => a.customer_id === c.id && (a.status === 'ACTIVE' || a.status === 'OVERDUE'));

    return {
      ...c,
      address: addr,
      business: biz,
      activeAccount: activeAcc,
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
  const { personal, address, business } = req.body;

  if (!personal || !personal.full_name || !personal.mobile_number) {
    return res.status(400).json({ error: 'Customer full name and mobile number are required.' });
  }

  // Generate Customer ID: DC1000X
  const nextNum = db.customers.length + 10001;
  const customerId = personal.id || `DC${nextNum}`;

  // Check duplicate
  if (db.customers.some(c => c.mobile_number === personal.mobile_number)) {
    return res.status(400).json({ error: 'A customer with this mobile number already exists.' });
  }

  const newCustomer: CustomerPersonalDetails = {
    id: customerId,
    full_name: personal.full_name,
    profile_photo: personal.profile_photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    gender: personal.gender || 'Male',
    dob: personal.dob || '1990-01-01',
    father_or_husband_name: personal.father_or_husband_name || '',
    mother_name: personal.mother_name || '',
    marital_status: personal.marital_status || 'Married',
    mobile_number: personal.mobile_number,
    alternate_number: personal.alternate_number || '',
    whatsapp_number: personal.whatsapp_number || personal.mobile_number,
    email: personal.email || `${customerId.toLowerCase()}@krsfinance.com`,
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  db.customers.push(newCustomer);

  if (address) {
    const newAddress: CustomerAddress = {
      id: `ADDR-${customerId}`,
      customer_id: customerId,
      door_number: address.door_number || '',
      street: address.street || '',
      area: address.area || 'Bazaar Main Road',
      village_or_town: address.village_or_town || 'Salem',
      city: address.city || 'Salem',
      district: address.district || 'Salem',
      state: address.state || 'Tamil Nadu',
      pincode: address.pincode || '636001',
      landmark: address.landmark || '',
    };
    db.customer_addresses.push(newAddress);
  }

  if (business) {
    const newBiz: BusinessDetails = {
      id: `SHP-${customerId}`,
      customer_id: customerId,
      shop_name: business.shop_name || `${personal.full_name}'s Business`,
      owner_name: personal.full_name,
      business_type: business.business_type || 'Retail',
      business_category: business.business_category || 'Commercial',
      shop_mobile: business.shop_mobile || personal.mobile_number,
      shop_address: business.shop_address || address?.street || '',
      shop_area: business.shop_area || address?.area || 'Bazaar Main Road',
      shop_city: business.shop_city || 'Salem',
      shop_district: business.shop_district || 'Salem',
      shop_pincode: business.shop_pincode || '636001',
      landmark: business.landmark || '',
      years_in_business: Number(business.years_in_business) || 5,
      approx_monthly_income: Number(business.approx_monthly_income) || 50000,
      approx_daily_sales: Number(business.approx_daily_sales) || 10000,
      business_status: 'ACTIVE',
      shop_photo: business.shop_photo || 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=500',
    };
    db.business_details.push(newBiz);
  }

  // Create login user credentials for customer
  const custUser: User = {
    id: `USR-${customerId}`,
    username: customerId,
    email: newCustomer.email || `${customerId.toLowerCase()}@krsfinance.com`,
    password: '1234', // Default PIN
    role: 'CUSTOMER',
    customer_id: customerId,
    name: newCustomer.full_name,
    phone: newCustomer.mobile_number,
    is_active: true,
    created_at: new Date().toISOString(),
  };
  db.users.push(custUser);

  logAudit('admin', 'ADMIN', 'CREATE_CUSTOMER', customerId, 'customers', null, newCustomer);
  createNotification('ADMIN', 'New Customer Added', `Customer ${newCustomer.full_name} (${customerId}) registered successfully.`, 'SYSTEM', customerId);

  repository.save();
  res.status(201).json(newCustomer);
});

app.put('/api/customers/:id', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const cust = db.customers.find(c => c.id === id);
  if (!cust) return res.status(404).json({ error: 'Customer not found' });

  const { personal, address, business } = req.body;
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
  const accounts = db.collection_accounts.filter(a => a.customer_id === id);
  const activeAccount = accounts.find(a => a.status === 'ACTIVE' || a.status === 'OVERDUE') || accounts[0];
  const recentPayments = db.payments.filter(p => p.customer_id === id).slice(-30);
  const receipts = db.receipts.filter(r => r.customer_id === id);
  const documents = db.documents.filter(d => d.customer_id === id);
  const notes = db.customer_notes.filter(n => n.customer_id === id);
  const auditLogs = db.audit_logs.filter(l => l.record_id === id || l.record_id === activeAccount?.id);

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
      overdueDays: activeAccount?.status === 'OVERDUE' ? 5 : 0,
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
// 5. COLLECTION PLANS
// -------------------------------------------------------------
app.get('/api/plans', (req: Request, res: Response) => {
  const db = repository.getDb();
  res.json(db.collection_plans);
});

app.post('/api/plans', (req: Request, res: Response) => {
  const db = repository.getDb();
  const {
    plan_name,
    requested_amount,
    disbursed_amount,
    daily_collection,
    collection_days,
    description,
  } = req.body;

  const reqAmt = Number(requested_amount);
  const disbAmt = Number(disbursed_amount);
  const daily = Number(daily_collection);
  const days = Number(collection_days);

  if (!plan_name || reqAmt <= 0 || disbAmt <= 0 || daily <= 0 || days <= 0) {
    return res.status(400).json({ error: 'All plan amounts and duration are required and must be greater than zero.' });
  }

  // Exact Daily Collection Business Model Formula:
  // Total Repayment = Daily Collection * Collection Days
  // Finance Margin = Total Repayment - Disbursed Amount
  const totalRepayment = safeRound(daily * days, 2);
  const financeMargin = safeRound(totalRepayment - disbAmt, 2);

  const planId = `PLAN-${Date.now()}`;
  const newPlan: CollectionPlan = {
    id: planId,
    plan_name,
    requested_amount: reqAmt,
    disbursed_amount: disbAmt,
    daily_collection: daily,
    collection_days: days,
    total_repayment: totalRepayment,
    finance_margin: financeMargin,
    status: 'ACTIVE',
    description: description || `${reqAmt} requested, ${disbAmt} disbursed, ${daily}/day for ${days} days. Margin: ${financeMargin}`,
    created_at: new Date().toISOString(),
  };

  db.collection_plans.push(newPlan);
  logAudit('admin', 'ADMIN', 'CREATE_PLAN', planId, 'collection_plans', null, newPlan);
  repository.save();

  res.status(201).json(newPlan);
});

app.put('/api/plans/:id', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const plan = db.collection_plans.find(p => p.id === id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });

  const oldPlan = { ...plan };
  Object.assign(plan, req.body);

  if (req.body.daily_collection || req.body.collection_days || req.body.disbursed_amount) {
    plan.total_repayment = safeRound(plan.daily_collection * plan.collection_days, 2);
    plan.finance_margin = safeRound(plan.total_repayment - plan.disbursed_amount, 2);
  }

  logAudit('admin', 'ADMIN', 'UPDATE_PLAN', id, 'collection_plans', oldPlan, plan);
  repository.save();
  res.json(plan);
});

app.delete('/api/plans/:id', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const idx = db.collection_plans.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Plan not found' });
  const [removed] = db.collection_plans.splice(idx, 1);
  logAudit('admin', 'ADMIN', 'DELETE_PLAN', id, 'collection_plans', removed, null);
  repository.save();
  res.json({ message: 'Plan deleted successfully' });
});

// -------------------------------------------------------------
// 6. COLLECTION ACCOUNTS
// -------------------------------------------------------------
app.get('/api/collection-accounts', (req: Request, res: Response) => {
  const db = repository.getDb();
  res.json(db.collection_accounts);
});

function calculateEndDateUtc(startDateStr: string, collectionDays: number): string {
  if (!startDateStr || collectionDays <= 0) return startDateStr || '';
  const [y, m, d] = startDateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + (collectionDays - 1));
  const endYear = date.getUTCFullYear();
  const endMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
  const endDay = String(date.getUTCDate()).padStart(2, '0');
  return `${endYear}-${endMonth}-${endDay}`;
}

app.post('/api/collection-accounts', (req: Request, res: Response) => {
  const db = repository.getDb();
  const {
    customer_id,
    plan_id,
    requested_amount,
    margin_percentage,
    collection_days,
    daily_collection,
    start_date,
    assigned_collector_id,
    collection_area,
  } = req.body;

  const customer = db.customers.find(c => c.id === customer_id);
  const biz = db.business_details.find(b => b.customer_id === customer_id);
  const plan = db.collection_plans.find(p => p.id === plan_id);
  const collector = db.collectors.find(c => c.id === assigned_collector_id) || db.collectors[0];

  if (!customer) {
    return res.status(400).json({ error: 'Valid customer is required' });
  }

  // Section 1, 2, 5: Requested Amount -> Margin % -> Disbursed Amount -> Total Repayment
  const reqAmount = Number(requested_amount) || (plan ? plan.requested_amount : 10000);
  const marginPct = margin_percentage !== undefined ? Number(margin_percentage) : (biz?.default_margin_percentage ?? 12);
  const marginAmount = safeRound(reqAmount * (marginPct / 100), 2);
  const disbursedAmount = safeRound(reqAmount - marginAmount, 2);
  const totalRepayment = reqAmount; // Customer repays the original requested amount

  // Section 6, 8, 9: Collection Period & Exact Calendar End Date
  const colDays = Number(collection_days) || (plan ? plan.collection_days : 100);
  const dailyDue = daily_collection !== undefined ? Number(daily_collection) : safeRound(totalRepayment / colDays, 2);
  const startDateStr = start_date || new Date().toISOString().slice(0, 10);
  const expectedEndDateStr = calculateEndDateUtc(startDateStr, colDays);

  const accId = `ACC-2026-${String(db.collection_accounts.length + 1).padStart(3, '0')}`;
  const planName = plan ? plan.plan_name : `${colDays}-Day Doorstep Plan (₹${reqAmount.toLocaleString('en-IN')})`;

  const newAccount: CollectionAccount = {
    id: accId,
    customer_id: customer.id,
    customer_name: customer.full_name,
    shop_name: biz?.shop_name || 'Retail Business',
    plan_id: plan ? plan.id : `CUSTOM_${colDays}D_${reqAmount}`,
    plan_name: planName,
    requested_amount: reqAmount,
    margin_percentage: marginPct,
    margin_amount: marginAmount,
    disbursed_amount: disbursedAmount,
    daily_collection: dailyDue,
    collection_days: colDays,
    total_repayment: totalRepayment,
    finance_margin: marginAmount,
    start_date: startDateStr,
    expected_end_date: expectedEndDateStr,
    amount_collected: 0,
    remaining_amount: totalRepayment,
    completed_days: 0,
    remaining_days: colDays,
    collection_percentage: 0,
    assigned_collector_id: collector.id,
    assigned_collector_name: collector.name,
    collection_area: collection_area || biz?.shop_area || 'Bazaar Main Road',
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.collection_accounts.push(newAccount);

  // Section 10 & 11: Generate Full Schedule across calendar months
  const [sY, sM, sD] = startDateStr.split('-').map(Number);
  const curDate = new Date(Date.UTC(sY, sM - 1, sD));

  for (let dayNum = 1; dayNum <= colDays; dayNum++) {
    const yStr = curDate.getUTCFullYear();
    const mStr = String(curDate.getUTCMonth() + 1).padStart(2, '0');
    const dStr = String(curDate.getUTCDate()).padStart(2, '0');
    const dateStr = `${yStr}-${mStr}-${dStr}`;

    const scheduledRecord: DailyCollectionRecord = {
      id: `DC-${dateStr}-${accId}`,
      collection_account_id: accId,
      customer_id: customer.id,
      customer_name: customer.full_name,
      shop_name: biz?.shop_name || 'Retail Business',
      mobile_number: customer.mobile_number,
      collection_day_number: dayNum,
      calendar_date: dateStr,
      date: dateStr,
      daily_due: dailyDue,
      due_amount: dailyDue,
      paid_amount: 0,
      pending_amount: dailyDue,
      advance_amount: 0,
      status: 'PENDING',
      collector_id: collector.id,
      collector_name: collector.name,
      collection_area: newAccount.collection_area,
      remarks: 'Scheduled collection day',
      balance_remaining: totalRepayment,
    };

    // Avoid duplicate if record exists
    const existingIdx = db.daily_collections.findIndex(d => d.id === scheduledRecord.id);
    if (existingIdx >= 0) {
      db.daily_collections[existingIdx] = scheduledRecord;
    } else {
      db.daily_collections.push(scheduledRecord);
    }

    curDate.setUTCDate(curDate.getUTCDate() + 1);
  }

  logAudit('admin', 'ADMIN', 'DISBURSE_COLLECTION_ACCOUNT', accId, 'collection_accounts', null, newAccount);
  createNotification(
    'ADMIN',
    'New Collection Account Disbursed',
    `Account ${accId} disbursed to ${customer.full_name}: ₹${disbursedAmount} disbursed for ₹${reqAmount} requested at ${marginPct}% margin.`,
    'ACCOUNT',
    customer.id
  );
  createNotification(
    'CUSTOMER',
    'Loan Account Activated',
    `Your collection account ${accId} is active! ₹${disbursedAmount} disbursed. Daily collection: ₹${dailyDue} for ${colDays} days.`,
    'ACCOUNT',
    customer.id
  );

  repository.save();
  res.status(201).json(newAccount);
});

app.get('/api/collection-accounts/:id/schedule', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const schedule = db.daily_collections
    .filter(d => d.collection_account_id === id)
    .sort((a, b) => (a.collection_day_number || 0) - (b.collection_day_number || 0) || a.date.localeCompare(b.date));
  res.json(schedule);
});

app.put('/api/collection-accounts/:id', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const acc = db.collection_accounts.find(a => a.id === id);
  if (!acc) return res.status(404).json({ error: 'Collection account not found' });

  const oldVal = { ...acc };
  const {
    daily_collection,
    remaining_amount,
    amount_collected,
    disbursed_amount,
    requested_amount,
    collection_days,
    total_repayment,
    assigned_collector_id,
    assigned_collector_name,
    collection_area,
    status,
  } = req.body;

  if (daily_collection !== undefined) acc.daily_collection = Number(daily_collection);
  if (remaining_amount !== undefined) acc.remaining_amount = Number(remaining_amount);
  if (amount_collected !== undefined) acc.amount_collected = Number(amount_collected);
  if (disbursed_amount !== undefined) acc.disbursed_amount = Number(disbursed_amount);
  if (requested_amount !== undefined) acc.requested_amount = Number(requested_amount);
  if (collection_days !== undefined) acc.collection_days = Number(collection_days);
  if (total_repayment !== undefined) acc.total_repayment = Number(total_repayment);
  if (assigned_collector_id) {
    acc.assigned_collector_id = assigned_collector_id;
    const col = db.collectors.find(c => c.id === assigned_collector_id);
    if (col) acc.assigned_collector_name = col.name;
  }
  if (assigned_collector_name) acc.assigned_collector_name = assigned_collector_name;
  if (collection_area) acc.collection_area = collection_area;
  if (status) acc.status = status;

  // Recalculate metrics
  acc.completed_days = Math.floor(acc.amount_collected / (acc.daily_collection || 100));
  acc.remaining_days = Math.max(0, acc.collection_days - acc.completed_days);
  acc.collection_percentage = safeRound((acc.amount_collected / (acc.total_repayment || 1)) * 100, 1);
  if (acc.remaining_amount === 0) {
    acc.status = 'COMPLETED';
  }
  acc.updated_at = new Date().toISOString();

  // Cascade changes to today's daily collection record
  const todayStr = new Date().toISOString().slice(0, 10);
  const dailyRec = db.daily_collections.find(d => d.collection_account_id === acc.id && d.date === todayStr);
  if (dailyRec) {
    dailyRec.daily_due = acc.daily_collection;
    dailyRec.balance_remaining = acc.remaining_amount;
    if (assigned_collector_id) dailyRec.collector_id = acc.assigned_collector_id;
    if (acc.assigned_collector_name) dailyRec.collector_name = acc.assigned_collector_name;
    if (collection_area) dailyRec.collection_area = acc.collection_area;
  }

  logAudit('admin', 'ADMIN', 'UPDATE_COLLECTION_ACCOUNT', acc.id, 'collection_accounts', oldVal, acc);
  repository.save();
  res.json(acc);
});

app.delete('/api/collection-accounts/:id', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const idx = db.collection_accounts.findIndex(a => a.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Collection account not found' });

  const deleted = db.collection_accounts.splice(idx, 1)[0];
  db.daily_collections = db.daily_collections.filter(d => d.collection_account_id !== id);

  logAudit('admin', 'ADMIN', 'DELETE_COLLECTION_ACCOUNT', id, 'collection_accounts', deleted, null);
  repository.save();
  res.json({ message: 'Collection account deleted successfully' });
});

app.put('/api/daily-collections/:id', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const rec = db.daily_collections.find(d => d.id === id);
  if (!rec) return res.status(404).json({ error: 'Daily collection record not found' });

  const oldVal = { ...rec };
  const {
    daily_due,
    paid_amount,
    status,
    payment_mode,
    collector_id,
    route_order,
    remarks,
    reason,
  } = req.body;

  if (daily_due !== undefined) rec.daily_due = Number(daily_due);
  if (paid_amount !== undefined) rec.paid_amount = Number(paid_amount);
  if (status) rec.status = status;
  if (payment_mode) rec.payment_mode = payment_mode;
  if (route_order !== undefined) rec.route_order = Number(route_order);
  if (collector_id) {
    rec.collector_id = collector_id;
    const col = db.collectors.find(c => c.id === collector_id);
    if (col) rec.collector_name = col.name;
  }
  if (remarks !== undefined) rec.remarks = remarks;
  if (reason !== undefined) rec.reason = reason;

  logAudit('admin', 'ADMIN', 'UPDATE_DAILY_COLLECTION_RECORD', rec.id, 'daily_collections', oldVal, rec);
  repository.save();
  res.json(rec);
});

// -------------------------------------------------------------
// 7. DAILY COLLECTION SCREEN & PAYMENT PROCESSING
// -------------------------------------------------------------
app.get('/api/daily-collections', (req: Request, res: Response) => {
  const db = repository.getDb();
  const dateStr = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  const area = req.query.area as string;
  const collector = req.query.collector as string;
  const status = req.query.status as string;
  const search = String(req.query.search || '').toLowerCase().trim();

  // Find or generate today's collection working records for all active accounts
  // Find or generate today's collection working records for all active accounts
  const activeAccounts = db.collection_accounts.filter(a => a.status === 'ACTIVE' || a.status === 'OVERDUE');

  activeAccounts.forEach((acc, index) => {
    let rec = db.daily_collections.find(d => d.collection_account_id === acc.id && d.date === dateStr);
    
    // Calculate missed days based on start_date, completed days, and account status
    const elapsedDays = Math.max(0, Math.floor((new Date(dateStr).getTime() - new Date(acc.start_date).getTime()) / (1000 * 60 * 60 * 24)));
    const missedDays = acc.status === 'OVERDUE' 
      ? Math.max(3, elapsedDays - acc.completed_days)
      : Math.max(0, elapsedDays - acc.completed_days);
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

  let records = db.daily_collections.filter(d => d.date === dateStr);

  if (area && area !== 'ALL') {
    records = records.filter(r => r.collection_area === area);
  }
  if (collector && collector !== 'ALL') {
    records = records.filter(r => r.collector_id === collector || r.collector_name === collector);
  }
  if (status === 'MISSED_DAYS') {
    records = records.filter(r => (r.missed_days_count || 0) > 0);
  } else if (status && status !== 'ALL') {
    records = records.filter(r => r.status === status);
  }
  if (search) {
    records = records.filter(r =>
      r.customer_id.toLowerCase().includes(search) ||
      r.customer_name.toLowerCase().includes(search) ||
      r.shop_name.toLowerCase().includes(search) ||
      r.mobile_number.includes(search)
    );
  }

  // Sort by route_order by default
  records.sort((a, b) => (a.route_order || 9999) - (b.route_order || 9999));

  res.json(records);
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
  const dateStr = collection_date || new Date().toISOString().slice(0, 10);
  const paid = is_missed ? 0 : Number(amount_paid);

  const account = db.collection_accounts.find(a => a.id === collection_account_id);
  if (!account) {
    return res.status(404).json({ error: 'Collection account not found' });
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
  account.remaining_amount = Math.max(0, safeRound(account.total_repayment - account.amount_collected, 2));
  account.completed_days = Math.floor(account.amount_collected / account.daily_collection);
  account.remaining_days = Math.max(0, account.collection_days - account.completed_days);
  account.collection_percentage = safeRound((account.amount_collected / account.total_repayment) * 100, 1);

  if (account.remaining_amount === 0) {
    account.status = 'COMPLETED';
    account.actual_completion_date = dateStr;
  }
  account.updated_at = new Date().toISOString();

  // Receipt Number
  const prefix = db.settings?.receipt_prefix || 'DC-REC-';
  const receiptNum = `${prefix}2026-${String(db.receipts.length + 1).padStart(4, '0')}`;
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
      payment_mode: paid > 0 ? (payment_mode || 'Cash') : undefined,
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
    dailyRecord.payment_mode = paid > 0 ? (payment_mode || 'Cash') : undefined;
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
      payment_mode: payment_mode || 'Cash',
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
      payment_mode: payment_mode || 'Cash',
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

/**
 * BULK COLLECT PAYMENTS (For fast processing of multiple accounts)
 */
app.post('/api/daily-collections/bulk-collect', (req: Request, res: Response) => {
  const db = repository.getDb();
  const {
    items, // Array of { collection_account_id: string; amount_paid: number; payment_mode?: string; collector_id?: string; remarks?: string }
    collection_date,
    payment_mode,
    collector_id,
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No collection items provided for bulk collection.' });
  }

  const dateStr = collection_date || new Date().toISOString().slice(0, 10);
  const processedReceipts: Receipt[] = [];
  let totalCollected = 0;

  for (const item of items) {
    const account = db.collection_accounts.find(a => a.id === item.collection_account_id);
    if (!account) continue;

    const paid = Number(item.amount_paid);
    if (paid <= 0) continue;

    const mode = item.payment_mode || payment_mode || 'Cash';
    const coll = db.collectors.find(c => c.id === (item.collector_id || collector_id)) || {
      id: account.assigned_collector_id,
      name: account.assigned_collector_name,
    };

    const dailyDue = account.daily_collection;
    let status: 'PAID' | 'PARTIAL' | 'PENDING' | 'MISSED' | 'ADVANCE' = 'PAID';
    let pendingAmount = 0;
    let advanceAmount = 0;

    if (paid < dailyDue) {
      status = 'PARTIAL';
      pendingAmount = safeRound(dailyDue - paid, 2);
    } else if (paid > dailyDue) {
      status = 'ADVANCE';
      advanceAmount = safeRound(paid - dailyDue, 2);
    } else {
      status = 'PAID';
      pendingAmount = 0;
    }

    let dailyRecord = db.daily_collections.find(
      d => d.collection_account_id === account.id && d.date === dateStr
    );
    const oldPaid = dailyRecord ? (dailyRecord.paid_amount || 0) : 0;
    const netPaidDiff = safeRound(paid - oldPaid, 2);

    const prevBalance = account.remaining_amount;
    account.amount_collected = safeRound(account.amount_collected + netPaidDiff, 2);
    account.remaining_amount = Math.max(0, safeRound(account.total_repayment - account.amount_collected, 2));
    account.completed_days = Math.floor(account.amount_collected / account.daily_collection);
    account.remaining_days = Math.max(0, account.collection_days - account.completed_days);
    account.collection_percentage = safeRound((account.amount_collected / account.total_repayment) * 100, 1);

    if (account.remaining_amount === 0) {
      account.status = 'COMPLETED';
      account.actual_completion_date = dateStr;
    }
    account.updated_at = new Date().toISOString();

    const prefix = db.settings?.receipt_prefix || 'DC-REC-';
    const receiptNum = `${prefix}2026-${String(db.receipts.length + 1).padStart(4, '0')}`;
    const paymentId = `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const receiptId = `REC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

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
        payment_mode: mode as any,
        collector_id: coll.id,
        collector_name: coll.name,
        collection_area: account.collection_area,
        remarks: item.remarks || 'Bulk collection by agent',
        receipt_id: receiptId,
        receipt_number: receiptNum,
        balance_remaining: account.remaining_amount,
      };
      db.daily_collections.push(dailyRecord);
    } else {
      dailyRecord.paid_amount = paid;
      dailyRecord.pending_amount = pendingAmount;
      dailyRecord.advance_amount = advanceAmount;
      dailyRecord.status = status;
      dailyRecord.payment_mode = mode as any;
      dailyRecord.collector_id = coll.id;
      dailyRecord.collector_name = coll.name;
      dailyRecord.remarks = item.remarks || 'Bulk collection by agent';
      dailyRecord.receipt_id = receiptId;
      dailyRecord.receipt_number = receiptNum;
      dailyRecord.balance_remaining = account.remaining_amount;
    }

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
      payment_mode: mode as any,
      collector_id: coll.id,
      collector_name: coll.name,
      previous_balance: prevBalance,
      remaining_balance: account.remaining_amount,
      status: advanceAmount > 0 ? 'ADVANCE' : (pendingAmount > 0 ? 'PARTIAL' : 'SUCCESS'),
      remarks: item.remarks || 'Bulk collection by agent',
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
      payment_mode: mode,
      previous_balance: prevBalance,
      remaining_balance: account.remaining_amount,
      collector_name: coll.name,
      date: dateStr,
      created_at: new Date().toISOString(),
      remarks: item.remarks || 'Bulk collection receipt',
    };
    processedReceipts.push(newReceipt);
    db.receipts.push(newReceipt);
    totalCollected += paid;
  }

  repository.save();

  res.json({
    success: true,
    processed_count: processedReceipts.length,
    total_collected: totalCollected,
    receipts: processedReceipts,
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

// -------------------------------------------------------------
// 9. MONTHLY EXCEL REPORT MATRIX (Day-by-Day Columns 01-Sep..30-Sep)
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
    const todayStr = new Date().toISOString().slice(0, 10);
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
  const colId = `COL${db.collectors.length + 101}`;
  const newCol: Collector = {
    id: colId,
    name: req.body.name,
    photo: req.body.photo || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    mobile: req.body.mobile,
    email: req.body.email,
    address: req.body.address || '',
    assigned_area: req.body.assigned_area || 'Bazaar Main Road',
    joining_date: req.body.joining_date || new Date().toISOString().slice(0, 10),
    target_amount: Number(req.body.target_amount) || 25000,
    status: 'ACTIVE',
  };

  db.collectors.push(newCol);
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
  logAudit('admin', 'ADMIN', 'UPDATE_COLLECTOR', id, 'collectors', oldCol, col);
  repository.save();
  res.json(col);
});

app.delete('/api/collectors/:id', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const idx = db.collectors.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Collector not found' });
  const [removed] = db.collectors.splice(idx, 1);
  logAudit('admin', 'ADMIN', 'DELETE_COLLECTOR', id, 'collectors', removed, null);
  repository.save();
  res.json({ message: 'Collector deleted successfully' });
});

app.get('/api/areas', (req: Request, res: Response) => {
  const db = repository.getDb();
  const list = db.areas.map(a => {
    const count = db.collection_accounts.filter(acc => acc.collection_area === a.area_name).length;
    return { ...a, customer_count: count };
  });
  res.json(list);
});

app.post('/api/areas', (req: Request, res: Response) => {
  const db = repository.getDb();
  const areaId = `AREA${db.areas.length + 101}`;
  const newArea: Area = {
    id: areaId,
    area_name: req.body.area_name,
    city: req.body.city || 'Salem',
    district: req.body.district || 'Salem',
    pincode: req.body.pincode || '636001',
    assigned_collector_id: req.body.assigned_collector_id,
    assigned_collector_name: req.body.assigned_collector_name,
    customer_count: 0,
  };
  db.areas.push(newArea);
  logAudit('admin', 'ADMIN', 'ADD_AREA', areaId, 'areas', null, newArea);
  repository.save();
  res.status(201).json(newArea);
});

app.put('/api/areas/:id', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const area = db.areas.find(a => a.id === id);
  if (!area) return res.status(404).json({ error: 'Area not found' });
  const oldArea = { ...area };
  Object.assign(area, req.body);
  logAudit('admin', 'ADMIN', 'UPDATE_AREA', id, 'areas', oldArea, area);
  repository.save();
  res.json(area);
});

app.delete('/api/areas/:id', (req: Request, res: Response) => {
  const id = getParam(req, 'id');
  const db = repository.getDb();
  const idx = db.areas.findIndex(a => a.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Area not found' });
  const [removed] = db.areas.splice(idx, 1);
  logAudit('admin', 'ADMIN', 'DELETE_AREA', id, 'areas', removed, null);
  repository.save();
  res.json({ message: 'Area deleted successfully' });
});

// -------------------------------------------------------------
// 11. KYC DOCUMENTS
// -------------------------------------------------------------
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

  if (!customer_id || !document_type) {
    return res.status(400).json({ error: 'Customer ID and Document Type are required' });
  }

  const docId = `DOC-${Date.now()}`;
  const newDoc: CustomerDocument = {
    id: docId,
    customer_id,
    document_type,
    document_number: document_number || 'DOC' + Math.floor(100000 + Math.random() * 900000),
    file_url: file_url || 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600',
    file_name: file_name || `${document_type.toLowerCase().replace(/\s+/g, '_')}.pdf`,
    upload_date: new Date().toISOString().slice(0, 10),
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

app.get('/api/audit-logs', (req: Request, res: Response) => {
  const db = repository.getDb();
  res.json(db.audit_logs.slice(0, 100));
});

app.get('/api/settings', (req: Request, res: Response) => {
  const db = repository.getDb();
  res.json(db.settings);
});

app.put('/api/settings', (req: Request, res: Response) => {
  const db = repository.getDb();
  Object.assign(db.settings, req.body);
  repository.save();
  res.json(db.settings);
});

// Reset database to initial seed
app.post('/api/seed/reset', (req: Request, res: Response) => {
  seedDatabase();
  res.json({ message: 'Database reset to sample seed successfully.' });
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(` DAILY COLLECTION - Management Server`);
  console.log(` Listening on port http://localhost:${PORT}`);
  console.log(`=================================================\n`);
});
