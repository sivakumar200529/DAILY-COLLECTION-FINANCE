// DAILY COLLECTION - Comprehensive TypeScript Type Definitions

import type { LoanOverride } from '../../shared/finance';
export type { LoanOverride, OverridableField, LoanCalculation, LoanTerms } from '../../shared/finance';
export type { AppConfig, CompanyProfile, LoanProduct, MasterLists, Numbering, NumberingRule, NumberingKind, ConfigSection, DefaultLocation } from '../../shared/config';

export type Role = 'ADMIN' | 'CUSTOMER' | 'COLLECTOR';

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
  name: string;
  phone: string;
  customer_id?: string;
  collector_id?: string;
  is_active: boolean;
  avatar?: string;
  created_at: string;
}

export type MaritalStatus = 'Married' | 'Single' | 'Other';
export type Gender = 'Male' | 'Female' | 'Other';
export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

export interface CustomerPersonalDetails {
  id: string; // e.g. DC10001
  full_name: string;
  profile_photo?: string;
  gender: Gender;
  dob: string;
  father_or_husband_name: string;
  mother_name: string;
  marital_status: MaritalStatus;
  mobile_number: string;
  alternate_number?: string;
  whatsapp_number?: string;
  email?: string;
  status: CustomerStatus;
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

export type BusinessStatus = 'ACTIVE' | 'CLOSED' | 'TEMPORARY_SHUT';

export interface BusinessDetails {
  id: string; // Shop ID e.g. SHP1001
  customer_id: string;
  shop_name: string;
  owner_name: string;
  business_type: string; // Retail, Wholesale, Grocery, Textile, Hardware, etc.
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
  business_status: BusinessStatus;
  shop_photo?: string;
  business_proof?: string;
}

export type DocumentType =
  | 'Aadhaar Card'
  | 'PAN Card'
  | 'Driving Licence'
  | 'Voter ID'
  | 'Passport'
  | 'Address Proof'
  | 'Bank Passbook'
  | 'Bank Statement'
  | 'Business Proof'
  | 'Shop Licence'
  | 'Customer Photo'
  | 'Signature'
  | 'Other Documents';

export type VerificationStatus = 'Pending Verification' | 'Verified' | 'Rejected';

export interface CustomerDocument {
  id: string;
  customer_id: string;
  document_type: DocumentType;
  document_number: string;
  file_url: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  upload_date: string;
  uploaded_by: string;
  verification_status: VerificationStatus;
  remarks?: string;
}

export interface CustomerNote {
  id: string;
  customer_id: string;
  note: string;
  created_by: string;
  created_at: string;
}

export type CollectionAccountStatus = 'ACTIVE' | 'COMPLETED' | 'OVERDUE' | 'PENDING' | 'CANCELLED';

export interface CollectionAccount {
  id: string; // e.g. ACC-2026-001
  customer_id: string;
  customer_name: string;
  shop_name?: string;
  plan_id: string;
  plan_name: string;
  requested_amount: number; // Amount requested by customer (e.g. ₹10,000)
  margin_percentage?: number; // Specific margin % for this account (e.g. 10, 12, 15)
  margin_amount?: number; // Requested * Margin% / 100 (e.g. ₹1,200)
  disbursed_amount: number; // Requested - Margin Amount (e.g. ₹8,800)
  daily_collection: number; // Total Repayment / Days (e.g. ₹100)
  collection_days: number; // 30, 50, 60, 90, 100, 120, or custom
  total_repayment: number; // Equals Requested Amount (e.g. ₹10,000)
  finance_margin: number; // Equals Margin Amount (e.g. ₹1,200)
  start_date: string; // Exact start calendar date YYYY-MM-DD
  expected_end_date: string; // Exact end calendar date YYYY-MM-DD
  actual_completion_date?: string;
  amount_collected: number;
  remaining_amount: number;
  completed_days: number;
  remaining_days: number;
  collection_percentage: number;
  assigned_collector_id: string;
  assigned_collector_name: string;
  collection_area: string;
  status: CollectionAccountStatus;
  /** Terms that differ from the loan product the account was issued under. */
  overrides?: LoanOverride[];
  /** Days a running loan is behind schedule (sent by the server; drives "Not paying"). */
  days_behind?: number;
  created_at: string;
  updated_at: string;
}

/** One of Configuration → Master Lists → payment modes. */
export type PaymentMode = string;
export type DailyCollectionStatus = 'PAID' | 'PARTIAL' | 'PENDING' | 'MISSED' | 'ADVANCE';

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
  status: DailyCollectionStatus;
  payment_mode?: PaymentMode;
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
  payment_mode: PaymentMode;
  collector_id: string;
  collector_name: string;
  previous_balance: number;
  remaining_balance: number;
  /** CANCELLED = undone; kept on record but left out of totals. */
  status: 'SUCCESS' | 'PARTIAL' | 'ADVANCE' | 'CANCELLED';
  cancelled_at?: string;
  transaction_ref?: string;
  remarks?: string;
  created_at: string;
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
  id: string; // COL101
  name: string;
  photo?: string;
  mobile: string;
  email: string;
  address: string;
  assigned_area: string;
  joining_date: string;
  target_amount: number;
  status: 'ACTIVE' | 'INACTIVE';
  today_customers_count?: number;
  today_collected_amount?: number;
  monthly_collected_amount?: number;
}

