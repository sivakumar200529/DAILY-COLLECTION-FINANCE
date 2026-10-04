import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { AppConfig, DEFAULT_CONFIG, LoanProduct, MasterLists, NumberingKind, formatId } from '../shared/config.ts';
import { LoanOverride } from '../shared/finance.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbFilePath = path.resolve(__dirname, '..', 'krs_finance_data.json');
const dbBackupFilePath = path.resolve(__dirname, '..', 'krs_finance_data.backup.json');
const dbTmpFilePath = path.resolve(__dirname, '..', 'krs_finance_data.tmp.json');
// Committed, read-only sample data set. Loaded on demand from the admin Data tab.
export const sampleDataFilePath = path.resolve(__dirname, '..', 'data', 'sample_data.json');

export function safeRound(num: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

export interface User {
  id: string;
  username: string;
  email: string;
  password?: string;
  role: 'ADMIN' | 'CUSTOMER' | 'COLLECTOR';
  name: string;
  phone: string;
  customer_id?: string;
  collector_id?: string;
  is_active: boolean;
  avatar?: string;
  created_at: string;
}

export interface CustomerPersonalDetails {
  id: string;
  full_name: string;
  profile_photo?: string;
  gender: 'Male' | 'Female' | 'Other';
  dob: string;
  father_or_husband_name: string;
  mother_name: string;
  marital_status: 'Married' | 'Single' | 'Other';
  mobile_number: string;
  alternate_number?: string;
  whatsapp_number?: string;
  email?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  created_at: string;
  updated_at: string;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  door_number: string;
  street: string;
  area: string;
  village_or_town: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  landmark: string;
}

export interface BusinessDetails {
  id: string;
  customer_id: string;
  shop_name: string;
  owner_name: string;
  business_type: string;
  business_category: string;
  shop_mobile: string;
  shop_address: string;
  shop_area: string;
  shop_city: string;
  shop_district: string;
  shop_pincode: string;
  landmark: string;
  years_in_business: number;
  approx_monthly_income: number;
  approx_daily_sales: number;
  default_margin_percentage?: number; // Shop-specific default finance margin % (e.g. 10, 12, 15)
  business_status: 'ACTIVE' | 'CLOSED' | 'TEMPORARY_SHUT';
  shop_photo?: string;
  business_proof?: string;
}

export interface CollectionPlan {
  id: string;
  plan_name: string;
  requested_amount: number;
  disbursed_amount: number;
  daily_collection: number;
  collection_days: number;
  total_repayment: number;
  finance_margin: number;
  status: 'ACTIVE' | 'INACTIVE';
  description?: string;
  created_at: string;
}

export interface CollectionAccount {
  id: string;
  customer_id: string;
  customer_name: string;
  shop_name?: string;
  plan_id: string;
  plan_name: string;
  requested_amount: number;
  margin_percentage?: number; // Specific margin % for this account
  margin_amount?: number; // Requested * Margin% / 100
  disbursed_amount: number; // Requested - Margin Amount
  daily_collection: number; // Total Repayment / Collection Period
  collection_days: number; // 30, 50, 60, 90, 100, 120, or custom
  total_repayment: number; // Equals Requested Amount
  finance_margin: number; // Equals Margin Amount
  start_date: string;
  expected_end_date: string;
  actual_completion_date?: string;
  amount_collected: number;
  remaining_amount: number;
  completed_days: number;
  remaining_days: number;
  collection_percentage: number;
  assigned_collector_id: string;
  assigned_collector_name: string;
  collection_area: string;
  status: 'ACTIVE' | 'COMPLETED' | 'OVERDUE' | 'PENDING' | 'CANCELLED';
  /** Terms that differ from the loan product the account was issued under. */
  overrides?: LoanOverride[];
  created_at: string;
  updated_at: string;
}

export interface DailyCollectionRecord {
  id: string;
  collection_account_id: string;
  customer_id: string;
  customer_name: string;
  shop_name: string;
  mobile_number: string;
  collection_day_number?: number; // 1, 2, 3... 100
  calendar_date?: string; // Exact calendar date
  date: string; // YYYY-MM-DD
  daily_due: number;
  due_amount?: number;
  paid_amount: number;
  pending_amount: number;
  advance_amount: number;
  status: 'PAID' | 'PARTIAL' | 'PENDING' | 'MISSED' | 'ADVANCE';
  payment_mode?: string; // one of config.masters.payment_modes
  collector_id: string;
  collector_name: string;
  collection_area: string;
  reason?: string;
  remarks?: string;
  receipt_id?: string;
  receipt_number?: string;
  balance_remaining: number;
  route_order?: number;
  missed_days_count?: number;
  missed_amount?: number;
  street?: string;
  landmark?: string;
  shop_address?: string;
  whatsapp_number?: string;
  recent_history?: Array<{
    date: string;
    amount: number;
    status: 'PAID' | 'MISSED' | 'PENDING' | 'BEFORE_START';
    mode?: string;
    receipt_number?: string;
    reason?: string;
  }>;
}

export interface PaymentTransaction {
  id: string;
  receipt_number: string;
  collection_account_id: string;
  customer_id: string;
  customer_name: string;
  shop_name: string;
  collection_date: string;
  daily_due: number;
  amount_paid: number;
  advance_amount: number;
  payment_mode: string; // one of config.masters.payment_modes
  collector_id: string;
  collector_name: string;
  previous_balance: number;
  remaining_balance: number;
  /** CANCELLED = undone; kept for the record but left out of all totals. */
  status: 'SUCCESS' | 'PARTIAL' | 'ADVANCE' | 'CANCELLED';
  transaction_ref?: string;
  remarks?: string;
  created_at: string;
  cancelled_at?: string;
}

export interface Receipt {
  id: string;
  receipt_number: string;
  payment_id: string;
  collection_account_id: string;
  customer_id: string;
  customer_name: string;
  shop_name: string;
  daily_due: number;
  amount_paid: number;
  payment_mode: string;
  transaction_ref?: string;
  previous_balance: number;
  remaining_balance: number;
  collector_name: string;
  date: string;
  created_at: string;
  remarks?: string;
  /** Set when the payment behind this receipt was undone. */
  status?: 'CANCELLED';
  cancelled_at?: string;
}

export interface Collector {
  id: string;
  name: string;
  photo?: string;
  mobile: string;
  email: string;
  address: string;
  assigned_area: string;
  joining_date: string;
  target_amount: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Area {
  id: string;
  area_name: string;
  city: string;
  district: string;
  pincode: string;
  assigned_collector_id: string;
  assigned_collector_name: string;
  customer_count: number;
}

export interface CustomerDocument {
  id: string;
  customer_id: string;
  document_type: string;
  document_number: string;
  file_url: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  upload_date: string;
  uploaded_by: string;
  verification_status: 'Pending Verification' | 'Verified' | 'Rejected';
  remarks?: string;
}

export interface Notification {
  id: string;
  recipient_role: 'ADMIN' | 'CUSTOMER' | 'COLLECTOR';
  customer_id?: string;
  title: string;
  message: string;
  type: 'PAYMENT' | 'MISSED' | 'OVERDUE' | 'KYC' | 'ACCOUNT' | 'SYSTEM' | 'LOAN_REQUEST';
  is_read: boolean;
  created_at: string;
  action_url?: string;
}

export interface LoanRequest {
  id: string;
  customer_id: string;
  customer_name: string;
  shop_name: string;
  requested_amount: number;
  collection_days: number;
  purpose?: string;
  remarks?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
}

export interface CustomerNote {
  id: string;
  customer_id: string;
  note: string;
  created_by: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user: string;
  role: string;
  action: string;
  record_id: string;
  record_type: string;
  previous_value?: any;
  new_value?: any;
  timestamp: string;
}

export interface SystemSettings {
  company_name: string;
  company_tagline: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_logo?: string;
  receipt_prefix: string;
  currency: string;
  default_collection_days: number;
  default_payment_mode: string;
  notifications_enabled: boolean;
}

export interface KRSFinanceDatabase {
  users: User[];
  customers: CustomerPersonalDetails[];
  customer_addresses: CustomerAddress[];
  business_details: BusinessDetails[];
  collection_accounts: CollectionAccount[];
  daily_collections: DailyCollectionRecord[];
  payments: PaymentTransaction[];
  receipts: Receipt[];
  collectors: Collector[];
  areas: Area[];
  documents: CustomerDocument[];
  notifications: Notification[];
  loan_requests?: LoanRequest[];
  customer_notes: CustomerNote[];
  audit_logs: AuditLog[];
  config: AppConfig;
}

/** Shape of data files written before the config block existed. */
type LegacyDatabase = Omit<KRSFinanceDatabase, 'config'> & {
  config?: Partial<AppConfig>;
  settings?: Partial<SystemSettings>;
  collection_plans?: CollectionPlan[];
};

function trailingNumber(id: string): number {
  const match = String(id).match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

function mostCommon(values: (string | undefined)[]): string {
  const counts = new Map<string, number>();
  values.forEach(v => { if (v) counts.set(v, (counts.get(v) || 0) + 1); });
  let best = '';
  let bestCount = 0;
  counts.forEach((c, v) => { if (c > bestCount) { best = v; bestCount = c; } });
  return best;
}

function planToProduct(plan: CollectionPlan): LoanProduct {
  const margin = plan.requested_amount > 0 ? safeRound((plan.finance_margin / plan.requested_amount) * 100, 2) : 0;
  return {
    id: plan.id,
    name: plan.plan_name,
    description: plan.description,
    margin_percentage: margin,
    day_options: [plan.collection_days],
    default_days: plan.collection_days,
    min_amount: plan.requested_amount,
    max_amount: plan.requested_amount,
    allow_overrides: true,
    status: plan.status,
    created_at: plan.created_at,
  };
}

/**
 * Brings any data file up to the current shape: builds db.config from the legacy
 * settings / collection_plans (or from defaults) and fills in keys added later.
 */
export function migrateDatabase(raw: LegacyDatabase): KRSFinanceDatabase {
  const existing = raw.config || {};
  const legacy = raw.settings || {};

  const company = {
    ...DEFAULT_CONFIG.company,
    ...(legacy.company_name !== undefined ? {
      company_name: legacy.company_name,
      company_tagline: legacy.company_tagline ?? DEFAULT_CONFIG.company.company_tagline,
      company_address: legacy.company_address ?? '',
      company_phone: legacy.company_phone ?? '',
      company_email: legacy.company_email ?? '',
      company_logo: legacy.company_logo ?? '',
      currency: legacy.currency ?? DEFAULT_CONFIG.company.currency,
      notifications_enabled: legacy.notifications_enabled ?? true,
    } : {}),
    ...existing.company,
  };

  // The default location is derived from the data itself the first time.
  const addrs = raw.customer_addresses || [];
  const derivedLocation = {
    area: mostCommon((raw.areas || []).map(a => a.area_name)),
    city: mostCommon(addrs.map(a => a.city)),
    district: mostCommon(addrs.map(a => a.district)),
    state: mostCommon(addrs.map(a => a.state)),
    pincode: mostCommon(addrs.map(a => a.pincode)),
  };
  // Only known keys are kept, so lists retired in later versions drop out of old files.
  const em: Partial<MasterLists> = existing.masters || {};
  const dm = DEFAULT_CONFIG.masters;
  const masters: MasterLists = {
    payment_modes: em.payment_modes ?? dm.payment_modes,
    default_payment_mode: em.default_payment_mode ?? legacy.default_payment_mode ?? dm.default_payment_mode,
    not_paid_reasons: em.not_paid_reasons ?? dm.not_paid_reasons,
    not_paying_after_days: em.not_paying_after_days ?? dm.not_paying_after_days,
    default_location: {
      ...dm.default_location,
      ...(existing.masters ? {} : derivedLocation),
      ...em.default_location,
    },
  };

  let loan_products = existing.loan_products;
  if (!loan_products) {
    const flex = { ...DEFAULT_CONFIG.loan_products[0] };
    if (legacy.default_collection_days) flex.default_days = legacy.default_collection_days;
    loan_products = [flex, ...(raw.collection_plans || []).map(planToProduct)];
  }

  const idsByKind: Record<NumberingKind, string[]> = {
    customer: (raw.customers || []).map(c => c.id),
    account: (raw.collection_accounts || []).map(a => a.id),
    receipt: (raw.receipts || []).map(r => r.receipt_number),
    collector: (raw.collectors || []).map(c => c.id),
    area: (raw.areas || []).map(a => a.id),
  };
  const numbering = { ...DEFAULT_CONFIG.numbering, ...existing.numbering };
  (Object.keys(idsByKind) as NumberingKind[]).forEach(kind => {
    const rule = { ...DEFAULT_CONFIG.numbering[kind], ...existing.numbering?.[kind] };
    if (kind === 'receipt' && !existing.numbering?.receipt && legacy.receipt_prefix) rule.prefix = legacy.receipt_prefix;
    const maxSeq = idsByKind[kind].reduce((m, id) => Math.max(m, trailingNumber(id)), 0);
    rule.next = Math.max(rule.next, maxSeq + 1);
    numbering[kind] = rule;
  });

  const { settings: _settings, collection_plans: _plans, config: _config, ...rest } = raw;
  return { ...rest, config: { company, masters, loan_products, numbering } };
}

/** Allocates the next ID of a kind from the configured numbering rule, skipping any already taken. */
export function nextId(db: KRSFinanceDatabase, kind: NumberingKind, existingIds: string[]): string {
  const rule = db.config.numbering[kind];
  const taken = new Set(existingIds);
  let id = formatId(rule, rule.next);
  rule.next += 1;
  while (taken.has(id)) {
    id = formatId(rule, rule.next);
    rule.next += 1;
  }
  return id;
}

class Repository {
  private db: KRSFinanceDatabase | null = null;

  public getDb(): KRSFinanceDatabase {
    if (!this.db) {
      this.load();
    }
    return this.db!;
  }

  public save(data?: KRSFinanceDatabase): void {
    if (data) {
      this.db = data;
    }
    if (!this.db) return;

    try {
      const json = JSON.stringify(this.db, null, 2);
      fs.writeFileSync(dbTmpFilePath, json, 'utf-8');
      fs.renameSync(dbTmpFilePath, dbFilePath);
    } catch (err) {
      console.error('Failed to write database file:', err);
    }
  }

  public load(): KRSFinanceDatabase {
    const candidates = [dbFilePath, dbBackupFilePath, sampleDataFilePath];
    for (const file of candidates) {
      if (!fs.existsSync(file)) continue;
      try {
        this.db = migrateDatabase(JSON.parse(fs.readFileSync(file, 'utf-8')));
        return this.db;
      } catch (err) {
        console.warn(`Data file ${path.basename(file)} is unreadable, trying the next one...`, err);
      }
    }

    this.db = generateSeedDatabase();
    return this.db;
  }

  /** Snapshot of the live data taken once per server start, not on every write. */
  public writeStartupBackup(): void {
    if (!this.db) return;
    try {
      fs.writeFileSync(dbBackupFilePath, JSON.stringify(this.db, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write startup backup:', err);
    }
  }
}

export const repository = new Repository();

export function generateSeedDatabase(): KRSFinanceDatabase {
  return migrateDatabase(generateLegacySeed());
}

function generateLegacySeed(): LegacyDatabase {
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // 1. System Settings
  const settings: SystemSettings = {
    company_name: 'DAILY COLLECTION',
    company_tagline: 'Daily Collection System',
    company_address: 'Mount Road, Chennai - 600002, Tamil Nadu',
    company_phone: '+91 94432 10001',
    company_email: 'support@dailycollection.com',
    company_logo: '',
    receipt_prefix: 'DC-REC-',
    currency: '₹',
    default_collection_days: 100,
    default_payment_mode: 'Cash',
    notifications_enabled: true,
  };

  // 2. Users (Admin, Customers, Collectors)
  const users: User[] = [
    {
      id: 'USR001',
      username: 'admin',
      email: 'admin@dailycollection.com',
      password: 'admin', // Demo simplicity
      role: 'ADMIN',
      name: 'Operations Admin',
      phone: '+91 94432 10001',
      is_active: true,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      created_at: '2026-01-01T09:00:00.000Z',
    },
    {
      id: 'USR002',
      username: 'KRS10001',
      email: 'ramesh.kumar@gmail.com',
      password: '1234',
      role: 'CUSTOMER',
      customer_id: 'KRS10001',
      name: 'Ramesh Kumar',
      phone: '9876543210',
      is_active: true,
      created_at: '2026-01-05T10:00:00.000Z',
    },
    {
      id: 'USR003',
      username: 'KRS10002',
      email: 'sundar.bakery@gmail.com',
      password: '1234',
      role: 'CUSTOMER',
      customer_id: 'KRS10002',
      name: 'Sundar Rajan',
      phone: '98422 11990',
      is_active: true,
      created_at: '2026-01-08T11:00:00.000Z',
    },
    {
      id: 'USR004',
      username: 'KRS10003',
      email: 'meenakshi.textiles@gmail.com',
      password: '1234',
      role: 'CUSTOMER',
      customer_id: 'KRS10003',
      name: 'Meenakshi Ammal',
      phone: '98423 77881',
      is_active: true,
      created_at: '2026-01-10T12:00:00.000Z',
    },
    {
      id: 'USR005',
      username: 'COL101',
      email: 'murugan.collector@dailycollection.com',
      password: '1234',
      role: 'COLLECTOR',
      collector_id: 'COL101',
      name: 'Murugan S.',
      phone: '98421 11223',
      is_active: true,
      created_at: '2026-01-02T09:00:00.000Z',
    },
  ];

  // 3. Collectors
  const collectors: Collector[] = [
    {
      id: 'COL101',
      name: 'Murugan S.',
      photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      mobile: '98421 11223',
      email: 'murugan.s@krsfinance.com',
      address: '22, Anna Nagar, Salem - 636004',
      assigned_area: 'Bazaar Main Road',
      joining_date: '2025-06-01',
      target_amount: 30000,
      status: 'ACTIVE',
    },
    {
      id: 'COL102',
      name: 'Karthik Raja',
      photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      mobile: '98422 33445',
      email: 'karthik.raja@krsfinance.com',
      address: '15, Gandhi Road, Salem - 636001',
      assigned_area: 'Town Hall Road',
      joining_date: '2025-08-15',
      target_amount: 25000,
      status: 'ACTIVE',
    },
    {
      id: 'COL103',
      name: 'Saravanan P.',
      photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      mobile: '98423 55667',
      email: 'saravanan.p@krsfinance.com',
      address: '88, Periyar Street, Salem - 636002',
      assigned_area: 'Car Street',
      joining_date: '2025-09-01',
      target_amount: 25000,
      status: 'ACTIVE',
    },
  ];

  // 4. Areas
  const areas: Area[] = [
    {
      id: 'AREA101',
      area_name: 'Bazaar Main Road',
      city: 'Salem',
      district: 'Salem',
      pincode: '636001',
      assigned_collector_id: 'COL101',
      assigned_collector_name: 'Murugan S.',
      customer_count: 8,
    },
    {
      id: 'AREA102',
      area_name: 'Town Hall Road',
      city: 'Salem',
      district: 'Salem',
      pincode: '636001',
      assigned_collector_id: 'COL102',
      assigned_collector_name: 'Karthik Raja',
      customer_count: 6,
    },
    {
      id: 'AREA103',
      area_name: 'Car Street',
      city: 'Salem',
      district: 'Salem',
      pincode: '636002',
      assigned_collector_id: 'COL103',
      assigned_collector_name: 'Saravanan P.',
      customer_count: 5,
    },
    {
      id: 'AREA104',
      area_name: 'Market Gate',
      city: 'Salem',
      district: 'Salem',
      pincode: '636001',
      assigned_collector_id: 'COL101',
      assigned_collector_name: 'Murugan S.',
      customer_count: 4,
    },
    {
      id: 'AREA105',
      area_name: 'New Bus Stand Area',
      city: 'Salem',
      district: 'Salem',
      pincode: '636004',
      assigned_collector_id: 'COL102',
      assigned_collector_name: 'Karthik Raja',
      customer_count: 4,
    },
  ];

  // 5. Collection Plans
  const collection_plans: CollectionPlan[] = [
    {
      id: 'PLAN100_10K',
      plan_name: 'Standard 100-Day Plan (₹10,000)',
      requested_amount: 10000,
      disbursed_amount: 8800,
      daily_collection: 100,
      collection_days: 100,
      total_repayment: 10000,
      finance_margin: 1200,
      status: 'ACTIVE',
      description: 'Standard Daily Collection plan: ₹10,000 requested → ₹8,800 disbursed → ₹100 × 100 days → ₹10,000 collected → ₹1,200 margin.',
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'PLAN100_20K',
      plan_name: 'Silver 100-Day Plan (₹20,000)',
      requested_amount: 20000,
      disbursed_amount: 17600,
      daily_collection: 200,
      collection_days: 100,
      total_repayment: 20000,
      finance_margin: 2400,
      status: 'ACTIVE',
      description: 'High volume plan: ₹20,000 requested → ₹17,600 disbursed → ₹200 × 100 days → ₹20,000 collected → ₹2,400 margin.',
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'PLAN100_50K',
      plan_name: 'Gold 100-Day Plan (₹50,000)',
      requested_amount: 50000,
      disbursed_amount: 44000,
      daily_collection: 500,
      collection_days: 100,
      total_repayment: 50000,
      finance_margin: 6000,
      status: 'ACTIVE',
      description: 'Premium business plan: ₹50,000 requested → ₹44,000 disbursed → ₹500 × 100 days → ₹50,000 collected → ₹6,000 margin.',
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'PLAN50_10K',
      plan_name: 'Express 50-Day Plan (₹10,000)',
      requested_amount: 10000,
      disbursed_amount: 9000,
      daily_collection: 200,
      collection_days: 50,
      total_repayment: 10000,
      finance_margin: 1000,
      status: 'ACTIVE',
      description: 'Short cycle plan: ₹10,000 requested → ₹9,000 disbursed → ₹200 × 50 days → ₹10,000 collected → ₹1,000 margin.',
      created_at: '2026-01-01T00:00:00.000Z',
    },
  ];

  // 6. Customers (Detailed Personal Info)
  const customers: CustomerPersonalDetails[] = [
    {
      id: 'KRS10001',
      full_name: 'Ramesh Kumar',
      profile_photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150',
      gender: 'Male',
      dob: '1985-05-14',
      father_or_husband_name: 'Shanmugam K.',
      mother_name: 'Lakshmi S.',
      marital_status: 'Married',
      mobile_number: '9876543210',
      alternate_number: '9443322110',
      whatsapp_number: '9876543210',
      email: 'ramesh.kumar@gmail.com',
      status: 'ACTIVE',
      created_at: '2026-01-10T10:00:00.000Z',
      updated_at: '2026-09-29T10:00:00.000Z',
    },
    {
      id: 'KRS10002',
      full_name: 'Sundar Rajan',
      profile_photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      gender: 'Male',
      dob: '1982-11-20',
      father_or_husband_name: 'Ramasamy T.',
      mother_name: 'Parvathi R.',
      marital_status: 'Married',
      mobile_number: '98422 11990',
      alternate_number: '98422 11991',
      whatsapp_number: '98422 11990',
      email: 'sundar.bakery@gmail.com',
      status: 'ACTIVE',
      created_at: '2026-01-15T11:00:00.000Z',
      updated_at: '2026-09-29T10:00:00.000Z',
    },
    {
      id: 'KRS10003',
      full_name: 'Meenakshi Ammal',
      profile_photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
      gender: 'Female',
      dob: '1979-08-04',
      father_or_husband_name: 'Late Narayanan V.',
      mother_name: 'Valli N.',
      marital_status: 'Other',
      mobile_number: '98423 77881',
      alternate_number: '98423 77882',
      whatsapp_number: '98423 77881',
      email: 'meenakshi.textiles@gmail.com',
      status: 'ACTIVE',
      created_at: '2026-02-01T09:30:00.000Z',
      updated_at: '2026-09-29T10:00:00.000Z',
    },
    {
      id: 'KRS10004',
      full_name: 'Vijay Anand',
      profile_photo: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
      gender: 'Male',
      dob: '1988-02-17',
      father_or_husband_name: 'Anandhan M.',
      mother_name: 'Kasthuri A.',
      marital_status: 'Married',
      mobile_number: '98424 99001',
      whatsapp_number: '98424 99001',
      email: 'vijay.paints@gmail.com',
      status: 'ACTIVE',
      created_at: '2026-02-10T14:15:00.000Z',
      updated_at: '2026-09-29T10:00:00.000Z',
    },
    {
      id: 'KRS10005',
      full_name: 'Senthil Nathan',
      profile_photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      gender: 'Male',
      dob: '1991-09-29',
      father_or_husband_name: 'Chidambaram S.',
      mother_name: 'Meena C.',
      marital_status: 'Single',
      mobile_number: '98425 44332',
      whatsapp_number: '98425 44332',
      email: 'senthil.tea@gmail.com',
      status: 'ACTIVE',
      created_at: '2026-03-01T10:00:00.000Z',
      updated_at: '2026-09-29T10:00:00.000Z',
    },
    {
      id: 'KRS10006',
      full_name: 'Kavitha Selvam',
      profile_photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
      gender: 'Female',
      dob: '1990-03-12',
      father_or_husband_name: 'Selvamurugan G.',
      mother_name: 'Deivanai S.',
      marital_status: 'Married',
      mobile_number: '98426 66778',
      whatsapp_number: '98426 66778',
      email: 'kavitha.fancy@gmail.com',
      status: 'ACTIVE',
      created_at: '2026-03-15T11:20:00.000Z',
      updated_at: '2026-09-29T10:00:00.000Z',
    },
  ];

  // 7. Residential Addresses
  const customer_addresses: CustomerAddress[] = [
    {
      id: 'ADDR10001',
      customer_id: 'KRS10001',
      door_number: '12/4',
      street: 'Agraharam North Street',
      area: 'Shevapet',
      village_or_town: 'Salem Town',
      city: 'Salem',
      district: 'Salem',
      state: 'Tamil Nadu',
      pincode: '636002',
      landmark: 'Near Kottai Mariamman Temple',
    },
    {
      id: 'ADDR10002',
      customer_id: 'KRS10002',
      door_number: '45-B',
      street: 'Muniyappan Koil Street',
      area: 'Gugai',
      village_or_town: 'Salem',
      city: 'Salem',
      district: 'Salem',
      state: 'Tamil Nadu',
      pincode: '636006',
      landmark: 'Behind Gugai Girls High School',
    },
    {
      id: 'ADDR10003',
      customer_id: 'KRS10003',
      door_number: '78',
      street: 'Weavers Colony 2nd Cross',
      area: 'Ammapet',
      village_or_town: 'Salem',
      city: 'Salem',
      district: 'Salem',
      state: 'Tamil Nadu',
      pincode: '636003',
      landmark: 'Opposite Ammapet Police Station',
    },
    {
      id: 'ADDR10004',
      customer_id: 'KRS10004',
      door_number: '3/110',
      street: 'Kamarajar Salai',
      area: 'Fairlands',
      village_or_town: 'Salem',
      city: 'Salem',
      district: 'Salem',
      state: 'Tamil Nadu',
      pincode: '636016',
      landmark: 'Near Saradha College Roundana',
    },
    {
      id: 'ADDR10005',
      customer_id: 'KRS10005',
      door_number: '88/1',
      street: 'Meyyanur Main Road',
      area: 'Meyyanur',
      village_or_town: 'Salem',
      city: 'Salem',
      district: 'Salem',
      state: 'Tamil Nadu',
      pincode: '636004',
      landmark: 'Near AVR Circle',
    },
    {
      id: 'ADDR10006',
      customer_id: 'KRS10006',
      door_number: '24',
      street: 'Kandhampatty Bypass Service Road',
      area: 'Kandhampatty',
      village_or_town: 'Salem',
      city: 'Salem',
      district: 'Salem',
      state: 'Tamil Nadu',
      pincode: '636005',
      landmark: 'Next to Murugan Kalyana Mandapam',
    },
  ];

  // 8. Shop / Business Details
  const business_details: BusinessDetails[] = [
    {
      id: 'SHP1001',
      customer_id: 'KRS10001',
      shop_name: 'Sri Krishna Supermarket & Provisions',
      owner_name: 'Ramesh Kumar',
      business_type: 'Grocery & Provisions Retail',
      business_category: 'FMCG / Daily Essentials',
      shop_mobile: '9876543210',
      shop_address: 'No. 18, Bazaar Main Road',
      shop_area: 'Bazaar Main Road',
      shop_city: 'Salem',
      shop_district: 'Salem',
      shop_pincode: '636001',
      landmark: 'Opposite Clock Tower',
      years_in_business: 12,
      approx_monthly_income: 95000,
      approx_daily_sales: 18000,
      business_status: 'ACTIVE',
      shop_photo: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=500',
    },
    {
      id: 'SHP1002',
      customer_id: 'KRS10002',
      shop_name: 'Annapoorna Sweets, Bakery & Snacks',
      owner_name: 'Sundar Rajan',
      business_type: 'Bakery & Sweets',
      business_category: 'Food & Confectionery',
      shop_mobile: '98422 11990',
      shop_address: 'No. 54, Town Hall Road',
      shop_area: 'Town Hall Road',
      shop_city: 'Salem',
      shop_district: 'Salem',
      shop_pincode: '636001',
      landmark: 'Near Victoria Hall',
      years_in_business: 16,
      approx_monthly_income: 140000,
      approx_daily_sales: 24000,
      business_status: 'ACTIVE',
      shop_photo: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500',
    },
    {
      id: 'SHP1003',
      customer_id: 'KRS10003',
      shop_name: 'Murugan Textiles, Sarees & Readymade',
      owner_name: 'Meenakshi Ammal',
      business_type: 'Textiles & Garments',
      business_category: 'Apparel / Retail',
      shop_mobile: '98423 77881',
      shop_address: 'No. 102, Car Street',
      shop_area: 'Car Street',
      shop_city: 'Salem',
      shop_district: 'Salem',
      shop_pincode: '636002',
      landmark: 'Near Sugavaneswarar Temple Car Stand',
      years_in_business: 20,
      approx_monthly_income: 220000,
      approx_daily_sales: 38000,
      business_status: 'ACTIVE',
      shop_photo: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=500',
    },
    {
      id: 'SHP1004',
      customer_id: 'KRS10004',
      shop_name: 'Anand Hardware, Paints & Electricals',
      owner_name: 'Vijay Anand',
      business_type: 'Hardware & Construction Tools',
      business_category: 'Retail & Commercial',
      shop_mobile: '98424 99001',
      shop_address: 'No. 33, Market Gate Road',
      shop_area: 'Market Gate',
      shop_city: 'Salem',
      shop_district: 'Salem',
      shop_pincode: '636001',
      landmark: 'Entry Gate No. 2, Old Market',
      years_in_business: 8,
      approx_monthly_income: 80000,
      approx_daily_sales: 15000,
      business_status: 'ACTIVE',
      shop_photo: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=500',
    },
    {
      id: 'SHP1005',
      customer_id: 'KRS10005',
      shop_name: 'Nathan Tea Stall, Tiffin & Cool Drinks',
      owner_name: 'Senthil Nathan',
      business_type: 'Tea Stall & Cafeteria',
      business_category: 'Beverage & Eatery',
      shop_mobile: '98425 44332',
      shop_address: 'Platform Shop #4, Central Bus Terminus',
      shop_area: 'New Bus Stand Area',
      shop_city: 'Salem',
      shop_district: 'Salem',
      shop_pincode: '636004',
      landmark: 'Opposite Bay 3, Mofussil Platform',
      years_in_business: 5,
      approx_monthly_income: 60000,
      approx_daily_sales: 12000,
      business_status: 'ACTIVE',
      shop_photo: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500',
    },
    {
      id: 'SHP1006',
      customer_id: 'KRS10006',
      shop_name: 'Selvam Fancy Store, Toys & Stationeries',
      owner_name: 'Kavitha Selvam',
      business_type: 'Fancy Store & Gift Articles',
      business_category: 'Stationery & Novelties',
      shop_mobile: '98426 66778',
      shop_address: 'No. 7, College Road',
      shop_area: 'Bazaar Main Road',
      shop_city: 'Salem',
      shop_district: 'Salem',
      shop_pincode: '636001',
      landmark: 'Near Govt Arts College Gate',
      years_in_business: 7,
      approx_monthly_income: 55000,
      approx_daily_sales: 11000,
      business_status: 'ACTIVE',
      shop_photo: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=500',
    },
  ];

  // 9. Collection Accounts
  // Note: Exactly matching Section 43 & Section 1:
  // KRS10001: ₹10,000 requested → ₹8,800 disbursed → ₹100 × 100 days → ₹10,000 repayment → ₹1,200 margin
  // Paid so far: ₹3,500 (35 days completed, 65 days remaining, ₹6,500 remaining balance, 35% completion)
  const collection_accounts: CollectionAccount[] = [
    {
      id: 'ACC-2026-001',
      customer_id: 'KRS10001',
      customer_name: 'Ramesh Kumar',
      shop_name: 'Sri Krishna Supermarket & Provisions',
      plan_id: 'PLAN100_10K',
      plan_name: 'Standard 100-Day Plan (₹10,000)',
      requested_amount: 10000,
      disbursed_amount: 8800,
      daily_collection: 100,
      collection_days: 100,
      total_repayment: 10000,
      finance_margin: 1200,
      start_date: '2026-09-01',
      expected_end_date: '2026-12-09',
      amount_collected: 3500,
      remaining_amount: 6500,
      completed_days: 35,
      remaining_days: 65,
      collection_percentage: 35.0,
      assigned_collector_id: 'COL101',
      assigned_collector_name: 'Murugan S.',
      collection_area: 'Bazaar Main Road',
      status: 'ACTIVE',
      created_at: '2026-08-24T10:00:00.000Z',
      updated_at: '2026-09-29T10:00:00.000Z',
    },
    {
      id: 'ACC-2026-002',
      customer_id: 'KRS10002',
      customer_name: 'Sundar Rajan',
      shop_name: 'Annapoorna Sweets, Bakery & Snacks',
      plan_id: 'PLAN100_20K',
      plan_name: 'Silver 100-Day Plan (₹20,000)',
      requested_amount: 20000,
      disbursed_amount: 17600,
      daily_collection: 200,
      collection_days: 100,
      total_repayment: 20000,
      finance_margin: 2400,
      start_date: '2026-08-20',
      expected_end_date: '2026-11-27',
      amount_collected: 8000,
      remaining_amount: 12000,
      completed_days: 40,
      remaining_days: 60,
      collection_percentage: 40.0,
      assigned_collector_id: 'COL102',
      assigned_collector_name: 'Karthik Raja',
      collection_area: 'Town Hall Road',
      status: 'ACTIVE',
      created_at: '2026-08-19T11:00:00.000Z',
      updated_at: '2026-09-29T10:00:00.000Z',
    },
    {
      id: 'ACC-2026-003',
      customer_id: 'KRS10003',
      customer_name: 'Meenakshi Ammal',
      shop_name: 'Murugan Textiles, Sarees & Readymade',
      plan_id: 'PLAN100_50K',
      plan_name: 'Gold 100-Day Plan (₹50,000)',
      requested_amount: 50000,
      disbursed_amount: 44000,
      daily_collection: 500,
      collection_days: 100,
      total_repayment: 50000,
      finance_margin: 6000,
      start_date: '2026-08-10',
      expected_end_date: '2026-11-17',
      amount_collected: 25000,
      remaining_amount: 25000,
      completed_days: 50,
      remaining_days: 50,
      collection_percentage: 50.0,
      assigned_collector_id: 'COL103',
      assigned_collector_name: 'Saravanan P.',
      collection_area: 'Car Street',
      status: 'ACTIVE',
      created_at: '2026-08-09T09:00:00.000Z',
      updated_at: '2026-09-29T10:00:00.000Z',
    },
    {
      id: 'ACC-2026-004',
      customer_id: 'KRS10004',
      customer_name: 'Vijay Anand',
      shop_name: 'Anand Hardware, Paints & Electricals',
      plan_id: 'PLAN100_10K',
      plan_name: 'Standard 100-Day Plan (₹10,000)',
      requested_amount: 10000,
      disbursed_amount: 8800,
      daily_collection: 100,
      collection_days: 100,
      total_repayment: 10000,
      finance_margin: 1200,
      start_date: '2026-06-01',
      expected_end_date: '2026-09-08',
      amount_collected: 8200,
      remaining_amount: 1800,
      completed_days: 82,
      remaining_days: 18,
      collection_percentage: 82.0,
      assigned_collector_id: 'COL101',
      assigned_collector_name: 'Murugan S.',
      collection_area: 'Market Gate',
      status: 'OVERDUE',
      created_at: '2026-05-31T15:00:00.000Z',
      updated_at: '2026-09-29T10:00:00.000Z',
    },
    {
      id: 'ACC-2026-005',
      customer_id: 'KRS10005',
      customer_name: 'Senthil Nathan',
      shop_name: 'Nathan Tea Stall, Tiffin & Cool Drinks',
      plan_id: 'PLAN50_10K',
      plan_name: 'Express 50-Day Plan (₹10,000)',
      requested_amount: 10000,
      disbursed_amount: 9000,
      daily_collection: 200,
      collection_days: 50,
      total_repayment: 10000,
      finance_margin: 1000,
      start_date: '2026-09-01',
      expected_end_date: '2026-10-20',
      amount_collected: 5600,
      remaining_amount: 4400,
      completed_days: 28,
      remaining_days: 22,
      collection_percentage: 56.0,
      assigned_collector_id: 'COL102',
      assigned_collector_name: 'Karthik Raja',
      collection_area: 'New Bus Stand Area',
      status: 'ACTIVE',
      created_at: '2026-08-31T16:00:00.000Z',
      updated_at: '2026-09-29T10:00:00.000Z',
    },
    {
      id: 'ACC-2026-006',
      customer_id: 'KRS10006',
      customer_name: 'Kavitha Selvam',
      shop_name: 'Selvam Fancy Store, Toys & Stationeries',
      plan_id: 'PLAN100_10K',
      plan_name: 'Standard 100-Day Plan (₹10,000)',
      requested_amount: 10000,
      disbursed_amount: 8800,
      daily_collection: 100,
      collection_days: 100,
      total_repayment: 10000,
      finance_margin: 1200,
      start_date: '2026-09-10',
      expected_end_date: '2026-12-18',
      amount_collected: 1900,
      remaining_amount: 8100,
      completed_days: 19,
      remaining_days: 81,
      collection_percentage: 19.0,
      assigned_collector_id: 'COL101',
      assigned_collector_name: 'Murugan S.',
      collection_area: 'Bazaar Main Road',
      status: 'ACTIVE',
      created_at: '2026-09-09T14:00:00.000Z',
      updated_at: '2026-09-29T10:00:00.000Z',
    },
  ];

  // 10. Daily Collections & Payments (Simulating daily payments with decreasing balances)
  const daily_collections: DailyCollectionRecord[] = [];
  const payments: PaymentTransaction[] = [];
  const receipts: Receipt[] = [];

  let receiptSeq = 1;
  let paySeq = 1;

  // Running ledger state for each collection account starting from total_repayment
  const accountBalances: { [accId: string]: { runningBalance: number; totalCollected: number } } = {};
  collection_accounts.forEach(acc => {
    accountBalances[acc.id] = {
      runningBalance: acc.total_repayment,
      totalCollected: 0,
    };
  });

  // Generate historical payments for September (days 1 to 29)
  for (let day = 1; day <= 29; day++) {
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `2026-09-${dayStr}`;
    const isToday = day === 29;

    collection_accounts.forEach(acc => {
      const dailyDue = acc.daily_collection;
      let status: 'PAID' | 'PARTIAL' | 'PENDING' | 'MISSED' | 'ADVANCE' = 'PAID';
      let paid = dailyDue;
      let pending = 0;
      let advance = 0;
      let reason: string | undefined = undefined;

      // Realistic variations:
      // Customer 4 missed some days
      if (acc.customer_id === 'KRS10004' && (day === 5 || day === 12 || day === 20)) {
        status = 'MISSED';
        paid = 0;
        pending = dailyDue;
        reason = 'Shop closed for family function';
      } else if (acc.customer_id === 'KRS10002' && day === 10) {
        // Advance payment example
        status = 'ADVANCE';
        paid = 400; // paid 2 days
        advance = 200;
      }

      // If today (Sept 29) and not yet collected for some accounts
      if (isToday) {
        if (acc.customer_id === 'KRS10004' || acc.customer_id === 'KRS10006') {
          status = 'PENDING';
          paid = 0;
          pending = dailyDue;
        }
      }

      // Previous balance before today's collection
      const prevBalance = accountBalances[acc.id].runningBalance;
      // Remaining balance strictly decreases as amount is collected!
      const newRemainingBalance = Math.max(0, safeRound(prevBalance - paid, 2));

      // Update running ledger
      if (paid > 0) {
        accountBalances[acc.id].runningBalance = newRemainingBalance;
        accountBalances[acc.id].totalCollected = safeRound(accountBalances[acc.id].totalCollected + paid, 2);
      }

      const recId = `REC-2026-09-${String(day).padStart(2, '0')}-${acc.customer_id}`;
      const recNumber = `DC-REC-2026-${String(receiptSeq++).padStart(4, '0')}`;

      const dailyRec: DailyCollectionRecord = {
        id: `DC-${dateStr}-${acc.id}`,
        collection_account_id: acc.id,
        customer_id: acc.customer_id,
        customer_name: acc.customer_name,
        shop_name: acc.shop_name || '',
        mobile_number: customers.find(c => c.id === acc.customer_id)?.mobile_number || '',
        date: dateStr,
        daily_due: dailyDue,
        paid_amount: paid,
        pending_amount: pending,
        advance_amount: advance,
        status,
        payment_mode: paid > 0 ? (day % 3 === 0 ? 'UPI' : 'Cash') : undefined,
        collector_id: acc.assigned_collector_id,
        collector_name: acc.assigned_collector_name,
        collection_area: acc.collection_area,
        reason,
        remarks: reason ? reason : (paid > 0 ? 'Collected on time' : 'Visit scheduled'),
        receipt_id: paid > 0 ? recId : undefined,
        receipt_number: paid > 0 ? recNumber : undefined,
        balance_remaining: paid > 0 ? newRemainingBalance : prevBalance,
      };
      daily_collections.push(dailyRec);

      // Create Payment & Receipt record if paid > 0
      if (paid > 0) {
        const paymentId = `PAY-2026-${String(paySeq++).padStart(4, '0')}`;
        payments.push({
          id: paymentId,
          receipt_number: recNumber,
          collection_account_id: acc.id,
          customer_id: acc.customer_id,
          customer_name: acc.customer_name,
          shop_name: acc.shop_name || '',
          collection_date: dateStr,
          daily_due: dailyDue,
          amount_paid: paid,
          advance_amount: advance,
          payment_mode: day % 3 === 0 ? 'UPI' : 'Cash',
          collector_id: acc.assigned_collector_id,
          collector_name: acc.assigned_collector_name,
          previous_balance: prevBalance,
          remaining_balance: newRemainingBalance,
          status: advance > 0 ? 'ADVANCE' : (pending > 0 ? 'PARTIAL' : 'SUCCESS'),
          transaction_ref: day % 3 === 0 ? `UPI${Math.floor(1000000000 + Math.random() * 9000000000)}` : undefined,
          remarks: reason || 'Daily collection payment',
          created_at: `${dateStr}T11:${String(day % 50).padStart(2, '0')}:00.000Z`,
        });

        receipts.push({
          id: recId,
          receipt_number: recNumber,
          payment_id: paymentId,
          collection_account_id: acc.id,
          customer_id: acc.customer_id,
          customer_name: acc.customer_name,
          shop_name: acc.shop_name || '',
          daily_due: dailyDue,
          amount_paid: paid,
          payment_mode: day % 3 === 0 ? 'UPI' : 'Cash',
          previous_balance: prevBalance,
          remaining_balance: newRemainingBalance,
          collector_name: acc.assigned_collector_name,
          date: dateStr,
          created_at: `${dateStr}T11:${String(day % 50).padStart(2, '0')}:00.000Z`,
          remarks: 'Thank you for your prompt payment.',
        });
      }
    });
  }

  // Synchronize each collection_account's final summary metrics with the exact ledger
  collection_accounts.forEach(acc => {
    const ledger = accountBalances[acc.id];
    if (ledger) {
      acc.amount_collected = ledger.totalCollected;
      acc.remaining_amount = ledger.runningBalance;
      acc.completed_days = Math.floor(acc.amount_collected / acc.daily_collection);
      acc.remaining_days = Math.max(0, acc.collection_days - acc.completed_days);
      acc.collection_percentage = safeRound((acc.amount_collected / acc.total_repayment) * 100, 1);
    }
  });

  // 11. Documents (KYC & Business Proofs)
  const documents: CustomerDocument[] = [
    {
      id: 'DOC-1001',
      customer_id: 'KRS10001',
      document_type: 'Aadhaar Card',
      document_number: '6543 2198 7712',
      file_url: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600',
      file_name: 'ramesh_aadhaar_card.jpg',
      file_size: 450200,
      mime_type: 'image/jpeg',
      upload_date: '2026-08-24',
      uploaded_by: 'Murugan S. (COL101)',
      verification_status: 'Verified',
      remarks: 'Original verified against UIDAI portal',
    },
    {
      id: 'DOC-1002',
      customer_id: 'KRS10001',
      document_type: 'PAN Card',
      document_number: 'ABCPR1298K',
      file_url: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600',
      file_name: 'ramesh_pancard.jpg',
      file_size: 320100,
      mime_type: 'image/jpeg',
      upload_date: '2026-08-24',
      uploaded_by: 'Murugan S. (COL101)',
      verification_status: 'Verified',
      remarks: 'Valid PAN registered in IT portal',
    },
    {
      id: 'DOC-1003',
      customer_id: 'KRS10001',
      document_type: 'Shop Licence',
      document_number: 'SLM/CORP/SHP/2021/8892',
      file_url: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=600',
      file_name: 'krishna_supermarket_trade_licence.pdf',
      file_size: 890400,
      mime_type: 'application/pdf',
      upload_date: '2026-08-24',
      uploaded_by: 'Murugan S. (COL101)',
      verification_status: 'Verified',
      remarks: 'Salem City Municipal Corporation Trade License valid till 2028',
    },
    {
      id: 'DOC-1004',
      customer_id: 'KRS10002',
      document_type: 'Aadhaar Card',
      document_number: '7890 1234 5678',
      file_url: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600',
      file_name: 'sundar_aadhaar.jpg',
      file_size: 420000,
      mime_type: 'image/jpeg',
      upload_date: '2026-08-19',
      uploaded_by: 'Karthik Raja (COL102)',
      verification_status: 'Verified',
    },
    {
      id: 'DOC-1005',
      customer_id: 'KRS10004',
      document_type: 'Bank Passbook',
      document_number: 'SBIN0001234 - 3089124455',
      file_url: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600',
      file_name: 'vijay_passbook.pdf',
      file_size: 610000,
      mime_type: 'application/pdf',
      upload_date: '2026-09-02',
      uploaded_by: 'Murugan S. (COL101)',
      verification_status: 'Pending Verification',
      remarks: 'Awaiting signature verification from branch',
    },
  ];

  // 12. Customer Notes
  const customer_notes: CustomerNote[] = [
    {
      id: 'NOTE-101',
      customer_id: 'KRS10001',
      note: 'Customer requested daily collection visit strictly between 4:30 PM and 6:00 PM after afternoon bank rush.',
      created_by: 'Murugan S. (Collector)',
      created_at: '2026-08-26T16:30:00.000Z',
    },
    {
      id: 'NOTE-102',
      customer_id: 'KRS10001',
      note: 'Very reliable and prompt payer. Running established grocery supermarket for 12 years with high footfall.',
      created_by: 'Radha Krishna (Admin)',
      created_at: '2026-09-10T11:00:00.000Z',
    },
    {
      id: 'NOTE-103',
      customer_id: 'KRS10004',
      note: 'Shop was closed for family function on 12th & 20th. Promoted clearing the balance over weekend.',
      created_by: 'Murugan S. (Collector)',
      created_at: '2026-09-20T17:15:00.000Z',
    },
  ];

  // 13. Notifications
  const notifications: Notification[] = [
    {
      id: 'NOTIF-01',
      recipient_role: 'ADMIN',
      title: 'Payment Received: ₹100',
      message: 'Ramesh Kumar (Sri Krishna Supermarket) paid daily due of ₹100 via Cash. Receipt #DC-REC-2026-0150 generated.',
      type: 'PAYMENT',
      is_read: false,
      created_at: `${todayStr}T10:45:00.000Z`,
    },
    {
      id: 'NOTIF-02',
      recipient_role: 'ADMIN',
      title: 'Customer Overdue Alert',
      message: 'Vijay Anand (Anand Hardware) has 3 missed collection days. Outstanding balance is ₹1,800.',
      type: 'OVERDUE',
      is_read: false,
      created_at: `${todayStr}T09:00:00.000Z`,
    },
    {
      id: 'NOTIF-03',
      recipient_role: 'CUSTOMER',
      customer_id: 'KRS10001',
      title: 'Daily Collection Completed: ₹100',
      message: 'Thank you Ramesh Kumar! We received ₹100 for your collection account ACC-2026-001. Remaining balance: ₹6,500.',
      type: 'PAYMENT',
      is_read: false,
      created_at: `${todayStr}T10:45:00.000Z`,
    },
    {
      id: 'NOTIF-04',
      recipient_role: 'CUSTOMER',
      customer_id: 'KRS10001',
      title: 'KYC Verification Approved',
      message: 'Your Trade Licence and Aadhaar documents have been officially verified by Daily Collection office.',
      type: 'KYC',
      is_read: true,
      created_at: '2026-08-25T14:20:00.000Z',
    },
  ];

  // 14. Audit Logs
  const audit_logs: AuditLog[] = [
    {
      id: 'AUDIT-001',
      user: 'admin',
      role: 'ADMIN',
      action: 'CREATE_PLAN',
      record_id: 'PLAN100_10K',
      record_type: 'collection_plans',
      previous_value: null,
      new_value: { requested: 10000, disbursed: 8800, daily: 100, days: 100, margin: 1200 },
      timestamp: '2026-01-01T09:00:00.000Z',
    },
    {
      id: 'AUDIT-002',
      user: 'admin',
      role: 'ADMIN',
      action: 'CREATE_CUSTOMER',
      record_id: 'KRS10001',
      record_type: 'customers',
      previous_value: null,
      new_value: { name: 'Ramesh Kumar', shop: 'Sri Krishna Supermarket & Provisions' },
      timestamp: '2026-08-24T10:00:00.000Z',
    },
    {
      id: 'AUDIT-003',
      user: 'admin',
      role: 'ADMIN',
      action: 'DISBURSE_COLLECTION_ACCOUNT',
      record_id: 'ACC-2026-001',
      record_type: 'collection_accounts',
      previous_value: null,
      new_value: { requested: 10000, disbursed: 8800, daily: 100, total_repayment: 10000, margin: 1200 },
      timestamp: '2026-08-24T10:30:00.000Z',
    },
    {
      id: 'AUDIT-004',
      user: 'COL101',
      role: 'COLLECTOR',
      action: 'COLLECT_PAYMENT',
      record_id: 'ACC-2026-001',
      record_type: 'payments',
      previous_value: { balance: 6600 },
      new_value: { paid: 100, balance: 6500, receipt: 'KRS-REC-2026-0150' },
      timestamp: `${todayStr}T10:45:00.000Z`,
    },
  ];

  return {
    users,
    customers,
    customer_addresses,
    business_details,
    collection_plans,
    collection_accounts,
    daily_collections,
    payments,
    receipts,
    collectors,
    areas,
    documents,
    notifications,
    customer_notes,
    audit_logs,
    settings,
  };
}

export function initializeDatabase(): void {
  repository.load();
  // Persist any migration applied on load, then keep one snapshot per start.
  repository.save();
  repository.writeStartupBackup();
}

/** Replaces the live data with the committed sample data set. */
export function loadSampleData(): void {
  if (!fs.existsSync(sampleDataFilePath)) {
    throw new Error('Sample data file data/sample_data.json was not found.');
  }
  repository.save(migrateDatabase(JSON.parse(fs.readFileSync(sampleDataFilePath, 'utf-8'))));
}