export interface Area {
  id: string; // AREA101
  area_name: string;
  city: string;
  district: string;
  pincode: string;
  assigned_collector_id: string;
  assigned_collector_name: string;
  customer_count: number;
}

export interface Notification {
  id: string;
  recipient_role: Role;
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

// 360-degree aggregated Customer profile
export interface Customer360Profile {
  personal: CustomerPersonalDetails;
  address?: CustomerAddress;
  business?: BusinessDetails;
  accounts: CollectionAccount[];
  /** The running loan, if any. */
  activeAccount?: CollectionAccount;
  /** The newest loan (running or closed). */
  latestAccount?: CollectionAccount;
  recentPayments: PaymentTransaction[];
  receipts: Receipt[];
  documents: CustomerDocument[];
  notes: CustomerNote[];
  auditLogs: AuditLog[];
  metrics: {
    totalRequested: number;
    totalDisbursed: number;
    totalRepayment: number;
    totalCollected: number;
    totalRemaining: number;
    completedDays: number;
    remainingDays: number;
    overallPercentage: number;
    missedCount: number;
    overdueDays: number;
  };
}

// Dashboard statistics
export interface DashboardStats {
  totalCustomers: number;
  activeAccounts: number;
  todayExpected: number;
  todayCollected: number;
  todayPending: number;
  todayCollectionRate: number;
  monthlyCollection: number;
  totalOutstanding: number;
  totalFinanceMargin: number;
  totalDisbursed: number;
  totalRepayment: number;
  overdueCustomersCount: number;
  /** Running loans at least `not_paying_after_days` behind schedule. */
  notPayingCount: number;
}

// Monthly Excel Report row format
export interface MonthlyReportRow {
  customerId: string;
  customerName: string;
  mobile: string;
  shopName: string;
  shopAddress: string;
  area: string;
  collector: string;
  collectionAccountId: string;
  requestedAmount: number;
  marginPercentage?: number;
  marginAmount?: number;
  disbursedAmount: number;
  dailyCollection: number;
  collectionDays: number;
  totalRepayment: number;
  financeMargin: number;
  amountCollected: number;
  remainingAmount: number;
  startDate: string;
  endDate: string;
  scheduledDaysInMonth?: number;
  completedDays: number;
  remainingDays: number;
  status: string;
  dailyCollections: { [day: number]: number }; // day 1 to 31 -> amount collected
  monthlyTotal: number;
  expectedMonthlyCollection: number;
  actualMonthlyCollection: number;
  monthlyPending: number;
  collectionPercentage: number;
}

export interface MonthlyReportData {
  month: number; // 1-12
  year: number;
  monthName: string;
  daysInMonth: number;
  rows: MonthlyReportRow[];
  totals: {
    requested: number;
    disbursed: number;
    totalRepayment: number;
    financeMargin: number;
    monthlyTotal: number;
    expectedMonthly: number;
    actualMonthly: number;
    monthlyPending: number;
    collectionPercentage: number;
    dailyTotals: { [day: number]: number };
  };
}
